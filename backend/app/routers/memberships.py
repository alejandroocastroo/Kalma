from calendar import monthrange
from datetime import datetime, date, timedelta, timezone
BOGOTA_TZ = timezone(timedelta(hours=-5))
from typing import Optional, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.client_membership import ClientMembership
from app.models.plan import Plan
from app.models.client import Client
from app.models.appointment import Appointment
from app.models.class_session import ClassSession
from app.models.makeup_session import MakeupSession
from app.schemas.client_membership import (
    ClientMembershipCreate, ClientMembershipUpdate, ClientMembershipResponse,
    WeeklyStatsResponse, AddMakeupBody, AutoBookResponse,
)
from app.utils.membership_calc import calculate_expiry_date, calculate_next_billing_date

router = APIRouter(prefix="/memberships", tags=["Membresías"])


# ---------------------------------------------------------------------------
# Pydantic schemas v2
# ---------------------------------------------------------------------------

class MakeupSessionCreate(BaseModel):
    original_date: date
    makeup_date: Optional[date] = None
    class_session_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class MakeupSessionResponse(BaseModel):
    id: uuid.UUID
    membership_id: uuid.UUID
    client_id: uuid.UUID
    original_date: date
    makeup_date: Optional[date]
    class_session_id: Optional[uuid.UUID]
    status: str
    notes: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MembershipCreateV2(BaseModel):
    client_id: uuid.UUID
    plan_id: uuid.UUID
    membership_type: str = "monthly"  # monthly | session_based
    start_date: date
    # monthly
    billing_day: Optional[int] = None  # auto-derivado de start_date
    # session_based
    sessions_per_week: Optional[int] = None
    scheduled_days: Optional[List[str]] = None  # ["monday", "tuesday"]
    makeups_allowed: int = 1
    notes: Optional[str] = None
    preferred_days: Optional[List[int]] = None
    preferred_hour: Optional[int] = None
    preferred_space_id: Optional[uuid.UUID] = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

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
    # v2 extra fields
    data["membership_type"] = m.membership_type
    data["billing_day"] = m.billing_day
    data["next_billing_date"] = m.next_billing_date
    data["sessions_per_week"] = m.sessions_per_week
    data["total_sessions"] = m.total_sessions
    data["sessions_used"] = m.sessions_used
    data["scheduled_days"] = m.scheduled_days
    data["expiry_date"] = m.expiry_date
    data["makeups_allowed"] = m.makeups_allowed
    data["makeups_used"] = m.makeups_used
    if m.total_sessions is not None:
        data["sessions_remaining"] = m.total_sessions - (m.sessions_used or 0)
    else:
        data["sessions_remaining"] = None
    # load makeup sessions
    mu_result = await db.execute(
        select(MakeupSession)
        .where(MakeupSession.membership_id == m.id)
        .order_by(MakeupSession.created_at.desc())
    )
    data["makeup_sessions"] = [
        MakeupSessionResponse.model_validate(mu).model_dump() for mu in mu_result.scalars().all()
    ]
    return data


# ---------------------------------------------------------------------------
# Static routes (before /{membership_id})
# ---------------------------------------------------------------------------

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
        # Increment sessions_used on active session_based membership
        mem_result = await db.execute(
            select(ClientMembership).where(
                ClientMembership.client_id == appt.client_id,
                ClientMembership.tenant_id == appt.tenant_id,
                ClientMembership.status == "active",
                ClientMembership.membership_type == "session_based",
            ).order_by(ClientMembership.created_at.desc()).limit(1)
        )
        membership = mem_result.scalar_one_or_none()
        if membership and membership.sessions_used < (membership.total_sessions or 0):
            membership.sessions_used += 1
    await db.commit()
    return {"updated": len(appointments)}


# ---------------------------------------------------------------------------
# CRUD memberships
# ---------------------------------------------------------------------------

