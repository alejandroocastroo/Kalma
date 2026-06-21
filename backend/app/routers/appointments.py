import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from decimal import Decimal
from datetime import date, datetime, timezone
from pydantic import BaseModel

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.models.appointment import Appointment
from app.models.class_session import ClassSession
from app.models.client import Client
from app.models.class_type import ClassType
from app.models.client_membership import ClientMembership
from app.models.payment import Payment
from app.models.space import Space
from app.utils.attendance import apply_attendance, revert_attendance
from app.utils.timezone import get_tenant_zoneinfo, tenant_today, local_date_of

router = APIRouter(prefix="/appointments", tags=["Citas"])


async def _enrich(appt: Appointment, db: AsyncSession) -> dict:
    data = AppointmentResponse.model_validate(appt).model_dump()
    client = await db.get(Client, appt.client_id)
    if client:
        data["client_name"] = client.full_name
        data["client_phone"] = client.phone
        data["client_notes"] = client.notes
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

    appt_data = body.model_dump()

    # Si la sesión ya pasó, insertar directamente como attended y contar la visita
    session_is_past = session.start_datetime < datetime.now(timezone.utc)
    if session_is_past:
        appt_data["status"] = "attended"

    appt = Appointment(tenant_id=current_user.tenant_id, **appt_data)
    db.add(appt)
    session.enrolled_count += 1

    if session_is_past:
        client = await db.get(Client, appt.client_id)
        if client:
            client.total_sessions += 1
        await db.flush()  # appt necesita tener id antes de apply_attendance
        await apply_attendance(db, appt, space_id=session.space_id)

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


@router.delete("/{appt_id}", status_code=200)
async def delete_appointment(
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
        session = await db.get(ClassSession, appt.class_session_id)
        if session and session.enrolled_count > 0:
            session.enrolled_count -= 1
    if appt.status == "attended":
        await revert_attendance(db, appt)
    await db.delete(appt)
    await db.commit()
    return {"message": "Cliente eliminado de la sesión"}


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
    client = await db.get(Client, appt.client_id)
    if client:
        client.total_sessions += 1
    await apply_attendance(db, appt)
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
        was_attended = appt.status == "attended"
        appt.status = "cancelled"
        session = await db.get(ClassSession, appt.class_session_id)
        if session and session.enrolled_count > 0:
            session.enrolled_count -= 1
        if was_attended:
            await revert_attendance(db, appt)
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


class MarkPaidBody(BaseModel):
    amount: Decimal
    payment_method: str


@router.put("/{appt_id}/mark-paid")
async def mark_appointment_paid(
    appt_id: uuid.UUID,
    body: MarkPaidBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Appointment, ClassSession, Space)
        .join(ClassSession, Appointment.class_session_id == ClassSession.id, isouter=True)
        .join(Space, ClassSession.space_id == Space.id, isouter=True)
        .where(and_(Appointment.id == appt_id, Appointment.tenant_id == current_user.tenant_id))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    appt, session, space = row
    appt.paid = True
    appt.is_debt = False

    tz = await get_tenant_zoneinfo(db, current_user.tenant_id)
    payment_date = local_date_of(session.start_datetime, tz) if session and session.start_datetime else tenant_today(tz)
    space_name = space.name if space else "Sin espacio"

    payment = Payment(
        tenant_id=current_user.tenant_id,
        client_id=appt.client_id,
        appointment_id=appt.id,
        space_id=space.id if space else None,
        amount=body.amount,
        type="income",
        category="clase_dia",
        payment_method=body.payment_method,
        description=f"Clase {space_name}",
        payment_date=payment_date,
        created_by=current_user.id,
    )
    db.add(payment)
    await db.commit()
    return {"ok": True}
