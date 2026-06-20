from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel as PydanticBaseModel

from app.database import get_db
from app.limiter import limiter
from app.redis_client import get_redis
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.auth.jwt import (
    verify_password, create_access_token, create_refresh_token,
    verify_token, get_current_active_user, REFRESH_TOKEN_PREFIX
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Autenticación"])

_REFRESH_TTL = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400  # seconds


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    from app.models.user import User
    from app.models.tenant import Tenant

    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    token_data = {"sub": str(user.id), "role": user.role}
    access_token = create_access_token(token_data)
    refresh_token, jti = create_refresh_token(token_data)

    redis = await get_redis()
    await redis.setex(f"{REFRESH_TOKEN_PREFIX}{jti}", _REFRESH_TTL, str(user.id))

    tenant_slug = None
    tenant_currency = "COP"
    tenant_timezone = "America/Bogota"
    if user.tenant_id:
        t = await db.get(Tenant, user.tenant_id)
        if t:
            tenant_slug = t.slug
            tenant_currency = t.currency or "COP"
            tenant_timezone = t.timezone or "America/Bogota"

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        user_email=user.email,
        user_name=user.full_name,
        user_role=user.role,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        tenant_slug=tenant_slug,
        tenant_currency=tenant_currency,
        tenant_timezone=tenant_timezone,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_token(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    from app.models.user import User
    from app.models.tenant import Tenant

    payload = verify_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=401, detail="Token inválido")

    redis = await get_redis()
    stored = await redis.get(f"{REFRESH_TOKEN_PREFIX}{jti}")
    if not stored:
        raise HTTPException(status_code=401, detail="Token revocado o expirado")

    # Rotate: invalidate old jti
    await redis.delete(f"{REFRESH_TOKEN_PREFIX}{jti}")

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    token_data = {"sub": str(user.id), "role": user.role}
    access_token = create_access_token(token_data)
    new_refresh, new_jti = create_refresh_token(token_data)

    await redis.setex(f"{REFRESH_TOKEN_PREFIX}{new_jti}", _REFRESH_TTL, str(user.id))

    tenant_slug = None
    tenant_currency = "COP"
    tenant_timezone = "America/Bogota"
    if user.tenant_id:
        t = await db.get(Tenant, user.tenant_id)
        if t:
            tenant_slug = t.slug
            tenant_currency = t.currency or "COP"
            tenant_timezone = t.timezone or "America/Bogota"

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user_id=str(user.id),
        user_email=user.email,
        user_name=user.full_name,
        user_role=user.role,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        tenant_slug=tenant_slug,
        tenant_currency=tenant_currency,
        tenant_timezone=tenant_timezone,
    )


@router.post("/logout")
async def logout(body: RefreshRequest):
    """Revoca el refresh token activo."""
    try:
        payload = verify_token(body.refresh_token)
        jti = payload.get("jti")
        if jti:
            redis = await get_redis()
            await redis.delete(f"{REFRESH_TOKEN_PREFIX}{jti}")
    except Exception:
        pass  # Si el token ya expiró o es inválido, logout igual
    return {"ok": True}


@router.get("/me")
async def me(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    from app.models.tenant import Tenant
    tenant_currency = "COP"
    tenant_timezone = "America/Bogota"
    if current_user.tenant_id:
        t = await db.get(Tenant, current_user.tenant_id)
        if t:
            tenant_currency = t.currency or "COP"
            tenant_timezone = t.timezone or "America/Bogota"
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else None,
        "tenant_currency": tenant_currency,
        "tenant_timezone": tenant_timezone,
    }


_VALID_CURRENCIES = {"COP", "MXN", "USD", "EUR", "ARS", "PEN", "CLP"}


class TenantSettingsUpdate(PydanticBaseModel):
    currency: str


@router.put("/tenant-settings")
async def update_tenant_settings(
    body: TenantSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Actualiza la moneda del tenant. Solo admins."""
    from app.models.tenant import Tenant

    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(403, "Se requiere rol de administrador")

    currency = body.currency.upper()
    if currency not in _VALID_CURRENCIES:
        raise HTTPException(400, f"Moneda '{currency}' no válida. Opciones: {', '.join(sorted(_VALID_CURRENCIES))}")

    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")

    tenant.currency = currency
    await db.commit()
    return {"currency": tenant.currency, "message": "Moneda actualizada"}


@router.get("/custom-categories")
async def get_custom_categories(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Retorna las categorías personalizadas del tenant."""
    from app.models.tenant import Tenant
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    tenant = await db.get(Tenant, current_user.tenant_id)
    cats = (tenant.custom_categories or {}) if tenant else {}
    return {
        "income": cats.get("income", []),
        "expense": cats.get("expense", []),
    }


class CustomCategoriesUpdate(PydanticBaseModel):
    type: str   # "income" | "expense"
    label: str


class CustomCategoriesDelete(PydanticBaseModel):
    type: str
    label: str


@router.post("/custom-categories")
async def add_custom_category(
    body: CustomCategoriesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from app.models.tenant import Tenant
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    if body.type not in ("income", "expense"):
        raise HTTPException(400, "type debe ser 'income' o 'expense'")
    label = body.label.strip()
    if not label or len(label) > 60:
        raise HTTPException(400, "El nombre debe tener entre 1 y 60 caracteres")
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")
    cats = dict(tenant.custom_categories or {})
    existing = cats.get(body.type, [])
    if label in existing:
        raise HTTPException(409, "Ya existe una categoría con ese nombre")
    cats[body.type] = existing + [label]
    tenant.custom_categories = cats
    await db.commit()
    return {"income": cats.get("income", []), "expense": cats.get("expense", [])}


@router.delete("/custom-categories")
async def delete_custom_category(
    body: CustomCategoriesDelete,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from app.models.tenant import Tenant
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")
    cats = dict(tenant.custom_categories or {})
    cats[body.type] = [c for c in cats.get(body.type, []) if c != body.label]
    tenant.custom_categories = cats
    await db.commit()
    return {"income": cats.get("income", []), "expense": cats.get("expense", [])}
