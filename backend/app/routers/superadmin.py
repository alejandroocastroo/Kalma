"""Superadmin router — gestión de tenants. Solo accesible con role=superadmin."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.auth.jwt import require_superadmin, get_password_hash
from app.models.tenant import Tenant
from app.models.user import User
from app.models.client import Client
from app.models.class_session import ClassSession
from app.schemas.superadmin import (
    SuperadminTenantCreate,
    SuperadminTenantCreateResponse,
    TenantListItem,
    TenantResponse,
)

router = APIRouter(prefix="/superadmin", tags=["Superadmin"])


@router.get("/tenants", response_model=list[TenantListItem])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    return result.scalars().all()


@router.post("/tenants", response_model=SuperadminTenantCreateResponse, status_code=201)
async def create_tenant(
    body: SuperadminTenantCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    now = datetime.now(timezone.utc)
    tenant = Tenant(
        id=uuid.uuid4(),
        name=body.tenant_name,
        slug=body.tenant_slug,
        plan=body.plan,
        is_active=True,
        city="Bogotá",
        created_at=now,
        updated_at=now,
    )
    admin = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=body.admin_email,
        hashed_password=get_password_hash(body.admin_password),
        full_name=body.admin_full_name,
        role="admin",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(tenant)
    db.add(admin)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        detail = "Ya existe un tenant con ese slug" if "slug" in str(e.orig) else "Ya existe un usuario con ese email"
        raise HTTPException(409, detail)

    await db.refresh(tenant)
    return SuperadminTenantCreateResponse(
        tenant=TenantResponse.model_validate(tenant),
        admin_user_id=str(admin.id),
        admin_email=admin.email,
    )


@router.patch("/tenants/{tenant_id}/toggle", response_model=TenantResponse)
async def toggle_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")
    tenant.is_active = not tenant.is_active
    tenant.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.get("/tenants/{tenant_id}/stats")
async def tenant_stats(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    tid = uuid.UUID(tenant_id)
    users = (await db.execute(select(func.count()).where(User.tenant_id == tid))).scalar()
    clients = (await db.execute(select(func.count()).where(Client.tenant_id == tid))).scalar()
    sessions = (await db.execute(select(func.count()).where(ClassSession.tenant_id == tid))).scalar()
    return {"tenant_id": tenant_id, "total_users": users, "total_clients": clients, "total_sessions": sessions}
