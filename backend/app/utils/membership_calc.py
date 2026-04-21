from datetime import date, timedelta
from typing import List, Optional

DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2,
    "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
}


def calculate_expiry_date(start_date: date, scheduled_days: List[str], total_sessions: int) -> date:
    """
    Calcula expiry_date recorriendo el calendario desde start_date,
    contando solo las ocurrencias de scheduled_days hasta llegar a total_sessions.
    El conteo INCLUYE start_date si ese día está en scheduled_days.
    """
    if not scheduled_days or total_sessions <= 0:
        return start_date

    target_weekdays = {DAY_MAP[d] for d in scheduled_days if d in DAY_MAP}
    count = 0
    current = start_date

    while count < total_sessions:
        if current.weekday() in target_weekdays:
            count += 1
            if count == total_sessions:
                return current
        current += timedelta(days=1)

    return start_date  # fallback


def calculate_next_billing_date(start_date: date) -> date:
    """Mismo día del mes siguiente."""
    import calendar
    month = start_date.month + 1
    year = start_date.year
    if month > 12:
        month = 1
        year += 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(start_date.day, last_day)
    return date(year, month, day)


def get_membership_status(membership) -> str:
    """Retorna: active, expired, completed, cancelled"""
    if membership.status == 'cancelled':
        return 'cancelled'
    today = date.today()
    if membership.membership_type == 'monthly':
        if membership.next_billing_date and membership.next_billing_date <= today:
            return 'expired'
        return 'active'
    else:  # session_based
        sessions_remaining = None
        if membership.total_sessions is not None:
            sessions_remaining = membership.total_sessions - (membership.sessions_used or 0)
        if sessions_remaining is not None and sessions_remaining <= 0:
            return 'completed'
        if membership.expiry_date and membership.expiry_date < today:
            return 'expired'
        return 'active'


def get_cobros_priority(membership, today: date) -> int:
    """
    1 = Sin pagar/walk-in (sin membresía o deuda)
    2 = Plan vencido
    3 = Próximo a vencer (≤7 días o ≤2 sesiones)
    4 = Al día
    """
    if membership is None:
        return 1
    if membership.status == 'cancelled':
        return 1

    if membership.membership_type == 'monthly':
        billing_ref = membership.next_billing_date or membership.end_date
        if billing_ref is None:
            return 4  # sin fecha de corte = tratar como al día
        delta = (billing_ref - today).days
        if delta < 0:
            return 2
        if delta <= 7:
            return 3
        return 4
    else:  # session_based
        sessions_rem = (membership.total_sessions or 0) - (membership.sessions_used or 0)
        if sessions_rem <= 0:
            return 2
        if sessions_rem <= 2:
            return 3
        if membership.expiry_date:
            delta = (membership.expiry_date - today).days
            if delta < 0:
                return 2
            if delta <= 7:
                return 3
        return 4
