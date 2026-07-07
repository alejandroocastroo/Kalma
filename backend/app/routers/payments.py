import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.payment import PaymentCreate, PaymentUpdate, PaymentResponse, CashFlowSummary, SpaceFlowBreakdown
from app.models.payment import Payment
from app.models.client import Client
from app.models.space import Space
from app.models.instructor import Instructor
from app.models.appointment import Appointment
from app.utils.ownership import assert_owned, get_if_owned

router = APIRouter(prefix="/payments", tags=["Pagos / Caja"])


async def _enrich(p: Payment, db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    data = PaymentResponse.model_validate(p).model_dump()
    client = await get_if_owned(db, Client, p.client_id, tenant_id)
    if client:
        data["client_name"] = client.full_name
    space = await get_if_owned(db, Space, p.space_id, tenant_id)
    if space:
        data["space_name"] = space.name
    instructor = await get_if_owned(db, Instructor, p.instructor_id, tenant_id)
    if instructor:
        data["instructor_name"] = instructor.full_name
    return data


@router.get("", response_model=list[PaymentResponse])
async def list_payments(
    start: Optional[str] = None,
    end: Optional[str] = None,
    type: Optional[str] = None,
    space_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    q = select(Payment).where(Payment.tenant_id == current_user.tenant_id)
    if start:
        q = q.where(Payment.payment_date >= date.fromisoformat(start))
    if end:
        q = q.where(Payment.payment_date <= date.fromisoformat(end))
    if type:
        q = q.where(Payment.type == type)
    if space_id:
        q = q.where(Payment.space_id == uuid.UUID(space_id))
    result = await db.execute(q.order_by(Payment.payment_date.desc()))
    payments = result.scalars().all()
    return [await _enrich(p, db, current_user.tenant_id) for p in payments]


@router.get("/summary", response_model=CashFlowSummary)
async def payment_summary(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    q = select(Payment).where(Payment.tenant_id == current_user.tenant_id)
    if start:
        q = q.where(Payment.payment_date >= date.fromisoformat(start))
    if end:
        q = q.where(Payment.payment_date <= date.fromisoformat(end))
    result = await db.execute(q)
    payments = result.scalars().all()

    # Bulk-load all spaces for this tenant to avoid N+1 on by_space resolution
    spaces_result = await db.execute(
        select(Space).where(Space.tenant_id == current_user.tenant_id)
    )
    space_name_by_id: dict[uuid.UUID, str] = {
        s.id: s.name for s in spaces_result.scalars().all()
    }

    total_income = Decimal("0")
    total_expenses = Decimal("0")
    by_category: dict[str, Decimal] = {}
    by_method: dict[str, Decimal] = {}
    by_space: dict[str, SpaceFlowBreakdown] = {}
    income_count = 0
    expense_count = 0

    for p in payments:
        is_income = p.type == "income"
        if is_income:
            total_income += p.amount
            income_count += 1
        else:
            total_expenses += p.amount
            expense_count += 1

        by_category[p.category] = by_category.get(p.category, Decimal("0")) + p.amount
        by_method[p.payment_method] = by_method.get(p.payment_method, Decimal("0")) + p.amount

        space_label = space_name_by_id.get(p.space_id, "General") if p.space_id else "General"
        if space_label not in by_space:
            by_space[space_label] = SpaceFlowBreakdown()
        bucket = by_space[space_label]
        if is_income:
            bucket.income += p.amount
        else:
            bucket.expenses += p.amount
        bucket.net = bucket.income - bucket.expenses

    return CashFlowSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        net=total_income - total_expenses,
        by_category=by_category,
        by_method=by_method,
        by_space=by_space,
        income_count=income_count,
        expense_count=expense_count,
    )


@router.post("", response_model=PaymentResponse, status_code=201)
async def create_payment(
    body: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    # Validar que toda FK entrante pertenezca al tenant (evita fuga cross-tenant)
    await assert_owned(db, Client, body.client_id, current_user.tenant_id, "Cliente no encontrado")
    await assert_owned(db, Space, body.space_id, current_user.tenant_id, "Espacio no encontrado")
    await assert_owned(db, Instructor, body.instructor_id, current_user.tenant_id, "Instructor no encontrado")
    await assert_owned(db, Appointment, body.appointment_id, current_user.tenant_id, "Cita no encontrada")
    payment = Payment(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        **body.model_dump(),
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return await _enrich(payment, db, current_user.tenant_id)


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: str,
    body: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Payment).where(
            Payment.id == uuid.UUID(payment_id),
            Payment.tenant_id == current_user.tenant_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Pago no encontrado")
    # Validar FKs entrantes contra el tenant antes de reasignarlas
    await assert_owned(db, Space, body.space_id, current_user.tenant_id, "Espacio no encontrado")
    await assert_owned(db, Instructor, body.instructor_id, current_user.tenant_id, "Instructor no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(payment, field, value)
    await db.commit()
    await db.refresh(payment)
    return await _enrich(payment, db, current_user.tenant_id)


@router.delete("/{payment_id}")
async def delete_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Payment).where(
            Payment.id == uuid.UUID(payment_id),
            Payment.tenant_id == current_user.tenant_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Pago no encontrado")
    await db.delete(payment)
    await db.commit()
    return {"message": "Pago eliminado"}
