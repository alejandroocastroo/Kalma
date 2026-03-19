import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.reports import RevenueReport, OccupancyReport
from app.models.space import Space
from app.models.class_session import ClassSession
from app.models.appointment import Appointment

router = APIRouter(prefix="/reports", tags=["Reportes"])


def _require_tenant(current_user) -> None:
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")


async def _get_space_or_404(space_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> Space:
    result = await db.execute(
        select(Space).where(
            Space.id == space_id,
            Space.tenant_id == tenant_id,
        )
    )
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(404, "Espacio no encontrado")
    return space


@router.get("/revenue", response_model=List[RevenueReport])
async def revenue_by_space(
    space_id: Optional[str] = Query(None, description="UUID del espacio. Si se omite, agrega todos los espacios."),
    from_date: str = Query(..., alias="from", description="Fecha inicio YYYY-MM-DD"),
    to_date: str = Query(..., alias="to", description="Fecha fin YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    _require_tenant(current_user)

    start = datetime.fromisoformat(from_date)
    end = datetime.fromisoformat(to_date)

    if space_id:
        # Single space
        space = await _get_space_or_404(uuid.UUID(space_id), current_user.tenant_id, db)
        spaces_to_report = [space]
    else:
        # All active spaces for this tenant
        result = await db.execute(
            select(Space).where(
                Space.tenant_id == current_user.tenant_id,
                Space.is_active == True,
            ).order_by(Space.name)
        )
        spaces_to_report = result.scalars().all()

    reports: List[RevenueReport] = []
    for space in spaces_to_report:
        # Fetch sessions for this space in date range
        sessions_result = await db.execute(
            select(ClassSession).where(
                ClassSession.space_id == space.id,
                ClassSession.tenant_id == current_user.tenant_id,
                ClassSession.start_datetime >= start,
                ClassSession.start_datetime <= end,
                ClassSession.status != "cancelled",
            )
        )
        sessions = sessions_result.scalars().all()
        session_ids = [s.id for s in sessions]

        total_revenue = Decimal("0")
        paid_count = 0

        if session_ids:
            appts_result = await db.execute(
                select(Appointment).where(
                    Appointment.class_session_id.in_(session_ids),
                    Appointment.tenant_id == current_user.tenant_id,
                    Appointment.paid == True,
                    Appointment.status != "cancelled",
                )
            )
            appointments = appts_result.scalars().all()
            for appt in appointments:
                if appt.payment_amount:
                    total_revenue += appt.payment_amount
                paid_count += 1

        reports.append(
            RevenueReport(
                space_id=space.id,
                space_name=space.name,
                total_revenue=total_revenue,
                session_count=len(sessions),
                paid_appointments=paid_count,
            )
        )

    return reports


@router.get("/occupancy", response_model=List[OccupancyReport])
async def occupancy_by_space(
    space_id: Optional[str] = Query(None, description="UUID del espacio. Si se omite, agrega todos los espacios."),
    from_date: str = Query(..., alias="from", description="Fecha inicio YYYY-MM-DD"),
    to_date: str = Query(..., alias="to", description="Fecha fin YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    _require_tenant(current_user)

    start = datetime.fromisoformat(from_date)
    end = datetime.fromisoformat(to_date)

    if space_id:
        space = await _get_space_or_404(uuid.UUID(space_id), current_user.tenant_id, db)
        spaces_to_report = [space]
    else:
        result = await db.execute(
            select(Space).where(
                Space.tenant_id == current_user.tenant_id,
                Space.is_active == True,
            ).order_by(Space.name)
        )
        spaces_to_report = result.scalars().all()

    reports: List[OccupancyReport] = []
    for space in spaces_to_report:
        sessions_result = await db.execute(
            select(ClassSession).where(
                ClassSession.space_id == space.id,
                ClassSession.tenant_id == current_user.tenant_id,
                ClassSession.start_datetime >= start,
                ClassSession.start_datetime <= end,
                ClassSession.status != "cancelled",
            )
        )
        sessions = sessions_result.scalars().all()

        total_sessions = len(sessions)
        fully_booked_count = 0
        fill_rate_sum = 0.0

        for s in sessions:
            cap = s.capacity if s.capacity and s.capacity > 0 else 1
            fill_rate = s.enrolled_count / cap
            fill_rate_sum += fill_rate
            if s.enrolled_count >= cap:
                fully_booked_count += 1

        avg_fill_rate = round(fill_rate_sum / total_sessions, 4) if total_sessions > 0 else 0.0

        reports.append(
            OccupancyReport(
                space_id=space.id,
                space_name=space.name,
                total_sessions=total_sessions,
                avg_fill_rate=avg_fill_rate,
                fully_booked_count=fully_booked_count,
            )
        )

    return reports
