import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.space import SpaceCreate, SpaceUpdate, SpaceResponse, SpaceAvailabilitySlot
from app.models.space import Space
from app.models.class_session import ClassSession

router = APIRouter(prefix="/spaces", tags=["Espacios"])

AVAILABILITY_HOURS = range(6, 22)  # 6am to 9pm inclusive (hour 6 through 21)


def _require_admin(current_user) -> None:
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(403, "Se requiere rol de administrador")


def _require_tenant(current_user) -> None:
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")


@router.get("", response_model=List[SpaceResponse])
async def list_spaces(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    _require_tenant(current_user)
    result = await db.execute(
        select(Space)
        .where(
            Space.tenant_id == current_user.tenant_id,
            Space.is_active == True,
        )
        .order_by(Space.name)
    )
    return result.scalars().all()


@router.post("", response_model=SpaceResponse, status_code=201)
async def create_space(
    body: SpaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    _require_tenant(current_user)
    _require_admin(current_user)
    space = Space(tenant_id=current_user.tenant_id, **body.model_dump())
    db.add(space)
    await db.commit()
    await db.refresh(space)
    return space


@router.put("/{space_id}", response_model=SpaceResponse)
async def update_space(
    space_id: str,
    body: SpaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    _require_tenant(current_user)
    _require_admin(current_user)
    result = await db.execute(
        select(Space).where(
            Space.id == uuid.UUID(space_id),
            Space.tenant_id == current_user.tenant_id,
        )
    )
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(404, "Espacio no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(space, field, value)
    await db.commit()
    await db.refresh(space)
    return space


@router.delete("/{space_id}")
async def deactivate_space(
    space_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    _require_tenant(current_user)
    _require_admin(current_user)
    result = await db.execute(
        select(Space).where(
            Space.id == uuid.UUID(space_id),
            Space.tenant_id == current_user.tenant_id,
        )
    )
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(404, "Espacio no encontrado")
    space.is_active = False
    await db.commit()
    return {"message": "Espacio desactivado"}


@router.get("/{space_id}/availability", response_model=List[SpaceAvailabilitySlot])
async def space_availability(
    space_id: str,
    date: str = Query(..., description="Fecha en formato YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    _require_tenant(current_user)

    result = await db.execute(
        select(Space).where(
            Space.id == uuid.UUID(space_id),
            Space.tenant_id == current_user.tenant_id,
        )
    )
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(404, "Espacio no encontrado")

    target_date = datetime.fromisoformat(date).date()

    # Fetch all non-cancelled sessions for this space on the given date in one query
    sessions_result = await db.execute(
        select(ClassSession).where(
            ClassSession.space_id == space.id,
            ClassSession.tenant_id == current_user.tenant_id,
            ClassSession.status != "cancelled",
            func.date(ClassSession.start_datetime) == target_date,
        )
    )
    sessions = sessions_result.scalars().all()

    # Build a mapping from hour -> count of sessions starting in that hour
    bookings_by_hour: dict[int, int] = {}
    for s in sessions:
        # Convert to local naive hour (start_datetime stored as UTC-aware)
        hour = s.start_datetime.hour
        bookings_by_hour[hour] = bookings_by_hour.get(hour, 0) + 1

    slots: List[SpaceAvailabilitySlot] = []
    for hour in AVAILABILITY_HOURS:
        booked = bookings_by_hour.get(hour, 0)
        available = max(space.capacity - booked, 0)
        slots.append(
            SpaceAvailabilitySlot(
                hour=hour,
                booked=booked,
                available=available,
                is_full=booked >= space.capacity,
            )
        )
    return slots
