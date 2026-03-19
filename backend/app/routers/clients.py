import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.schemas.common import PaginatedResponse
from app.models.client import Client

router = APIRouter(prefix="/clients", tags=["Clientes"])


@router.get("", response_model=PaginatedResponse[ClientResponse])
async def list_clients(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    q = select(Client).where(Client.tenant_id == current_user.tenant_id, Client.is_active == True)
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
    return PaginatedResponse(
        items=items,
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
    await db.commit()
    await db.refresh(client)
    return client


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
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    await db.commit()
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

    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.client_id == uuid.UUID(client_id),
            Appointment.tenant_id == current_user.tenant_id,
        )
        .order_by(Appointment.created_at.desc())
        .limit(20)
    )
    appointments = result.scalars().all()
    client_obj = await db.get(Client, uuid.UUID(client_id))
    client_name = client_obj.full_name if client_obj else None
    client_phone = client_obj.phone if client_obj else None
    enriched = []
    for appt in appointments:
        session = await db.get(ClassSession, appt.class_session_id)
        ct_name = None
        if session:
            ct = await db.get(ClassType, session.class_type_id)
            ct_name = ct.name if ct else None
        enriched.append({
            "id": str(appt.id),
            "status": appt.status,
            "paid": appt.paid,
            "payment_amount": float(appt.payment_amount) if appt.payment_amount else None,
            "session_start": session.start_datetime.isoformat() if session else None,
            "class_type_name": ct_name,
            "client_name": client_name,
            "client_phone": client_phone,
            "created_at": appt.created_at.isoformat(),
        })
    return enriched
