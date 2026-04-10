from calendar import monthrange
from datetime import datetime, date, timedelta, timezone
BOGOTA_TZ = timezone(timedelta(hours=-5))
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.client_membership import ClientMembership
from app.models.plan import Plan
from app.models.client import Client
from app.models.appointment import Appointment
from app.models.class_session import ClassSession
from app.schemas.client_membership import (
    ClientMembershipCreate, ClientMembershipUpdate, ClientMembershipResponse,
    WeeklyStatsResponse, AddMakeupBody, AutoBookResponse,
)

router = APIRouter(prefix="/memberships", tags=["Membresías"])


async def _enrich(m: ClientMembership, db: AsyncSession) -> dict:
    data = ClientMembershipResponse.model_validate(m).model_dump()
    client = await db.get(Client, m.client_id)
    plan = await db.get(Plan, m.plan_id)
    data["client_name"] = client.full_name if client else None
    data["plan_name"] = plan.name if plan else None
    data["plan_classes_per_week"] = plan.classes_per_week if plan else None
    data["plan_price_cop"] = plan.price_cop if plan else None
    if m.preferred_space_id:
        from app.models.space import Space
        space = await db.get(Space, m.preferred_space_id)
        data["preferred_space_name"] = space.name if space else None
    return data


@router.post("/auto-deduct")  # ESTÁTICA — ANTES DE /{membership_id}
async def auto_deduct(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)
    result = await db.execute(
        select(Appointment)
        .join(ClassSession, Appointment.class_session_id == ClassSession.id)
        .where(
            Appointment.tenant_id == current_user.tenant_id,
            Appointment.status == "confirmed",
            ClassSession.start_datetime <= cutoff,
        )
    )
    appointments = result.scalars().all()
    for appt in appointments:
        appt.status = "attended"
    await db.commit()
    return {"updated": len(appointments)}


