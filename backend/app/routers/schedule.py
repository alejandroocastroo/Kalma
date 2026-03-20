import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

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
    Auto-generate class sessions for a date range based on the tenant's
    studio schedule and exceptions.
    """
    _require_tenant(current_user)
    _require_admin(current_user)

    tenant_id = current_user.tenant_id

    # 1. Load the tenant's full weekly schedule keyed by day_of_week
    sched_result = await db.execute(
        select(StudioSchedule).where(StudioSchedule.tenant_id == tenant_id)
    )
    schedule_map: dict[int, StudioSchedule] = {
        r.day_of_week: r for r in sched_result.scalars().all()
    }

    # 2. Load all exceptions in the date range
    exc_result = await db.execute(
        select(ScheduleException).where(
            ScheduleException.tenant_id == tenant_id,
            ScheduleException.date >= body.from_date,
            ScheduleException.date <= body.to_date,
        )
    )
    exception_map: dict[date, ScheduleException] = {
        e.date: e for e in exc_result.scalars().all()
    }

    # 3. Resolve space_id (required) and class_type_id (optional) to UUIDs
    space_uuid = uuid.UUID(body.space_id)
    space = await db.get(Space, space_uuid)
    if not space or space.tenant_id != tenant_id:
        raise HTTPException(404, "Espacio no encontrado")
    resolved_capacity = space.capacity

    class_type_uuid: uuid.UUID | None = uuid.UUID(body.class_type_id) if body.class_type_id else None

    # 4. Bulk-load existing sessions in range to avoid per-slot DB hits when
    #    skip_existing=True. We fetch all sessions for this tenant in the
    #    date range and index them by (date, start_hour, space_id).
    existing_sessions: set[tuple] = set()
    if body.skip_existing or space_uuid is not None:
        range_start = datetime(
            body.from_date.year, body.from_date.month, body.from_date.day,
            0, 0, 0, tzinfo=timezone.utc,
        )
        range_end = datetime(
            body.to_date.year, body.to_date.month, body.to_date.day,
            23, 59, 59, tzinfo=timezone.utc,
        )
        sessions_result = await db.execute(
            select(ClassSession).where(
                ClassSession.tenant_id == tenant_id,
                ClassSession.status != "cancelled",
                ClassSession.start_datetime >= range_start,
                ClassSession.start_datetime <= range_end,
            )
        )
        for s in sessions_result.scalars().all():
            s_date = s.start_datetime.date()
            s_hour = s.start_datetime.hour
            existing_sessions.add((s_date, s_hour, s.space_id))

    # 5. Iterate over every date in the range
    created = 0
    skipped = 0
    dates_processed = 0

    current_date = body.from_date
    delta = timedelta(days=1)

    while current_date <= body.to_date:
        dates_processed += 1
        dow = current_date.weekday()  # 0=Monday, 6=Sunday — matches our convention

        # a. Check if studio is open this day of week
        day_schedule = schedule_map.get(dow)
        if day_schedule is None:
            # No record means use defaults: Sun closed, others open
            is_open = dow != 6
            open_hour = _DEFAULT_OPEN_HOUR
            close_hour = _DEFAULT_CLOSE_HOUR
        else:
            is_open = day_schedule.is_active
            open_hour = day_schedule.open_hour
            close_hour = day_schedule.close_hour

        if not is_open:
            current_date += delta
            continue

        # b. Check for a closing exception on this date
        exc = exception_map.get(current_date)
        if exc is not None and exc.is_closed:
            current_date += delta
            continue

        # c. Generate one session per hour slot
        for hour in range(open_hour, close_hour):
            start_dt = datetime(
                current_date.year, current_date.month, current_date.day,
                hour, 0, 0, tzinfo=timezone.utc,
            )
            end_dt = start_dt + timedelta(hours=1)

            # skip_existing: check whether a session at this slot already exists
            if body.skip_existing:
                key = (current_date, hour, space_uuid)
                if key in existing_sessions:
                    skipped += 1
                    continue

            # Space overlap guard: skip (not error) if occupied
            if space_uuid is not None:
                key = (current_date, hour, space_uuid)
                if key in existing_sessions:
                    skipped += 1
                    continue

            session = ClassSession(
                tenant_id=tenant_id,
                class_type_id=class_type_uuid,
                space_id=space_uuid,
                start_datetime=start_dt,
                end_datetime=end_dt,
                capacity=resolved_capacity,
                enrolled_count=0,
                status="scheduled",
            )
            db.add(session)
            # Track in-memory so subsequent slots in the same batch don't
            # double-book when the session is not flushed yet.
            existing_sessions.add((current_date, hour, space_uuid))
            created += 1

        current_date += delta

    await db.commit()

    return GenerateSessionsResponse(
        created=created,
        skipped=skipped,
        dates_processed=dates_processed,
    )
