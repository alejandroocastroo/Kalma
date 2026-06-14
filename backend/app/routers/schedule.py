import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.studio_schedule import StudioSchedule
from app.models.schedule_exception import ScheduleException
from app.models.class_session import ClassSession
from app.models.space import Space
from app.models.appointment import Appointment
from app.models.client import Client
from app.models.class_type import ClassType
from app.schemas.schedule import (
    DAY_NAMES_ES,
    ScheduleDay,
    ScheduleDayUpdate,
    ScheduleExceptionCreate,
    ScheduleExceptionResponse,
    GenerateSessionsRequest,
    GenerateSessionsResponse,
)

router = APIRouter(prefix="/schedule", tags=["Horario del Estudio"])

_DEFAULT_OPEN_HOUR = 6
_DEFAULT_CLOSE_HOUR = 21

# Colombia is permanently UTC-5 (no DST since 1993)
_BOGOTA_UTC_OFFSET = 5


def _require_tenant(current_user) -> None:
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")


def _require_admin(current_user) -> None:
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(403, "Se requiere rol de administrador")


def _schedule_to_day(record: StudioSchedule | None, day_of_week: int) -> ScheduleDay:
    """Convert a DB record (or None for a missing day) to a ScheduleDay response."""
    if record is None:
        return ScheduleDay(
            id=None,
            day_of_week=day_of_week,
            day_name=DAY_NAMES_ES[day_of_week],
            is_active=day_of_week != 6,  # Sunday closed by default
            open_hour=_DEFAULT_OPEN_HOUR,
            close_hour=_DEFAULT_CLOSE_HOUR,
        )
    return ScheduleDay(
        id=str(record.id),
        day_of_week=record.day_of_week,
        day_name=DAY_NAMES_ES[record.day_of_week],
        is_active=record.is_active,
        open_hour=record.open_hour,
        close_hour=record.close_hour,
    )


