from datetime import date, timedelta
from typing import List

DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2,
    "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
}


def calculate_expiry_date_hybrid(start_date: date, space_quotas: list) -> date:
    """
    Para hybrid_fixed: cuenta visitas por weekday sumando todos los espacios.
    Si Mantra=[Lun,Mié] y Balance=[Lun,Jue,Vie] → {0:2, 2:1, 3:1, 4:1} visitas/semana.
    Total = sum(sessions_per_week) * 4.
    Necesita visits_per_weekday (no unión de días) porque un día puede tener visitas a 2 espacios.
    """
    visits_per_weekday: dict[int, int] = {}
    total_target = 0
    for quota in space_quotas or []:
        spw = quota.get("sessions_per_week", 0)
        total_target += spw * 4
        for d in quota.get("scheduled_days") or []:
            wd = DAY_MAP.get(d)
            if wd is not None:
                visits_per_weekday[wd] = visits_per_weekday.get(wd, 0) + 1
    if not visits_per_weekday or total_target <= 0:
        return start_date
    count = 0
    current = start_date
    while count < total_target:
        count += visits_per_weekday.get(current.weekday(), 0)
        if count >= total_target:
            return current
        current += timedelta(days=1)
    return start_date


def initial_space_usage(space_quotas: list) -> dict:
    """Inicializa el contador de uso por espacio a 0."""
    return {str(q["space_id"]): 0 for q in (space_quotas or [])}


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


def get_current_week_bounds(today: date = None):
    """Retorna (lunes, domingo) de la semana actual."""
    if today is None:
        today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


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
    elif membership.membership_type == 'session_based':
        bonus = getattr(membership, 'bonus_sessions', 0) or 0
        sessions_remaining = None
        if membership.total_sessions is not None:
            sessions_remaining = membership.total_sessions + bonus - (membership.sessions_used or 0)
        if sessions_remaining is not None and sessions_remaining <= 0:
            return 'completed'
        if membership.expiry_date and membership.expiry_date < today:
            return 'expired'
        return 'active'
    elif membership.membership_type == 'hybrid_fixed':
        bonus = getattr(membership, 'bonus_sessions', 0) or 0
        sessions_remaining = None
        if membership.total_sessions is not None:
            sessions_remaining = membership.total_sessions + bonus - (membership.sessions_used or 0)
        if sessions_remaining is not None and sessions_remaining <= 0:
            return 'completed'
        if membership.expiry_date and membership.expiry_date < today:
            return 'expired'
        return 'active'
    else:  # weekly_sessions, hybrid_monthly — se comportan como monthly
        if membership.next_billing_date and membership.next_billing_date <= today:
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
    elif membership.membership_type in ('session_based', 'hybrid_fixed'):
        bonus = getattr(membership, 'bonus_sessions', 0) or 0
        sessions_rem = (membership.total_sessions or 0) + bonus - (membership.sessions_used or 0)
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
    else:  # weekly_sessions, hybrid_monthly — se comportan como monthly en cobros
        billing_ref = membership.next_billing_date or membership.end_date
        if billing_ref is None:
            return 4
        delta = (billing_ref - today).days
        if delta < 0:
            return 2
        if delta <= 7:
            return 3
        return 4
