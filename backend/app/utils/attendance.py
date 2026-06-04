"""
Helpers compartidos para aplicar/revertir asistencia en membresías.
Usados por appointments.py y memberships.py (auto_deduct).
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.client_membership import ClientMembership
from app.models.class_session import ClassSession

HYBRID_TYPES = {"hybrid_fixed", "hybrid_monthly"}
SESSION_TRACKING_TYPES = {"session_based", "weekly_sessions", "hybrid_fixed", "hybrid_monthly"}

# Priority: hybrid first, then weekly/session_based, finally monthly
_TYPE_PRIORITY = {
    "hybrid_fixed": 4,
    "hybrid_monthly": 3,
    "weekly_sessions": 2,
    "session_based": 1,
    "monthly": 0,
}


async def _select_membership_for_space(
    db: AsyncSession,
    client_id,
    tenant_id,
    space_id,
) -> ClientMembership | None:
    """
    Selecciona la membresía activa más adecuada para descontar una visita
    al espacio dado. Prioridad: hybrid_fixed > hybrid_monthly > weekly_sessions
    > session_based > monthly. Para tipos hybrid valida que el space_id esté
    en space_quotas.
    """
    result = await db.execute(
        select(ClientMembership).where(
            ClientMembership.client_id == client_id,
            ClientMembership.tenant_id == tenant_id,
            ClientMembership.status == "active",
        )
    )
    candidates = result.scalars().all()
    if not candidates:
        return None

    space_id_str = str(space_id) if space_id else None

    eligible = []
    for m in candidates:
        if m.membership_type in HYBRID_TYPES:
            # Solo es elegible si el espacio está en sus quotas
            quotas = m.space_quotas or []
            covers = any(str(q.get("space_id")) == space_id_str for q in quotas)
            if not covers:
                continue
        eligible.append(m)

    if not eligible:
        return None

    # Mayor prioridad por tipo, desempate por created_at más reciente
    eligible.sort(
        key=lambda m: (_TYPE_PRIORITY.get(m.membership_type, 0), m.created_at),
        reverse=True,
    )
    return eligible[0]


async def apply_attendance(db: AsyncSession, appt, space_id=None) -> None:
    """
    Aplica una visita a la membresía activa correcta del cliente.
    - Para tipos híbridos: incrementa space_usage[space_id] + sessions_used global.
    - Para session_based/weekly_sessions: solo sessions_used.
    - Para monthly: no descuenta.
    """
    session = None
    if space_id is None:
        session = await db.get(ClassSession, appt.class_session_id)
        space_id = session.space_id if session else None

    m = await _select_membership_for_space(db, appt.client_id, appt.tenant_id, space_id)
    if not m:
        return

    # No contar clases que ocurrieron antes de que inicie la membresía
    if session is None:
        session = await db.get(ClassSession, appt.class_session_id)
    if session and m.start_date and session.start_datetime.date() < m.start_date:
        return

    if m.membership_type in HYBRID_TYPES and space_id:
        usage = dict(m.space_usage or {})
        key = str(space_id)
        usage[key] = usage.get(key, 0) + 1
        m.space_usage = usage

    if m.membership_type in SESSION_TRACKING_TYPES:
        m.sessions_used = (m.sessions_used or 0) + 1


async def revert_attendance(db: AsyncSession, appt, space_id=None) -> None:
    """
    Revierte una visita previamente contada (cuando un appointment 'attended'
    se cancela o elimina). Inversa exacta de apply_attendance, con clamp a 0.
    """
    if space_id is None:
        session = await db.get(ClassSession, appt.class_session_id)
        space_id = session.space_id if session else None

    m = await _select_membership_for_space(db, appt.client_id, appt.tenant_id, space_id)
    if not m:
        return

    if m.membership_type in HYBRID_TYPES and space_id:
        usage = dict(m.space_usage or {})
        key = str(space_id)
        usage[key] = max(usage.get(key, 0) - 1, 0)
        m.space_usage = usage

    if m.membership_type in SESSION_TRACKING_TYPES:
        m.sessions_used = max((m.sessions_used or 0) - 1, 0)
