import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.plan import Plan
from app.models.space import Space
from app.models.client_membership import ClientMembership
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse

router = APIRouter(prefix="/plans", tags=["Planes"])


async def _enrich_plan(plan: Plan, db: AsyncSession) -> dict:
    data = PlanResponse.model_validate(plan).model_dump()
    if plan.space_id:
        space = await db.get(Space, plan.space_id)
        data["space_name"] = space.name if space else None
    if plan.sessions_per_week:
        data["total_sessions"] = plan.sessions_per_week * 4
    return data


@router.get("")
async def list_plans(
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    q = select(Plan).where(Plan.tenant_id == current_user.tenant_id)
    if is_active is not None:
        q = q.where(Plan.is_active == is_active)
    q = q.order_by(Plan.name)
    result = await db.execute(q)
    plans = result.scalars().all()
    return [await _enrich_plan(p, db) for p in plans]


@router.post("", status_code=201)
async def create_plan(
    body: PlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    data = body.model_dump()
    if body.sessions_per_week:
        data["total_sessions"] = body.sessions_per_week * 4
        data["classes_per_week"] = body.sessions_per_week
    plan = Plan(tenant_id=current_user.tenant_id, **data)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return await _enrich_plan(plan, db)


@router.get("/{plan_id}")
async def get_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    plan = await db.get(Plan, uuid.UUID(plan_id))
    if not plan or plan.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Plan no encontrado")
    return await _enrich_plan(plan, db)


@router.put("/{plan_id}")
async def update_plan(
    plan_id: str,
    body: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    plan = await db.get(Plan, uuid.UUID(plan_id))
    if not plan or plan.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Plan no encontrado")
    data = body.model_dump(exclude_none=True)
    if "sessions_per_week" in data:
        data["total_sessions"] = data["sessions_per_week"] * 4
        data["classes_per_week"] = data["sessions_per_week"]
    for field, value in data.items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)
    return await _enrich_plan(plan, db)


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    plan = await db.get(Plan, uuid.UUID(plan_id))
    if not plan or plan.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Plan no encontrado")

    count_q = select(func.count()).select_from(ClientMembership).where(
        ClientMembership.plan_id == plan.id,
        ClientMembership.status == "active",
    )
    active_count = (await db.execute(count_q)).scalar() or 0
    if active_count > 0:
        raise HTTPException(400, f"No se puede eliminar: el plan tiene {active_count} membresía(s) activa(s)")

    await db.delete(plan)
    await db.commit()