@router.get("")
async def list_memberships(
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    space_id: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    q = (
        select(ClientMembership)
        .join(Client, ClientMembership.client_id == Client.id)
        .join(Plan, ClientMembership.plan_id == Plan.id, isouter=True)
        .where(ClientMembership.tenant_id == current_user.tenant_id)
    )
    if client_id:
        q = q.where(ClientMembership.client_id == uuid.UUID(client_id))
    if status:
        q = q.where(ClientMembership.status == status)
    if search:
        q = q.where(Client.full_name.ilike(f"%{search}%"))
    if space_id:
        q = q.where(Plan.space_id == uuid.UUID(space_id))

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(ClientMembership.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()
    return {
        "items": [await _enrich(m, db) for m in items],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


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


@router.post("/v2", status_code=201)
async def create_membership_v2(
    body: MembershipCreateV2,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Crea una membresía tipada (monthly o session_based).
    - monthly: calcula billing_day y next_billing_date desde start_date.
    - session_based: calcula total_sessions y expiry_date desde scheduled_days.
    """
    data = body.model_dump()

    if body.membership_type == "monthly":
        data["billing_day"] = body.start_date.day
        data["next_billing_date"] = calculate_next_billing_date(body.start_date)
        data["sessions_per_week"] = None
        data["total_sessions"] = None
        data["scheduled_days"] = None
        data["expiry_date"] = None
    elif body.membership_type == "session_based":
        if not body.sessions_per_week:
            raise HTTPException(400, "sessions_per_week es requerido para membresías de tipo session_based")
        total = body.sessions_per_week * 4
        data["total_sessions"] = total
        data["billing_day"] = None
        data["next_billing_date"] = None
        if body.scheduled_days:
            data["expiry_date"] = calculate_expiry_date(body.start_date, body.scheduled_days, total)
        else:
            data["expiry_date"] = None
    else:
        raise HTTPException(400, f"membership_type inválido: {body.membership_type}. Use 'monthly' o 'session_based'")

    m = ClientMembership(tenant_id=current_user.tenant_id, **data)
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


# ---------------------------------------------------------------------------
# Makeup sessions endpoints
# ---------------------------------------------------------------------------

@router.post("/{membership_id}/makeups", response_model=MakeupSessionResponse)
async def create_makeup_session(
    membership_id: str,
    body: MakeupSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Registra una sesión de reposición para la membresía."""
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")

    if m.makeups_used >= m.makeups_allowed:
        raise HTTPException(400, f"Se alcanzó el límite de reposiciones ({m.makeups_allowed})")

    # Para session_based: extender expiry_date si makeup_date es posterior
    if m.membership_type == "session_based" and body.makeup_date:
        if m.expiry_date is None or body.makeup_date > m.expiry_date:
            m.expiry_date = body.makeup_date

    makeup = MakeupSession(
        tenant_id=current_user.tenant_id,
        membership_id=m.id,
        client_id=m.client_id,
        original_date=body.original_date,
        makeup_date=body.makeup_date,
        class_session_id=body.class_session_id,
        notes=body.notes,
        status="pending",
    )
    m.makeups_used += 1
    db.add(makeup)
    await db.commit()
    await db.refresh(makeup)
    return makeup


@router.put("/{membership_id}/makeups/{makeup_id}", response_model=MakeupSessionResponse)
async def update_makeup_session(
    membership_id: str,
    makeup_id: str,
    body: MakeupSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Actualiza datos de una sesión de reposición (fecha, estado, notas)."""
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")

    makeup = await db.get(MakeupSession, uuid.UUID(makeup_id))
    if not makeup or makeup.membership_id != m.id:
        raise HTTPException(404, "Reposición no encontrada")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(makeup, field, value)

    await db.commit()
    await db.refresh(makeup)
    return makeup


@router.get("/{membership_id}/makeups", response_model=List[MakeupSessionResponse])
async def list_makeup_sessions(
    membership_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Lista todas las reposiciones de una membresía."""
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")

    result = await db.execute(
        select(MakeupSession)
        .where(MakeupSession.membership_id == m.id)
        .order_by(MakeupSession.created_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Weekly stats & auto-book (existing endpoints preserved)
# ---------------------------------------------------------------------------

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

    # Calcular rango del mes actual — nunca antes del start_date de la membresía
    month_start = date(today.year, today.month, 1)
    last_day = monthrange(today.year, today.month)[1]
    month_end = date(today.year, today.month, last_day)
    # Respetar start_date: no contar clases anteriores al inicio de la membresía
    effective_start = max(month_start, m.start_date)
    month_start_dt = datetime(effective_start.year, effective_start.month, effective_start.day, tzinfo=timezone.utc)
    month_end_dt = datetime(month_end.year, month_end.month, month_end.day, 23, 59, 59, tzinfo=timezone.utc)

    # attended este mes (desde start_date de la membresía)
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
