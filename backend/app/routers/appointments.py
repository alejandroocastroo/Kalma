import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.models.appointment import Appointment
from app.models.class_session import ClassSession
from app.models.client import Client
from app.models.class_type import ClassType

router = APIRouter(prefix="/appointments", tags=["Citas"])


async def _enrich(appt: Appointment, db: AsyncSession) -> dict:
    data = AppointmentResponse.model_validate(appt).model_dump()
    client = await db.get(Client, appt.client_id)
    if client:
        data["client_name"] = client.full_name
        data["client_phone"] = client.phone
    session = await db.get(ClassSession, appt.class_session_id)
    if session:
        data["session_start"] = session.start_datetime
        ct = await db.get(ClassType, session.class_type_id)
        if ct:
            data["class_type_name"] = ct.name
    return data


@router.get("", response_model=list[AppointmentResponse])
async def list_appointments(
    session_id: Optional[str] = None,
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    q = select(Appointment).where(Appointment.tenant_id == current_user.tenant_id)
    if session_id:
        q = q.where(Appointment.class_session_id == uuid.UUID(session_id))
    result = await db.execute(q.order_by(Appointment.created_at.desc()))
    appointments = result.scalars().all()
    return [await _enrich(a, db) for a in appointments]


@router.post("", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    body: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    # Check session capacity
    session = await db.get(ClassSession, body.class_session_id)
    if not session or session.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Sesión no encontrada")
    if session.enrolled_count >= session.capacity:
        raise HTTPException(400, "La sesión está llena")

    appt = Appointment(tenant_id=current_user.tenant_id, **body.model_dump())
    db.add(appt)
    session.enrolled_count += 1
    await db.commit()
    await db.refresh(appt)
    return await _enrich(appt, db)


@router.put("/{appt_id}", response_model=AppointmentResponse)
async def update_appointment(
    appt_id: str,
    body: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == uuid.UUID(appt_id),
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(appt, field, value)
    await db.commit()
    await db.refresh(appt)
    return await _enrich(appt, db)


@router.post("/{appt_id}/attend")
async def mark_attended(
    appt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == uuid.UUID(appt_id),
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    appt.status = "attended"
    # Increment client total_sessions
    client = await db.get(Client, appt.client_id)
    if client:
        client.total_sessions += 1
    await db.commit()
    return {"message": "Asistencia registrada"}


@router.post("/{appt_id}/cancel")
async def cancel_appointment(
    appt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == uuid.UUID(appt_id),
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    if appt.status != "cancelled":
        appt.status = "cancelled"
        session = await db.get(ClassSession, appt.class_session_id)
        if session and session.enrolled_count > 0:
            session.enrolled_count -= 1
    await db.commit()
    return {"message": "Cita cancelada"}


@router.post("/{appt_id}/confirm-whatsapp")
async def confirm_whatsapp(appt_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    # Placeholder - integrar con WhatsApp Business API
    result = await db.execute(
        select(Appointment).where(Appointment.id == uuid.UUID(appt_id), Appointment.tenant_id == current_user.tenant_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    appt.whatsapp_confirmation_sent = True
    await db.commit()
    return {"message": "Confirmación WhatsApp enviada (placeholder)"}
