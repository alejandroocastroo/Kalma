import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.class_session import ClassSessionCreate, ClassSessionUpdate, ClassSessionResponse
from app.models.class_session import ClassSession
from app.models.class_type import ClassType
from app.models.user import User

router = APIRouter(prefix="/class-sessions", tags=["Sesiones de Clase"])


async def _enrich(session: ClassSession, db: AsyncSession) -> dict:
    data = ClassSessionResponse.model_validate(session).model_dump()
    ct = await db.get(ClassType, session.class_type_id)
    if ct:
        data["class_type_name"] = ct.name
        data["class_type_color"] = ct.color
    if session.instructor_id:
        instructor = await db.get(User, session.instructor_id)
        if instructor:
            data["instructor_name"] = instructor.full_name
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
    session = ClassSession(tenant_id=current_user.tenant_id, **body.model_dump())
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return await _enrich(session, db)


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


@router.post("/{session_id}/cancel")
async def cancel_session(
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
    session.status = "cancelled"
    await db.commit()
    return {"message": "Sesión cancelada"}
