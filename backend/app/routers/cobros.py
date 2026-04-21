from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.client import Client
from app.models.client_membership import ClientMembership
from app.models.plan import Plan
from app.models.makeup_session import MakeupSession
from app.models.appointment import Appointment
from app.utils.membership_calc import get_cobros_priority
from datetime import date
from pydantic import BaseModel
from typing import Optional, List
import uuid

router = APIRouter(prefix="/cobros", tags=["cobros"])


class CobrosClientResponse(BaseModel):
    client_id: uuid.UUID
    client_name: str
    plan_name: Optional[str]
    membership_type: Optional[str]
    priority: int
    status_label: str
    next_billing_date: Optional[date]
    expiry_date: Optional[date]
    sessions_remaining: Optional[int]
    sessions_used: Optional[int]
    total_sessions: Optional[int]
    has_pending_makeup: bool
    membership_id: Optional[uuid.UUID]
    debt_count: int = 0
    appointment_ids_with_debt: List[uuid.UUID] = []


PRIORITY_LABELS = {
    1: "Sin pagar",
    2: "Plan vencido",
    3: "Próximo a vencer",
    4: "Al día"
}

DEBT_LABEL = "Debe clase"


@router.get("", response_model=List[CobrosClientResponse])
async def get_cobros(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    tenant_id = current_user.tenant_id
    today = date.today()

    # ------------------------------------------------------------------ #
    # 1. Clients with active (non-cancelled) memberships
    # ------------------------------------------------------------------ #
    mem_result = await db.execute(
        select(ClientMembership, Plan, Client)
        .join(Client, ClientMembership.client_id == Client.id)
        .join(Plan, ClientMembership.plan_id == Plan.id, isouter=True)
        .where(
            and_(
                ClientMembership.tenant_id == tenant_id,
                ClientMembership.status != "cancelled",
                Client.is_active == True,
            )
        )
        # Keep only the most-recent membership per client by ordering before
        # the dedup below
        .order_by(ClientMembership.client_id, ClientMembership.created_at.desc())
    )
    mem_rows = mem_result.all()

    # Dedup: one row per client (most recent membership wins, already ordered)
    seen_clients: dict[uuid.UUID, tuple] = {}
    for membership, plan, client in mem_rows:
        if client.id not in seen_clients:
            seen_clients[client.id] = (membership, plan, client)

    # ------------------------------------------------------------------ #
    # 2. Debt counts + appointment IDs per client (all tenants filtered)
    # ------------------------------------------------------------------ #
    debt_count_result = await db.execute(
        select(
            Appointment.client_id,
            func.count(Appointment.id).label("debt_count"),
        )
        .where(
            and_(
                Appointment.tenant_id == tenant_id,
                Appointment.is_debt == True,
                Appointment.paid == False,
            )
        )
        .group_by(Appointment.client_id)
    )
    debt_counts: dict[uuid.UUID, int] = {
        row.client_id: row.debt_count for row in debt_count_result.all()
    }

    # Fetch all debt appointment IDs per client in a single query
    debt_ids_result = await db.execute(
        select(Appointment.client_id, Appointment.id)
        .where(
            and_(
                Appointment.tenant_id == tenant_id,
                Appointment.is_debt == True,
                Appointment.paid == False,
            )
        )
    )
    debt_ids_map: dict[uuid.UUID, list[uuid.UUID]] = {}
    for client_id, appt_id in debt_ids_result.all():
        debt_ids_map.setdefault(client_id, []).append(appt_id)

    # ------------------------------------------------------------------ #
    # 3. Build cobros list
    # ------------------------------------------------------------------ #
    cobros: list[CobrosClientResponse] = []
    clients_with_membership: set[uuid.UUID] = set()

    for client_id, (membership, plan, client) in seen_clients.items():
        clients_with_membership.add(client_id)

        priority = get_cobros_priority(membership, today)

        # Check pending makeups
        has_pending_makeup = False
        makeup_result = await db.execute(
            select(MakeupSession).where(
                and_(
                    MakeupSession.membership_id == membership.id,
                    MakeupSession.status == "pending",
                )
            )
        )
        has_pending_makeup = makeup_result.first() is not None

        sessions_remaining = None
        if membership.total_sessions is not None:
            sessions_remaining = membership.total_sessions - (membership.sessions_used or 0)

        plan_name = None
        if plan and membership:
            if membership.membership_type == "monthly":
                plan_name = "Mensualidad"
            elif membership.sessions_per_week == 2:
                plan_name = "2x semana"
            elif membership.sessions_per_week == 3:
                plan_name = "3x semana"
            elif membership.sessions_per_week == 5:
                plan_name = "5x semana"
            else:
                plan_name = plan.name

        d_count = debt_counts.get(client_id, 0)
        d_ids = debt_ids_map.get(client_id, [])

        cobros.append(
            CobrosClientResponse(
                client_id=client.id,
                client_name=client.full_name,
                plan_name=plan_name,
                membership_type=membership.membership_type,
                priority=priority,
                status_label=PRIORITY_LABELS[priority],
                next_billing_date=(membership.next_billing_date or membership.end_date),
                expiry_date=membership.expiry_date,
                sessions_remaining=sessions_remaining,
                sessions_used=membership.sessions_used,
                total_sessions=membership.total_sessions,
                has_pending_makeup=has_pending_makeup or (d_count > 0),
                membership_id=membership.id,
                debt_count=d_count,
                appointment_ids_with_debt=d_ids,
            )
        )

    # ------------------------------------------------------------------ #
    # 4. Clients with debt but NO active membership
    # ------------------------------------------------------------------ #
    for client_id, d_count in debt_counts.items():
        if client_id in clients_with_membership:
            continue  # already included above

        # Fetch client row
        client_row = await db.get(Client, client_id)
        if not client_row or not client_row.is_active:
            continue

        d_ids = debt_ids_map.get(client_id, [])

        cobros.append(
            CobrosClientResponse(
                client_id=client_row.id,
                client_name=client_row.full_name,
                plan_name=None,
                membership_type=None,
                priority=1,
                status_label=DEBT_LABEL,
                next_billing_date=None,
                expiry_date=None,
                sessions_remaining=None,
                sessions_used=None,
                total_sessions=None,
                has_pending_makeup=False,
                membership_id=None,
                debt_count=d_count,
                appointment_ids_with_debt=d_ids,
            )
        )

    # ------------------------------------------------------------------ #
    # 5. Sort: priority asc, then secondary sort
    # ------------------------------------------------------------------ #
    def sort_key(c: CobrosClientResponse):
        secondary = 0
        if c.priority == 3:
            if c.membership_type == "session_based":
                secondary = c.sessions_remaining or 99
            elif c.next_billing_date:
                secondary = (c.next_billing_date - today).days
        elif c.priority == 4:
            if c.expiry_date:
                secondary = (c.expiry_date - today).days
            elif c.next_billing_date:
                secondary = (c.next_billing_date - today).days
        return (c.priority, secondary)

    cobros.sort(key=sort_key)
    return cobros
