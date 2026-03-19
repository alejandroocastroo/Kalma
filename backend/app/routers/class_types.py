from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.schemas.class_type import ClassTypeCreate, ClassTypeUpdate, ClassTypeResponse
from app.models.class_type import ClassType

router = APIRouter(prefix="/class-types", tags=["Tipos de Clase"])


async def _get_tenant_id(current_user):
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Usuario sin tenant asignado")
    return current_user.tenant_id


@router.get("", response_model=List[ClassTypeResponse])
async def list_class_types(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    tenant_id = await _get_tenant_id(current_user)
    result = await db.execute(
        select(ClassType)
        .where(ClassType.tenant_id == tenant_id, ClassType.is_active == True)
        .order_by(ClassType.name)
    )
    return result.scalars().all()


@router.post("", response_model=ClassTypeResponse, status_code=201)
async def create_class_type(
    body: ClassTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    tenant_id = await _get_tenant_id(current_user)
    ct = ClassType(tenant_id=tenant_id, **body.model_dump())
    db.add(ct)
    await db.commit()
    await db.refresh(ct)
    return ct


@router.put("/{ct_id}", response_model=ClassTypeResponse)
async def update_class_type(
    ct_id: str,
    body: ClassTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    import uuid
    tenant_id = await _get_tenant_id(current_user)
    result = await db.execute(
        select(ClassType).where(ClassType.id == uuid.UUID(ct_id), ClassType.tenant_id == tenant_id)
    )
    ct = result.scalar_one_or_none()
    if not ct:
        raise HTTPException(status_code=404, detail="Tipo de clase no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ct, field, value)
    await db.commit()
    await db.refresh(ct)
    return ct


@router.delete("/{ct_id}")
async def delete_class_type(
    ct_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    import uuid
    tenant_id = await _get_tenant_id(current_user)
    result = await db.execute(
        select(ClassType).where(ClassType.id == uuid.UUID(ct_id), ClassType.tenant_id == tenant_id)
    )
    ct = result.scalar_one_or_none()
    if not ct:
        raise HTTPException(status_code=404, detail="Tipo de clase no encontrado")
    ct.is_active = False
    await db.commit()
    return {"message": "Tipo de clase desactivado"}
