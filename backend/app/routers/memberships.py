from calendar import monthrange
from datetime import datetime, date, timedelta, timezone
BOGOTA_TZ = timezone(timedelta(hours=-5))
from typing import Optional, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

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
from app.utils.membership_calc import (
    calculate_expiry_date, calculate_next_billing_date,
    calculate_expiry_date_hybrid, initial_space_usage,
)
from app.utils.attendance import apply_attendance

router = APIRouter(prefix="/memberships", tags=["Membresías"])


# ---------------------------------------------------------------------------
# Pydantic schemas v2
# ---------------------------------------------------------------------------

class AddBonusSessionsBody(BaseModel):
    quantity: int
    notes: Optional[str] = None


class MakeupSessionCreate(BaseModel):
    original_date: date
    makeup_date: Optional[date] = None
    class_session_id: Optional[uuid.UUID] = None
    space_id: Optional[uuid.UUID] = None
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


class SpaceQuotaInput(BaseModel):
    space_id: uuid.UUID
    sessions_per_week: int
    scheduled_days: Optional[List[str]] = None  # solo hybrid_fixed


class MembershipCreateV2(BaseModel):
    client_id: uuid.UUID
    plan_id: uuid.UUID
    membership_type: str = "monthly"  # monthly | session_based | weekly_sessions | hybrid_fixed | hybrid_monthly
    start_date: date
    # monthly
    billing_day: Optional[int] = None  # auto-derivado de start_date
    # session_based
    sessions_per_week: Optional[int] = None
    scheduled_days: Optional[List[str]] = None  # ["monday", "tuesday"]
    # hybrid
    space_quotas: Optional[List[SpaceQuotaInput]] = None
    makeups_allowed: int = 1
    notes: Optional[str] = None
    preferred_days: Optional[List[int]] = None
    preferred_hour: Optional[int] = None
    preferred_space_id: Optional[uuid.UUID] = None
    preferred_schedule: Optional[List[dict]] = None  # [{"day":0,"hour":9},...] solo session_based


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _enrich_loaded(m: ClientMembership) -> dict:
    """Sync enrichment — requires relationships already loaded via selectinload."""
    data = ClientMembershipResponse.model_validate(m).model_dump()
    client = m.client
    plan = m.plan
    data["client_name"] = client.full_name if client else None
    data["plan_name"] = plan.name if plan else None
    data["plan_classes_per_week"] = getattr(plan, "classes_per_week", None) if plan else None
    data["plan_price_cop"] = getattr(plan, "price_cop", None) if plan else None
    data["preferred_space_name"] = m.preferred_space.name if m.preferred_space else None
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
    data["bonus_sessions"] = m.bonus_sessions or 0
    data["space_quotas"] = m.space_quotas
    data["space_usage"] = m.space_usage
    data["preferred_schedule"] = m.preferred_schedule
    data["sessions_remaining"] = (
        m.total_sessions + (m.bonus_sessions or 0) - (m.sessions_used or 0)
        if m.total_sessions is not None else None
    )
    data["makeup_sessions"] = [
        MakeupSessionResponse.model_validate(mu).model_dump()
        for mu in sorted(m.makeup_sessions, key=lambda x: x.created_at, reverse=True)
    ]
    return data


