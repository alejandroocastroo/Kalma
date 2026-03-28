import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.class_session import (
    ClassSessionCreate,
    ClassSessionUpdate,
    ClassSessionResponse,
    QuickBookRequest,
    QuickBookResponse,
)
from app.schemas.appointment import AppointmentResponse
from app.models.class_session import ClassSession
from app.models.class_type import ClassType
from app.models.space import Space
from app.models.appointment import Appointment
from app.models.client import Client
from app.models.user import User

router = APIRouter(prefix="/class-sessions", tags=["Sesiones de Clase"])


async def _enrich(session: ClassSession, db: AsyncSession) -> dict:
    data = ClassSessionResponse.model_validate(session).model_dump()
    if session.class_type_id:
        ct = await db.get(ClassType, session.class_type_id)
        if ct:
            data["class_type_name"] = ct.name
            data["class_type_color"] = ct.color
    if session.space_id:
        space = await db.get(Space, session.space_id)
        if space:
            data["space_name"] = space.name
            if not data.get("class_type_name"):
                data["class_type_name"] = space.name
                data["class_type_color"] = data.get("class_type_color") or "#6366f1"
    if session.instructor_id:
        instructor = await db.get(User, session.instructor_id)
        if instructor:
            data["instructor_name"] = instructor.full_name
    # custom_name overrides the display name if set
    if session.custom_name:
        data["class_type_name"] = session.custom_name
    return data


@router.get("", response_model=List[ClassSessionResponse])
async def list_sessions(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    q = select(ClassSession).where(ClassSession.tenant_id == current_user.tenant_id)
    if not start and not end:
        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)
        q = q.where(ClassSession.start_datetime >= week_start, ClassSession.start_datetime < week_end)
    else:
        if start:
            q = q.where(ClassSession.start_datetime >= datetime.fromisoformat(start))
        if end:
            q = q.where(ClassSession.start_datetime <= datetime.fromisoformat(end))
    q = q.order_by(ClassSession.start_datetime)
    result = await db.execute(q)
    sessions = result.scalars().all()
    enriched = []
    for s in sessions:
        enriched.append(await _enrich(s, db))
    return enriched


