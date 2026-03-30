import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.plan import Plan
from app.models.client_membership import ClientMembership
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse

router = APIRouter(prefix="/plans", tags=["Planes"])


@router.get("", response_model=list[PlanResponse])
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
    return result.scalars().all()


@router.post("", response_model=PlanResponse, status_code=201)
async def create_plan(
    body: PlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    plan = Plan(tenant_id=current_user.tenant_id, **body.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    plan = await db.get(Plan, uuid.UUID(plan_id))
    if not plan or plan.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Plan no encontrado")
    return plan


@router.put("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: str,
    body: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    plan = await db.get(Plan, uuid.UUID(plan_id))
    if not plan or plan.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Plan no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    plan = await db.get(Plan, uuid.UUID(plan_id))
    if not plan or plan.tenant_id != current_user.tenant_id:
        raise HTTPException(404, "Plan no encontrado")

    # Check for active memberships
    count_q = select(func.count()).select_from(ClientMembership).where(
        ClientMembership.plan_id == plan.id,
        ClientMembership.status == "active",
    )
    active_count = (await db.execute(count_q)).scalar() or 0
    if active_count > 0:
        raise HTTPException(400, f"No se puede eliminar: el plan tiene {active_count} membresía(s) activa(s)")

    await db.delete(plan)
    await db.commit()