async def _enrich(m: ClientMembership, db: AsyncSession) -> dict:
    """Async enrichment — used after individual writes where relationships aren't pre-loaded."""
    from app.models.space import Space
    await db.refresh(m)
    client = await db.get(Client, m.client_id)
    plan = await db.get(Plan, m.plan_id)
    space = await db.get(Space, m.preferred_space_id) if m.preferred_space_id else None
    mu_result = await db.execute(
        select(MakeupSession)
        .where(MakeupSession.membership_id == m.id)
        .order_by(MakeupSession.created_at.desc())
    )
    makeups = mu_result.scalars().all()

    data = ClientMembershipResponse.model_validate(m).model_dump()
    data["client_name"] = client.full_name if client else None
    data["plan_name"] = plan.name if plan else None
    data["plan_classes_per_week"] = getattr(plan, "classes_per_week", None) if plan else None
    data["plan_price_cop"] = getattr(plan, "price_cop", None) if plan else None
    data["preferred_space_name"] = space.name if space else None
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
    data["bonus_sessions"] = m.bonus_sessions or 0
    data["space_quotas"] = m.space_quotas
    data["space_usage"] = m.space_usage
    data["preferred_schedule"] = m.preferred_schedule
    data["sessions_remaining"] = (
        m.total_sessions + (m.bonus_sessions or 0) - (m.sessions_used or 0)
        if m.total_sessions is not None else None
    )
    data["makeup_sessions"] = [
        MakeupSessionResponse.model_validate(mu).model_dump() for mu in makeups
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
        await apply_attendance(db, appt)
    await db.commit()
    return {"updated": len(appointments)}


# ---------------------------------------------------------------------------
# CRUD memberships
# ---------------------------------------------------------------------------

@router.get("")
async def list_memberships(
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = Query(None, max_length=100),
    space_id: Optional[str] = None,
    sort_by: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    # Build base filtered query (without options — for count)
    base_q = (
        select(ClientMembership)
        .join(Client, ClientMembership.client_id == Client.id)
        .join(Plan, ClientMembership.plan_id == Plan.id, isouter=True)
        .where(ClientMembership.tenant_id == current_user.tenant_id)
    )
    if client_id:
        base_q = base_q.where(ClientMembership.client_id == uuid.UUID(client_id))
    if status == 'not_cancelled':
        base_q = base_q.where(ClientMembership.status != 'cancelled')
    elif status:
        base_q = base_q.where(ClientMembership.status == status)
    if search:
        base_q = base_q.where(Client.full_name.ilike(f"%{search}%"))
    if space_id:
        space_uuid = uuid.UUID(space_id)
        base_q = base_q.where(
            or_(
                Plan.space_id == space_uuid,
                ClientMembership.preferred_space_id == space_uuid,
            )
        )

    # Count
    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Data query with eager loading (5 queries total: 1 main + 4 selectinload batches)
    data_q = (
        base_q
        .options(
            selectinload(ClientMembership.client),
            selectinload(ClientMembership.plan),
            selectinload(ClientMembership.preferred_space),
            selectinload(ClientMembership.makeup_sessions),
        )
        .order_by(
            (
                ClientMembership.sessions_used.cast(sa.Float) /
                sa.func.nullif(ClientMembership.total_sessions, 0)
            ).desc().nulls_last()
            if sort_by == "fullness"
            else ClientMembership.created_at.desc()
        )
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(data_q)
    items = result.scalars().unique().all()
    return {
        "items": [_enrich_loaded(m) for m in items],
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
    elif body.membership_type == "weekly_sessions":
        if not body.sessions_per_week:
            raise HTTPException(400, "sessions_per_week es requerido para membresías de tipo weekly_sessions")
        data["billing_day"] = body.start_date.day
        data["next_billing_date"] = calculate_next_billing_date(body.start_date)
        data["total_sessions"] = body.sessions_per_week * 4
        data["scheduled_days"] = None
        data["expiry_date"] = None
    elif body.membership_type == "hybrid_fixed":
        if not body.space_quotas or len(body.space_quotas) < 2:
            raise HTTPException(400, "hybrid_fixed requiere al menos 2 entries en space_quotas")
        for q in body.space_quotas:
            if not q.scheduled_days or len(q.scheduled_days) != q.sessions_per_week:
                raise HTTPException(
                    400,
                    f"Para hybrid_fixed, cada espacio requiere scheduled_days con exactamente sessions_per_week días "
                    f"(espacio {q.space_id}: esperados {q.sessions_per_week}, recibidos {len(q.scheduled_days or [])})"
                )
        quotas_raw = [{**q.model_dump(), "space_id": str(q.space_id)} for q in body.space_quotas]
        total_spw = sum(q.sessions_per_week for q in body.space_quotas)
        data["space_quotas"] = quotas_raw
        data["total_sessions"] = total_spw * 4
        data["sessions_per_week"] = total_spw
        data["space_usage"] = initial_space_usage(quotas_raw)
        data["expiry_date"] = calculate_expiry_date_hybrid(body.start_date, quotas_raw)
        data["billing_day"] = None
        data["next_billing_date"] = None
        data["scheduled_days"] = None
    elif body.membership_type == "hybrid_monthly":
        if not body.space_quotas or len(body.space_quotas) < 2:
            raise HTTPException(400, "hybrid_monthly requiere al menos 2 entries en space_quotas")
        quotas_raw = [{**q.model_dump(), "space_id": str(q.space_id)} for q in body.space_quotas]
        total_spw = sum(q.sessions_per_week for q in body.space_quotas)
        data["space_quotas"] = quotas_raw
        data["total_sessions"] = total_spw * 4
        data["sessions_per_week"] = total_spw
        data["space_usage"] = initial_space_usage(quotas_raw)
        data["billing_day"] = body.start_date.day
        data["next_billing_date"] = calculate_next_billing_date(body.start_date)
        data["scheduled_days"] = None
        data["expiry_date"] = None
    else:
        raise HTTPException(400, f"membership_type inválido: {body.membership_type}. Use 'monthly', 'session_based', 'weekly_sessions', 'hybrid_fixed' o 'hybrid_monthly'")

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


class RenewMembershipBody(BaseModel):
    start_date: date


@router.post("/{membership_id}/renew")
async def renew_membership(
    membership_id: str,
    body: RenewMembershipBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")

    m.start_date = body.start_date
    m.sessions_used = 0
    m.makeups_used = 0
    m.bonus_sessions = 0
    m.makeup_credits = 0
    m.status = "active"

    if m.membership_type == "monthly":
        m.billing_day = body.start_date.day
        m.next_billing_date = calculate_next_billing_date(body.start_date)
        m.expiry_date = None
    elif m.membership_type == "session_based":
        total = (m.sessions_per_week or 0) * 4
        m.total_sessions = total
        m.next_billing_date = None
        m.billing_day = None
        if m.scheduled_days:
            m.expiry_date = calculate_expiry_date(body.start_date, m.scheduled_days, total)
        else:
            m.expiry_date = None
    elif m.membership_type == "weekly_sessions":
        m.billing_day = body.start_date.day
        m.next_billing_date = calculate_next_billing_date(body.start_date)
        m.total_sessions = (m.sessions_per_week or 0) * 4
        m.expiry_date = None
    elif m.membership_type == "hybrid_fixed":
        quotas = m.space_quotas or []
        total_spw = sum(q.get("sessions_per_week", 0) for q in quotas)
        m.total_sessions = total_spw * 4
        m.sessions_per_week = total_spw
        m.expiry_date = calculate_expiry_date_hybrid(body.start_date, quotas)
        m.space_usage = initial_space_usage(quotas)
        m.billing_day = None
        m.next_billing_date = None
    elif m.membership_type == "hybrid_monthly":
        quotas = m.space_quotas or []
        total_spw = sum(q.get("sessions_per_week", 0) for q in quotas)
        m.total_sessions = total_spw * 4
        m.sessions_per_week = total_spw
        m.billing_day = body.start_date.day
        m.next_billing_date = calculate_next_billing_date(body.start_date)
        m.space_usage = initial_space_usage(quotas)
        m.expiry_date = None

    await db.commit()
    await db.refresh(m)
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


@router.post("/{membership_id}/bonus-sessions")
async def add_bonus_sessions(
    membership_id: str,
    body: AddBonusSessionsBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Agrega clases adicionales (bonus) a cualquier membresía activa."""
    m = await db.get(ClientMembership, uuid.UUID(membership_id))
    if not m or m.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Membresía no encontrada")
    if body.quantity <= 0:
        raise HTTPException(400, "La cantidad debe ser mayor a 0")
    m.bonus_sessions = (m.bonus_sessions or 0) + body.quantity
    if body.notes:
        m.notes = f"{m.notes or ''}\n[+{body.quantity} clases] {body.notes}".strip()
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

    # Para session_based y hybrid_fixed: extender expiry_date si makeup_date es posterior
    if m.membership_type in ("session_based", "hybrid_fixed") and body.makeup_date:
        if m.expiry_date is None or body.makeup_date > m.expiry_date:
            m.expiry_date = body.makeup_date

    # Derivar space_id del class_session si no viene explícito
    space_id = body.space_id
    if space_id is None and body.class_session_id:
        cs = await db.get(ClassSession, body.class_session_id)
        if cs:
            space_id = cs.space_id

    makeup = MakeupSession(
        tenant_id=current_user.tenant_id,
        membership_id=m.id,
        client_id=m.client_id,
        original_date=body.original_date,
        makeup_date=body.makeup_date,
        class_session_id=body.class_session_id,
        space_id=space_id,
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
    if m.membership_type == "hybrid_monthly":
        raise HTTPException(400, "Auto-book no disponible para planes híbridos sin días fijos. Reserve manualmente desde la agenda.")

    # Construir lista de (space_id | None, weekday, hour):
    # - preferred_schedule con space_id: hybrid_fixed → cada entrada lleva su espacio
    # - preferred_schedule sin space_id: session_based → filtrar por preferred_space_id global
    # - fallback legacy: preferred_days + preferred_hour
    ScheduleEntry = tuple  # (space_id_str | None, weekday, hour)
    schedule_entries: list[ScheduleEntry] = []

    if m.preferred_schedule:
        # Si las entradas no tienen space_id propio, usar preferred_space_id global como fallback
        global_sid = str(m.preferred_space_id) if m.preferred_space_id else None
        for e in m.preferred_schedule:
            sid = e.get("space_id") or global_sid
            schedule_entries.append((sid, int(e["day"]), int(e["hour"])))
    elif m.preferred_days and m.preferred_hour is not None:
        global_space = str(m.preferred_space_id) if m.preferred_space_id else None
        for d in m.preferred_days:
            schedule_entries.append((global_space, d, m.preferred_hour))

    if not schedule_entries:
        raise HTTPException(400, "La membresía no tiene horario fijo configurado")

    # Rango: session_based y hybrid_fixed hasta expiry_date; resto fin del mes
    today = date.today()
    # Respetar start_date: no agendar sesiones antes de que la membresía inicie
    effective_start = max(today, m.start_date) if m.start_date else today
    range_start = datetime(effective_start.year, effective_start.month, effective_start.day, tzinfo=timezone.utc)
    if m.membership_type in ("session_based", "hybrid_fixed") and m.expiry_date:
        range_end = datetime(m.expiry_date.year, m.expiry_date.month, m.expiry_date.day,
                             23, 59, 59, tzinfo=timezone.utc)
    else:
        last_day = monthrange(today.year, today.month)[1]
        range_end = datetime(today.year, today.month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    q = select(ClassSession).where(
        ClassSession.tenant_id == current_user.tenant_id,
        ClassSession.status != "cancelled",
        ClassSession.start_datetime >= range_start,
        ClassSession.start_datetime <= range_end,
    )
    # Filtrar por espacio cuando sea posible para no traer sesiones de otros espacios innecesariamente.
    # hybrid_fixed: cada entry tiene su propio space_id, no filtramos aquí.
    # Cualquier otro tipo: si preferred_schedule no tiene space_id por entry (formato legacy {"day","hour"}),
    # o si usa preferred_days, filtrar por preferred_space_id global.
    if m.membership_type not in ("hybrid_fixed",) and m.preferred_space_id:
        uses_per_entry_space = m.preferred_schedule and any(e.get("space_id") for e in m.preferred_schedule)
        if not uses_per_entry_space:
            q = q.where(ClassSession.space_id == m.preferred_space_id)

    result = await db.execute(q)
    sessions = result.scalars().all()

    def _matches(s: ClassSession) -> bool:
        local = s.start_datetime.astimezone(BOGOTA_TZ)
        for (sid, wd, hr) in schedule_entries:
            if local.weekday() == wd and local.hour == hr:
                if sid is None or str(s.space_id) == sid:
                    return True
        return False

    matching = [s for s in sessions if _matches(s)]

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

    # Cupo restante: para planes con sesiones fijas, no superar total_sessions
    remaining_quota = None
    if m.membership_type in ("session_based", "hybrid_fixed") and m.total_sessions is not None:
        remaining_quota = m.total_sessions - (m.sessions_used or 0)

    for session in sorted(matching, key=lambda s: s.start_datetime):
        if remaining_quota is not None and booked >= remaining_quota:
            skipped += 1
            continue
        if session.id in existing_session_ids:
            skipped += 1
            continue
        if session.enrolled_count >= session.capacity:
            skipped += 1
            continue
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