# ---------------------------------------------------------------------------
# Schedule CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=List[ScheduleDay])
async def get_schedule(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Return the full 7-day schedule for the tenant."""
    _require_tenant(current_user)

    result = await db.execute(
        select(StudioSchedule)
        .where(StudioSchedule.tenant_id == current_user.tenant_id)
        .order_by(StudioSchedule.day_of_week)
    )
    records = {r.day_of_week: r for r in result.scalars().all()}

    return [_schedule_to_day(records.get(dow), dow) for dow in range(7)]


@router.put("/{day_of_week}", response_model=ScheduleDay)
async def update_schedule_day(
    day_of_week: int,
    body: ScheduleDayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Upsert a single day's schedule (0=Monday … 6=Sunday)."""
    _require_tenant(current_user)
    _require_admin(current_user)

    if day_of_week < 0 or day_of_week > 6:
        raise HTTPException(400, "day_of_week debe estar entre 0 y 6")

    result = await db.execute(
        select(StudioSchedule).where(
            StudioSchedule.tenant_id == current_user.tenant_id,
            StudioSchedule.day_of_week == day_of_week,
        )
    )
    record = result.scalar_one_or_none()

    if record is None:
        record = StudioSchedule(
            tenant_id=current_user.tenant_id,
            day_of_week=day_of_week,
            is_active=body.is_active,
            open_hour=body.open_hour,
            close_hour=body.close_hour,
        )
        db.add(record)
    else:
        record.is_active = body.is_active
        record.open_hour = body.open_hour
        record.close_hour = body.close_hour

    await db.commit()
    await db.refresh(record)
    return _schedule_to_day(record, day_of_week)


# ---------------------------------------------------------------------------
# Schedule exceptions CRUD
# ---------------------------------------------------------------------------

@router.get("/exceptions", response_model=List[ScheduleExceptionResponse])
async def list_exceptions(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """List schedule exceptions within a date range."""
    _require_tenant(current_user)

    result = await db.execute(
        select(ScheduleException)
        .where(
            ScheduleException.tenant_id == current_user.tenant_id,
            ScheduleException.date >= from_date,
            ScheduleException.date <= to_date,
        )
        .order_by(ScheduleException.date)
    )
    exceptions = result.scalars().all()
    return [
        ScheduleExceptionResponse(
            id=str(e.id),
            date=e.date,
            reason=e.reason,
            is_closed=e.is_closed,
        )
        for e in exceptions
    ]


@router.post("/exceptions", response_model=ScheduleExceptionResponse, status_code=201)
async def create_exception(
    body: ScheduleExceptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Add a schedule exception for a specific date."""
    _require_tenant(current_user)
    _require_admin(current_user)

    # Check for duplicate
    existing = await db.execute(
        select(ScheduleException).where(
            ScheduleException.tenant_id == current_user.tenant_id,
            ScheduleException.date == body.date,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Ya existe una excepción para esa fecha")

    exc = ScheduleException(
        tenant_id=current_user.tenant_id,
        date=body.date,
        reason=body.reason,
        is_closed=body.is_closed,
    )
    db.add(exc)
    await db.commit()
    await db.refresh(exc)
    return ScheduleExceptionResponse(
        id=str(exc.id),
        date=exc.date,
        reason=exc.reason,
        is_closed=exc.is_closed,
    )


@router.delete("/exceptions/{exception_id}")
async def delete_exception(
    exception_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Remove a schedule exception."""
    _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(ScheduleException).where(
            ScheduleException.id == uuid.UUID(exception_id),
            ScheduleException.tenant_id == current_user.tenant_id,
        )
    )
    exc = result.scalar_one_or_none()
    if not exc:
        raise HTTPException(404, "Excepción no encontrada")

    await db.delete(exc)
    await db.commit()
    return {"message": "Excepción eliminada"}


# ---------------------------------------------------------------------------
# Generate sessions
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=GenerateSessionsResponse)
async def generate_sessions(
    body: GenerateSessionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Auto-generate one session per hour for every day in the date range.
    open_hour / close_hour are interpreted as Bogotá local time (UTC-5).
    Sessions are stored in UTC so the frontend calendar displays them correctly.
    """
    _require_tenant(current_user)
    _require_admin(current_user)

    tenant_id = current_user.tenant_id

    open_hour = body.open_hour if body.open_hour is not None else _DEFAULT_OPEN_HOUR
    close_hour = body.close_hour if body.close_hour is not None else _DEFAULT_CLOSE_HOUR

    # 1. Resolve space
    space_uuid = uuid.UUID(body.space_id)
    space = await db.get(Space, space_uuid)
    if not space or space.tenant_id != tenant_id:
        raise HTTPException(404, "Espacio no encontrado")
    resolved_capacity = space.capacity

    # 2. Pre-load existing sessions to skip duplicates.
    #    Since sessions are stored in UTC but our keys use Bogotá local
    #    (date + local_hour), extend the query window by the UTC offset
    #    so we don't miss evening sessions stored on the next UTC day.
    bogota_offset = timedelta(hours=_BOGOTA_UTC_OFFSET)
    range_start_utc = datetime(
        body.from_date.year, body.from_date.month, body.from_date.day,
        0, 0, 0, tzinfo=timezone.utc,
    ) + bogota_offset  # midnight Bogotá = 05:00 UTC

    range_end_utc = datetime(
        body.to_date.year, body.to_date.month, body.to_date.day,
        23, 59, 59, tzinfo=timezone.utc,
    ) + bogota_offset  # 23:59 Bogotá = 04:59 UTC next day

    sessions_result = await db.execute(
        select(ClassSession).where(
            ClassSession.tenant_id == tenant_id,
            ClassSession.status != "cancelled",
            ClassSession.start_datetime >= range_start_utc,
            ClassSession.start_datetime <= range_end_utc,
        )
    )
    # Index by (local Bogotá date, local Bogotá hour, space_id)
    existing_sessions: set[tuple] = set()
    for s in sessions_result.scalars().all():
        local_dt = s.start_datetime - bogota_offset
        existing_sessions.add((local_dt.date(), local_dt.hour, s.space_id))

    # 3. Iterate every day in the range and create one session per hour slot
    created = 0
    skipped = 0
    dates_processed = 0

    current_date = body.from_date
    delta = timedelta(days=1)
    blocked_date_set = set(body.blocked_dates or [])

    while current_date <= body.to_date:
        if current_date in blocked_date_set:
            current_date += delta
            continue
        dates_processed += 1

        # close_hour is inclusive: last session STARTS at close_hour
        blocked = set(body.blocked_hours or [])
        for hour in range(open_hour, close_hour + 1):
            if hour in blocked:
                skipped += 1
                continue
            key = (current_date, hour, space_uuid)
            if key in existing_sessions:
                skipped += 1
                continue

            # Convert Bogotá local time → UTC for storage
            # UTC = Bogotá + 5h  (Colombia is permanently UTC-5)
            start_dt = datetime(
                current_date.year, current_date.month, current_date.day,
                0, 0, 0, tzinfo=timezone.utc,
            ) + timedelta(hours=hour + _BOGOTA_UTC_OFFSET)
            end_dt = start_dt + timedelta(hours=1)

            session = ClassSession(
                tenant_id=tenant_id,
                class_type_id=None,
                space_id=space_uuid,
                start_datetime=start_dt,
                end_datetime=end_dt,
                capacity=resolved_capacity,
                enrolled_count=0,
                status="scheduled",
            )
            db.add(session)
            existing_sessions.add(key)
            created += 1

        current_date += delta

    await db.commit()

    return GenerateSessionsResponse(
        created=created,
        skipped=skipped,
        dates_processed=dates_processed,
    )


# ---------------------------------------------------------------------------
# Holidays
# ---------------------------------------------------------------------------

SUPPORTED_COUNTRIES = {"CO", "MX", "US", "ES", "AR", "PE", "CL", "EC", "VE", "PA"}

@router.get("/holidays")
async def get_holidays(
    from_date: date = Query(..., description="Fecha inicio 'yyyy-MM-dd'"),
    to_date: date = Query(..., description="Fecha fin 'yyyy-MM-dd'"),
    country: str = Query("CO", description="Código de país ISO-3166 (CO, MX, US…)"),
    current_user=Depends(get_current_active_user),
):
    """
    Devuelve los días festivos en el rango dado para el país especificado.
    Respuesta: [{"date": "2026-05-01", "name": "Día del Trabajo"}, ...]
    """
    import holidays as hol

    country = country.upper()
    if country not in SUPPORTED_COUNTRIES:
        raise HTTPException(400, f"País '{country}' no soportado. Use: {', '.join(sorted(SUPPORTED_COUNTRIES))}")

    if (to_date - from_date).days > 366:
        raise HTTPException(400, "El rango no puede superar 366 días")

    years = set(range(from_date.year, to_date.year + 1))
    try:
        country_holidays = hol.country_holidays(country, years=years)
    except Exception:
        raise HTTPException(400, f"No se pudieron cargar los festivos para '{country}'")

    result = []
    current = from_date
    while current <= to_date:
        if current in country_holidays:
            result.append({"date": current.isoformat(), "name": country_holidays[current]})
        current += timedelta(days=1)

    return result


# ---------------------------------------------------------------------------
# Holiday conflict detection
# ---------------------------------------------------------------------------

@router.get("/holiday-conflicts")
async def get_holiday_conflicts(
    from_date: date = Query(..., description="Fecha inicio 'yyyy-MM-dd'"),
    to_date: date = Query(..., description="Fecha fin 'yyyy-MM-dd'"),
    country: str = Query("CO", description="Código de país ISO-3166"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Retorna festivos con sesiones activas programadas en esas fechas.
    Cada festivo incluye sus sesiones y los clientes inscritos.
    """
    _require_tenant(current_user)
    import holidays as hol

    country = country.upper()
    if country not in SUPPORTED_COUNTRIES:
        raise HTTPException(400, f"País '{country}' no soportado")

    if (to_date - from_date).days > 366:
        raise HTTPException(400, "El rango no puede superar 366 días")

    years = set(range(from_date.year, to_date.year + 1))
    try:
        country_holidays = hol.country_holidays(country, years=years)
    except Exception:
        raise HTTPException(400, f"No se pudieron cargar los festivos para '{country}'")

    # Collect holiday dates in range
    holiday_list: list[tuple[date, str]] = []
    cur = from_date
    while cur <= to_date:
        if cur in country_holidays:
            holiday_list.append((cur, country_holidays[cur]))
        cur += timedelta(days=1)

    if not holiday_list:
        return []

    bogota_offset = timedelta(hours=_BOGOTA_UTC_OFFSET)
    result = []

    for hol_date, hol_name in holiday_list:
        # Bogotá midnight → UTC window for the full day
        day_start_utc = datetime(
            hol_date.year, hol_date.month, hol_date.day, 0, 0, 0, tzinfo=timezone.utc
        ) + bogota_offset
        day_end_utc = datetime(
            hol_date.year, hol_date.month, hol_date.day, 23, 59, 59, tzinfo=timezone.utc
        ) + bogota_offset

        sessions_result = await db.execute(
            select(ClassSession).where(
                ClassSession.tenant_id == current_user.tenant_id,
                ClassSession.status != "cancelled",
                ClassSession.start_datetime >= day_start_utc,
                ClassSession.start_datetime <= day_end_utc,
            ).order_by(ClassSession.start_datetime)
        )
        sessions = sessions_result.scalars().all()
        if not sessions:
            continue

        sessions_data = []
        for session in sessions:
            space_name = None
            class_type_name = session.custom_name

            if session.space_id:
                space = await db.get(Space, session.space_id)
                if space:
                    space_name = space.name
            if not class_type_name and session.class_type_id:
                ct = await db.get(ClassType, session.class_type_id)
                if ct:
                    class_type_name = ct.name
            if not class_type_name:
                class_type_name = space_name

            # Load appointments + client names in one join query
            appts_result = await db.execute(
                select(Appointment, Client).join(
                    Client, Appointment.client_id == Client.id
                ).where(
                    Appointment.class_session_id == session.id,
                    Appointment.status.notin_(["cancelled"]),
                )
            )
            appts_data = [
                {
                    "id": str(appt.id),
                    "client_id": str(appt.client_id),
                    "client_name": client.full_name,
                    "status": appt.status,
                }
                for appt, client in appts_result.all()
            ]

            sessions_data.append({
                "id": str(session.id),
                "start_datetime": session.start_datetime.isoformat(),
                "space_name": space_name,
                "class_type_name": class_type_name,
                "enrolled_count": session.enrolled_count,
                "appointments": appts_data,
            })

        result.append({
            "date": hol_date.isoformat(),
            "holiday_name": hol_name,
            "sessions": sessions_data,
        })

    return result