@router.get("")
async def list_memberships(
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    q = select(ClientMembership).where(ClientMembership.tenant_id == current_user.tenant_id)
    if client_id:
        q = q.where(ClientMembership.client_id == uuid.UUID(client_id))
    if status:
        q = q.where(ClientMembership.status == status)
    q = q.order_by(ClientMembership.created_at.desc())
    result = await db.execute(q)
    items = result.scalars().all()
    return [await _enrich(m, db) for m in items]


@router.post("", status_code=201)
async def create_membership(
    body: ClientMembershipCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    m = ClientMembership(tenant_id=current_user.tenant_id, **body.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return await _enrich(m, db)


@router.get("/{membership_id}")
async def get_membership(
    membership_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")
    return await _enrich(m, db)


@router.put("/{membership_id}")
async def update_membership(
    membership_id: str,
    body: ClientMembershipUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(m, field, value)
    await db.commit()
    await db.refresh(m)
    return await _enrich(m, db)


@router.post("/{membership_id}/add-makeup")
async def add_makeup(
    membership_id: str,
    body: AddMakeupBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")
    m.makeup_credits += body.credits
    await db.commit()
    await db.refresh(m)
    return await _enrich(m, db)


@router.get("/{membership_id}/weekly-stats")
async def weekly_stats(
    membership_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")

    client = await db.get(Client, m.client_id)
    plan = await db.get(Plan, m.plan_id)

    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # lunes
    week_end = week_start + timedelta(days=6)  # domingo
    week_start_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc)
    week_end_dt = datetime(week_end.year, week_end.month, week_end.day, 23, 59, 59, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)

    # attended this week
    used_q = select(func.count()).select_from(Appointment).join(
        ClassSession, Appointment.class_session_id == ClassSession.id
    ).where(
        Appointment.client_id == m.client_id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.status == "attended",
        ClassSession.start_datetime >= week_start_dt,
        ClassSession.start_datetime <= week_end_dt,
    )
    used = (await db.execute(used_q)).scalar() or 0

    # confirmed (future) this week
    pending_q = select(func.count()).select_from(Appointment).join(
        ClassSession, Appointment.class_session_id == ClassSession.id
    ).where(
        Appointment.client_id == m.client_id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.status == "confirmed",
        ClassSession.start_datetime >= now,
        ClassSession.start_datetime <= week_end_dt,
    )
    pending = (await db.execute(pending_q)).scalar() or 0

    # Calcular rango del mes actual
    month_start = date(today.year, today.month, 1)
    last_day = monthrange(today.year, today.month)[1]
    month_end = date(today.year, today.month, last_day)
    month_start_dt = datetime(month_start.year, month_start.month, month_start.day, tzinfo=timezone.utc)
    month_end_dt = datetime(month_end.year, month_end.month, month_end.day, 23, 59, 59, tzinfo=timezone.utc)

    # attended este mes
    used_month_q = select(func.count()).select_from(Appointment).join(
        ClassSession, Appointment.class_session_id == ClassSession.id
    ).where(
        Appointment.client_id == m.client_id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.status == "attended",
        ClassSession.start_datetime >= month_start_dt,
        ClassSession.start_datetime <= month_end_dt,
    )
    used_month = (await db.execute(used_month_q)).scalar() or 0

    # confirmed futuros este mes
    pending_month_q = select(func.count()).select_from(Appointment).join(
        ClassSession, Appointment.class_session_id == ClassSession.id
    ).where(
        Appointment.client_id == m.client_id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.status == "confirmed",
        ClassSession.start_datetime >= now,
        ClassSession.start_datetime <= month_end_dt,
    )
    pending_month = (await db.execute(pending_month_q)).scalar() or 0

    classes_per_month = (plan.classes_per_week if plan else 0) * 4

    return WeeklyStatsResponse(
        membership_id=m.id,
        client_id=m.client_id,
        client_name=client.full_name if client else "",
        plan_name=plan.name if plan else "",
        classes_per_week=plan.classes_per_week if plan else 0,
        makeup_credits=m.makeup_credits,
        used_this_week=used,
        pending_this_week=pending,
        total_committed_week=used + pending,
        week_start=week_start,
        week_end=week_end,
        classes_per_month=classes_per_month,
        used_this_month=used_month,
        pending_this_month=pending_month,
        total_committed_month=used_month + pending_month,
        month_start=month_start,
        month_end=month_end,
    )


@router.post("/{membership_id}/auto-book", response_model=AutoBookResponse)
async def auto_book_membership(
    membership_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from app.models.class_session import ClassSession
    from app.models.appointment import Appointment

    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")
    if not m.preferred_days or m.preferred_hour is None:
        raise HTTPException(400, "La membresía no tiene horario fijo configurado")

    # Rango: hoy hasta fin del mes actual
    today = date.today()
    last_day = monthrange(today.year, today.month)[1]
    range_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    range_end = datetime(today.year, today.month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    # Buscar sesiones en el rango con el espacio y hora correctos
    q = select(ClassSession).where(
        ClassSession.tenant_id == current_user.tenant_id,
        ClassSession.status != "cancelled",
        ClassSession.start_datetime >= range_start,
        ClassSession.start_datetime <= range_end,
    )
    if m.preferred_space_id:
        q = q.where(ClassSession.space_id == m.preferred_space_id)

    result = await db.execute(q)
    sessions = result.scalars().all()

    # Filtrar por día de semana y hora — comparar en hora local Colombia (UTC-5)
    matching = [
        s for s in sessions
        if s.start_datetime.astimezone(BOGOTA_TZ).weekday() in m.preferred_days
        and s.start_datetime.astimezone(BOGOTA_TZ).hour == m.preferred_hour
    ]

    # Obtener citas existentes del cliente para no duplicar
    existing_q = select(Appointment.class_session_id).where(
        Appointment.client_id == m.client_id,
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.status != "cancelled",
    )
    existing_result = await db.execute(existing_q)
    existing_session_ids = set(existing_result.scalars().all())

    booked = 0
    skipped = 0
    booked_dates = []

    for session in matching:
        if session.id in existing_session_ids:
            skipped += 1
            continue
        if session.enrolled_count >= session.capacity:
            skipped += 1
            continue
        # Crear appointment
        appt = Appointment(
            tenant_id=current_user.tenant_id,
            class_session_id=session.id,
            client_id=m.client_id,
            status="confirmed",
            paid=False,
        )
        db.add(appt)
        session.enrolled_count += 1
        booked += 1
        booked_dates.append(session.start_datetime.isoformat())

    if booked > 0:
        await db.commit()

    return AutoBookResponse(booked=booked, skipped=skipped, sessions=booked_dates)
