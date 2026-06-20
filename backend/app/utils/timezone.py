"""Utilidades de zona horaria por tenant.

Cada tenant tiene un campo `timezone` (string IANA, ej. "America/Bogota",
"America/Mexico_City"). Toda hora se almacena en UTC; estas utilidades convierten
entre UTC y la hora local del tenant. El default es Bogotá (UTC-5), que preserva
el comportamiento histórico de los tenants colombianos.
"""
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
