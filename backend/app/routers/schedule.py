import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.studio_schedule import StudioSchedule
from app.models.schedule_exception import ScheduleException
from app.models.class_session import ClassSession
from app.models.space import Space
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

    while current_date <= body.to_date:
        dates_processed += 1

        # close_hour is inclusive: last session STARTS at close_hour
        for hour in range(open_hour, close_hour + 1):
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