@router.get("/week", response_model=List[ClassSessionResponse])
async def week_sessions(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    result = await db.execute(
        select(ClassSession)
        .where(
            ClassSession.tenant_id == current_user.tenant_id,
            ClassSession.start_datetime >= week_start,
            ClassSession.start_datetime < week_end,
            ClassSession.status != "cancelled",
        )
        .order_by(ClassSession.start_datetime)
    )
    sessions = result.scalars().all()
    return [await _enrich(s, db) for s in sessions]


@router.post("", response_model=ClassSessionResponse, status_code=201)
async def create_session(
    body: ClassSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")

    # Validate class_type only when provided
    class_type = None
    if body.class_type_id:
        result = await db.execute(
            select(ClassType).where(
                ClassType.id == body.class_type_id,
                ClassType.tenant_id == current_user.tenant_id,
            )
        )
        class_type = result.scalar_one_or_none()
        if not class_type:
            raise HTTPException(404, "Tipo de clase no encontrado")

    # Resolve capacity: use body value, then space capacity, then hard default
    capacity = body.capacity
    space = None
    if body.space_id:
        space = await db.get(Space, body.space_id)
        if body.space_id and not space:
            raise HTTPException(404, "Espacio no encontrado")
        overlap = await db.execute(
            select(ClassSession).where(
                ClassSession.space_id == body.space_id,
                ClassSession.tenant_id == current_user.tenant_id,
                ClassSession.status != "cancelled",
                ClassSession.start_datetime < body.end_datetime,
                ClassSession.end_datetime > body.start_datetime,
            )
        )
        if overlap.scalar_one_or_none():
            raise HTTPException(409, "Este espacio ya tiene una clase programada en ese horario")
        if capacity is None and space:
            capacity = space.capacity

    if capacity is None:
        capacity = 8  # global fallback

    session = ClassSession(
        tenant_id=current_user.tenant_id,
        class_type_id=body.class_type_id,
        space_id=body.space_id,
        instructor_id=body.instructor_id,
        start_datetime=body.start_datetime,
        end_datetime=body.end_datetime,
        capacity=capacity,
        custom_name=body.custom_name,
        notes=body.notes,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return await _enrich(session, db)


@router.post("/quick-book", response_model=QuickBookResponse, status_code=201)
async def quick_book(
    body: QuickBookRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Atomically create a class session and, when client_id is provided,
    book that client into the session in a single DB transaction.
    """
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")

    # 1. Validate class_type only when provided
    class_type = None
    if body.class_type_id:
        result = await db.execute(
            select(ClassType).where(
                ClassType.id == body.class_type_id,
                ClassType.tenant_id == current_user.tenant_id,
            )
        )
        class_type = result.scalar_one_or_none()
        if not class_type:
            raise HTTPException(404, "Tipo de clase no encontrado")

    # 2. Validate client belongs to this tenant (when provided)
    client: Client | None = None
    if body.client_id is not None:
        result = await db.execute(
            select(Client).where(
                Client.id == body.client_id,
                Client.tenant_id == current_user.tenant_id,
            )
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(404, "Cliente no encontrado")

    # 3. Resolve capacity and check space overlap
    end_datetime = body.start_datetime + timedelta(minutes=body.duration_minutes)
    capacity = body.capacity
    space: Space | None = None
    if body.space_id:
        space = await db.get(Space, body.space_id)
        if not space:
            raise HTTPException(404, "Espacio no encontrado")
        overlap = await db.execute(
            select(ClassSession).where(
                ClassSession.space_id == body.space_id,
                ClassSession.tenant_id == current_user.tenant_id,
                ClassSession.status != "cancelled",
                ClassSession.start_datetime < end_datetime,
                ClassSession.end_datetime > body.start_datetime,
            )
        )
        if overlap.scalar_one_or_none():
            raise HTTPException(409, "Este espacio ya tiene una clase programada en ese horario")
        if capacity is None:
            capacity = space.capacity

    if capacity is None:
        capacity = 8  # global fallback

    # 4. Capacity sanity-check: booking 1 client into a brand-new session
    if body.client_id is not None and capacity < 1:
        raise HTTPException(400, "La sesión no tiene capacidad disponible")

    # 5. Create the session
    session = ClassSession(
        tenant_id=current_user.tenant_id,
        class_type_id=body.class_type_id,
        space_id=body.space_id,
        start_datetime=body.start_datetime,
        end_datetime=end_datetime,
        capacity=capacity,
        enrolled_count=0,
        status="scheduled",
    )
    db.add(session)
    # Flush to get session.id without committing yet
    await db.flush()

    # 6. Create appointment if client_id was provided
    appt: Appointment | None = None
    if body.client_id is not None:
        dup_result = await db.execute(
            select(Appointment).where(
                Appointment.class_session_id == session.id,
                Appointment.client_id == body.client_id,
            )
        )
        if dup_result.scalar_one_or_none() is not None:
            raise HTTPException(409, "El cliente ya tiene una cita en esta sesión")

        appt = Appointment(
            tenant_id=current_user.tenant_id,
            class_session_id=session.id,
            client_id=body.client_id,
            status="confirmed",
            paid=False,
        )
        db.add(appt)
        session.enrolled_count += 1

    # 7. Commit everything atomically
    await db.commit()
    await db.refresh(session)
    if appt is not None:
        await db.refresh(appt)

    # 8. Build enriched response
    enriched_session = await _enrich(session, db)

    enriched_appt: dict | None = None
    if appt is not None:
        enriched_appt = AppointmentResponse.model_validate(appt).model_dump()
        if client is not None:
            enriched_appt["client_name"] = client.full_name
            enriched_appt["client_phone"] = client.phone
        enriched_appt["session_start"] = session.start_datetime
        enriched_appt["class_type_name"] = class_type.name if class_type else (space.name if space else None)

    return QuickBookResponse(session=enriched_session, appointment=enriched_appt)


@router.put("/{session_id}", response_model=ClassSessionResponse)
async def update_session(
    session_id: str,
    body: ClassSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(ClassSession).where(
            ClassSession.id == uuid.UUID(session_id),
            ClassSession.tenant_id == current_user.tenant_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Sesión no encontrada")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(session, field, value)
    await db.commit()
    await db.refresh(session)
    return await _enrich(session, db)


@router.delete("/{session_id}", status_code=200)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(ClassSession).where(
            ClassSession.id == uuid.UUID(session_id),
            ClassSession.tenant_id == current_user.tenant_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Sesión no encontrada")

    # Delete related appointments first to avoid FK constraint violations
    await db.execute(
        delete(Appointment).where(Appointment.class_session_id == session.id)
    )
    await db.delete(session)
    await db.commit()
    return {"message": "Sesión eliminada"}
