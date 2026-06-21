"""Utilidades de zona horaria por tenant.

Cada tenant tiene un campo `timezone` (string IANA, ej. "America/Bogota",
"America/Mexico_City"). Toda hora se almacena en UTC; estas utilidades convierten
entre UTC y la hora local del tenant. El default es Bogotá (UTC-5), que preserva
el comportamiento histórico de los tenants colombianos.
"""
from datetime import date, datetime, timezone as _utc
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIMEZONE = "America/Bogota"

# Zonas ofrecidas en el panel de superadmin. El backend acepta cualquier zona
# IANA válida; esta lista es solo la curada para la UI.
SUPPORTED_TIMEZONES = [
    ("America/Bogota", "Colombia (Bogotá) — UTC-5"),
    ("America/Mexico_City", "México (Centro / CDMX) — UTC-6"),
    ("America/Cancun", "México (Cancún / Quintana Roo) — UTC-5"),
    ("America/Tijuana", "México (Tijuana / Noroeste) — UTC-8"),
    ("America/Lima", "Perú (Lima) — UTC-5"),
    ("America/Santiago", "Chile (Santiago) — UTC-4/-3"),
    ("America/Argentina/Buenos_Aires", "Argentina (Buenos Aires) — UTC-3"),
    ("America/New_York", "EE. UU. (Este) — UTC-5/-4"),
    ("America/Los_Angeles", "EE. UU. (Pacífico) — UTC-8/-7"),
    ("Europe/Madrid", "España (Madrid) — UTC+1/+2"),
]


def is_valid_timezone(tz: str) -> bool:
    try:
        ZoneInfo(tz)
        return True
    except (ZoneInfoNotFoundError, ValueError, Exception):
        return False


def get_zoneinfo(timezone_str: str | None) -> ZoneInfo:
    """Devuelve el ZoneInfo del tenant, cayendo a Bogotá si es inválido/None."""
    if not timezone_str:
        return ZoneInfo(DEFAULT_TIMEZONE)
    try:
        return ZoneInfo(timezone_str)
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE)


async def get_tenant_zoneinfo(db, tenant_id) -> ZoneInfo:
    """Carga la zona horaria del tenant desde la BD. Cae a Bogotá si no existe."""
    if not tenant_id:
        return ZoneInfo(DEFAULT_TIMEZONE)
    from app.models.tenant import Tenant
    t = await db.get(Tenant, tenant_id)
    return get_zoneinfo(t.timezone if t else None)


# ── Fase 2: fronteras de día/semana/mes en hora local del tenant ──────────────

def tenant_today(tz: ZoneInfo) -> date:
    """Fecha de 'hoy' en la zona del tenant (no la del servidor UTC)."""
    return datetime.now(tz).date()


def local_date_of(dt_utc: datetime, tz: ZoneInfo) -> date:
    """Fecha calendario local del tenant para un instante almacenado en UTC."""
    return dt_utc.astimezone(tz).date()


def parse_local_to_utc(iso_str: str, tz: ZoneInfo) -> datetime:
    """Parsea un ISO 'yyyy-MM-dd' (o con hora) que representa hora de pared del
    tenant y devuelve el instante UTC. Si ya trae offset, solo lo normaliza a UTC."""
    dt = datetime.fromisoformat(iso_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    return dt.astimezone(_utc.utc)


def day_window_utc(d_from: date, d_to: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """Convierte un rango de fechas locales [d_from, d_to] (inclusive) al par de
    instantes UTC [inicio, fin] que cubre esos días completos en la zona del tenant.

    inicio = 00:00:00 local de d_from  →  UTC
    fin    = 23:59:59 local de d_to    →  UTC
    """
    start = datetime(d_from.year, d_from.month, d_from.day, 0, 0, 0, tzinfo=tz).astimezone(_utc.utc)
    end = datetime(d_to.year, d_to.month, d_to.day, 23, 59, 59, tzinfo=tz).astimezone(_utc.utc)
    return start, end
