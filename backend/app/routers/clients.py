import uuid
import math
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, extract
from sqlalchemy.exc import IntegrityError
from typing import Optional

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.schemas.common import PaginatedResponse
from app.models.client import Client
from app.models.client_membership import ClientMembership
from app.models.plan import Plan

router = APIRouter(prefix="/clients", tags=["Clientes"])


@router.get("", response_model=PaginatedResponse[ClientResponse])
async def list_clients(
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    q = select(Client).where(Client.tenant_id == current_user.tenant_id)
    if is_active is not None:
        q = q.where(Client.is_active == is_active)
    if search:
        q = q.where(
            or_(
                Client.full_name.ilike(f"%{search}%"),
                Client.email.ilike(f"%{search}%"),
                Client.phone.ilike(f"%{search}%"),
            )
        )
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    q = q.order_by(Client.full_name).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()

    # Batch-fetch active membership for each client (2 queries total, no N+1)
    client_ids = [c.id for c in items]
    mem_map: dict = {}
    if client_ids:
        mem_rows = await db.execute(
            select(
                ClientMembership.client_id,
                Plan.name.label("plan_name"),
                ClientMembership.membership_type,
                ClientMembership.created_at,
            )
            .join(Plan, ClientMembership.plan_id == Plan.id, isouter=True)
            .where(
                ClientMembership.client_id.in_(client_ids),
                ClientMembership.tenant_id == current_user.tenant_id,
                ClientMembership.status == "active",
            )
            .order_by(ClientMembership.client_id, ClientMembership.created_at.desc())
            .distinct(ClientMembership.client_id)
        )
        for row in mem_rows:
            mem_map[row.client_id] = {
                "active_plan_name": row.plan_name,
                "active_membership_type": row.membership_type,
            }

    enriched = []
    for c in items:
        d = ClientResponse.model_validate(c).model_dump()
        d.update(mem_map.get(c.id, {"active_plan_name": None, "active_membership_type": None}))
        enriched.append(d)

    return PaginatedResponse(
        items=enriched,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.post("", response_model=ClientResponse, status_code=201)
async def create_client(
    body: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    client = Client(tenant_id=current_user.tenant_id, **body.model_dump())
    db.add(client)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Ya existe un cliente con ese número de documento")
    await db.refresh(client)
    return client


@router.get("/birthdays", response_model=list[ClientResponse])
async def birthdays_two_months(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    today = date.today()
    this_month = today.month
    # Next month wrapping December → January
    next_month = 1 if this_month == 12 else this_month + 1
    result = await db.execute(
        select(Client)
        .where(
            Client.tenant_id == current_user.tenant_id,
            Client.is_active == True,
            Client.birth_date.isnot(None),
            or_(
                extract("month", Client.birth_date) == this_month,
                extract("month", Client.birth_date) == next_month,
            ),
        )
        .order_by(
            extract("month", Client.birth_date),
            extract("day", Client.birth_date),
        )
    )
    return result.scalars().all()


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Client).where(
            Client.id == uuid.UUID(client_id),
            Client.tenant_id == current_user.tenant_id,
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Cliente no encontrado")
    return client


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Client).where(
            Client.id == uuid.UUID(client_id),
            Client.tenant_id == current_user.tenant_id,
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Cliente no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Ya existe un cliente con ese número de documento")
    await db.refresh(client)
    return client


@router.get("/{client_id}/appointments")
async def client_appointments(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from app.models.appointment import Appointment
    from app.models.class_session import ClassSession
    from app.models.class_type import ClassType
    from app.models.space import Space
    from datetime import timezone, timedelta

    BOGOTA_TZ = timezone(timedelta(hours=-5))

    result = await db.execute(
        select(Appointment)
        .join(ClassSession, Appointment.class_session_id == ClassSession.id)
        .where(
            Appointment.client_id == uuid.UUID(client_id),
            Appointment.tenant_id == current_user.tenant_id,
        )
        .order_by(ClassSession.start_datetime.desc())
        .limit(50)
    )
    appointments = result.scalars().all()
    client_obj = await db.get(Client, uuid.UUID(client_id))
    client_name = client_obj.full_name if client_obj else None
    client_phone = client_obj.phone if client_obj else None
    enriched = []
    for appt in appointments:
        session = await db.get(ClassSession, appt.class_session_id)
        ct_name = None
        space_name = None
        session_start_local = None
        if session:
            if session.class_type_id:
                ct = await db.get(ClassType, session.class_type_id)
                ct_name = ct.name if ct else None
            if session.space_id:
                space = await db.get(Space, session.space_id)
                space_name = space.name if space else None
                if not ct_name:
                    ct_name = space_name
            # Convertir UTC → Bogotá para mostrar hora local
            if session.start_datetime:
                local_dt = session.start_datetime.astimezone(BOGOTA_TZ)
                session_start_local = local_dt.strftime("%Y-%m-%dT%H:%M:%S")
        enriched.append({
            "id": str(appt.id),
            "status": appt.status,
            "paid": appt.paid,
            "payment_amount": float(appt.payment_amount) if appt.payment_amount else None,
            "session_start": session_start_local,
            "class_type_name": ct_name,
            "space_name": space_name,
            "client_name": client_name,
            "client_phone": client_phone,
            "notes": appt.notes,
            "created_at": appt.created_at.isoformat(),
        })
    return enriched
