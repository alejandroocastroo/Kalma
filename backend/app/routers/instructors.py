import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.instructor import Instructor
from app.models.class_session import ClassSession
from app.models.space import Space
from app.models.class_type import ClassType

router = APIRouter(prefix="/instructors", tags=["Instructores"])


class InstructorCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class InstructorUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


def _enrich(inst: Instructor, sessions_count: int = 0, sessions_this_month: int = 0) -> dict:
    return {
        "id": str(inst.id),
        "email": inst.email,
        "full_name": inst.full_name,
        "phone": inst.phone,
        "role": "instructor",
        "is_active": inst.is_active,
        "tenant_id": str(inst.tenant_id),
        "created_at": inst.created_at.isoformat(),
        "sessions_count": sessions_count,
        "sessions_this_month": sessions_this_month,
    }


@router.get("")
async def list_instructors(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    result = await db.execute(
        select(Instructor).where(
            Instructor.tenant_id == current_user.tenant_id,
        ).order_by(Instructor.full_name)
    )
    instructor_list = result.scalars().all()

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    enriched = []
    for inst in instructor_list:
        total = (await db.execute(
            select(func.count()).select_from(ClassSession).where(
                ClassSession.instructor_id == inst.id,
                ClassSession.tenant_id == current_user.tenant_id,
                ClassSession.status != "cancelled",
            )
        )).scalar() or 0
        this_month = (await db.execute(
            select(func.count()).select_from(ClassSession).where(
                ClassSession.instructor_id == inst.id,
                ClassSession.tenant_id == current_user.tenant_id,
                ClassSession.status != "cancelled",
                ClassSession.start_datetime >= month_start,
            )
        )).scalar() or 0
        enriched.append(_enrich(inst, total, this_month))
    return enriched


@router.post("", status_code=201)
async def create_instructor(
    body: InstructorCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    instructor = Instructor(
        tenant_id=current_user.tenant_id,
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        is_active=True,
    )
    db.add(instructor)
    await db.commit()
    await db.refresh(instructor)
    return _enrich(instructor)


@router.put("/{instructor_id}")
async def update_instructor(
    instructor_id: str,
    body: InstructorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Instructor).where(
            Instructor.id == uuid.UUID(instructor_id),
            Instructor.tenant_id == current_user.tenant_id,
        )
    )
    instructor = result.scalar_one_or_none()
    if not instructor:
        raise HTTPException(404, "Instructor no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(instructor, field, value)
    await db.commit()
    await db.refresh(instructor)
    return _enrich(instructor)


@router.get("/{instructor_id}/sessions")
async def instructor_sessions(
    instructor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(ClassSession).where(
            ClassSession.instructor_id == uuid.UUID(instructor_id),
            ClassSession.tenant_id == current_user.tenant_id,
        ).order_by(ClassSession.start_datetime.desc()).limit(100)
    )
    sessions = result.scalars().all()
    enriched = []
    for s in sessions:
        space_name = None
        if s.space_id:
            space = await db.get(Space, s.space_id)
            if space:
                space_name = space.name
        class_type_name = None
        if s.class_type_id:
            ct = await db.get(ClassType, s.class_type_id)
            if ct:
                class_type_name = ct.name
        enriched.append({
            "id": str(s.id),
            "start_datetime": s.start_datetime.isoformat(),
            "end_datetime": s.end_datetime.isoformat(),
            "space_name": space_name,
            "class_type_name": s.custom_name or class_type_name or space_name,
            "status": s.status,
            "enrolled_count": s.enrolled_count,
            "capacity": s.capacity,
        })
    return enriched
