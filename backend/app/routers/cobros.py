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
        .order_by(ClientMembership.client_id, ClientMembership.created_at.desc())
    )
    mem_rows = mem_result.all()

    # Dedup: one row per client (most recent membership wins)
    seen_clients: dict[uuid.UUID, tuple] = {}
    for membership, plan, client in mem_rows:
        if client.id not in seen_clients:
            seen_clients[client.id] = (membership, plan, client)

    # ------------------------------------------------------------------ #
    # 2. Single query for all debt appointment IDs (replaces two queries)
    # ------------------------------------------------------------------ #
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
    # 3. Single batch query for all pending makeups
    # ------------------------------------------------------------------ #
    membership_ids = [m.id for m, _, _ in seen_clients.values()]
    if membership_ids:
        pending_makeup_result = await db.execute(
            select(MakeupSession.membership_id)
            .where(
                and_(
                    MakeupSession.membership_id.in_(membership_ids),
                    MakeupSession.status == "pending",
                )
            )
            .distinct()
        )
        memberships_with_pending_makeup: set[uuid.UUID] = set(pending_makeup_result.scalars().all())
    else:
        memberships_with_pending_makeup = set()

    # ------------------------------------------------------------------ #
    # 4. Batch-fetch clients with debt but NO active membership
    # ------------------------------------------------------------------ #
    no_membership_client_ids = [
        cid for cid in debt_ids_map if cid not in seen_clients
    ]
    no_membership_clients: dict[uuid.UUID, Client] = {}
    if no_membership_client_ids:
        client_rows_result = await db.execute(
            select(Client).where(
                Client.id.in_(no_membership_client_ids),
                Client.is_active == True,
            )
        )
        no_membership_clients = {c.id: c for c in client_rows_result.scalars().all()}

    # ------------------------------------------------------------------ #
    # 5. Build cobros list
    # ------------------------------------------------------------------ #
    cobros: list[CobrosClientResponse] = []

    for client_id, (membership, plan, client) in seen_clients.items():
        priority = get_cobros_priority(membership, today)
        has_pending_makeup = membership.id in memberships_with_pending_makeup

        sessions_remaining = None
        if membership.total_sessions is not None:
            sessions_remaining = membership.total_sessions - (membership.sessions_used or 0)

        plan_name = plan.name if plan else None
        d_count = len(debt_ids_map.get(client_id, []))
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

    # Clients with debt but NO active membership
    for client_id, client_row in no_membership_clients.items():
        d_count = len(debt_ids_map.get(client_id, []))
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
    # 6. Sort: priority asc, then secondary sort
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
