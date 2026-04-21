from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.limiter import limiter
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.auth.jwt import (
    verify_password, create_access_token, create_refresh_token,
    verify_token, get_current_active_user
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    from app.models.user import User
    from app.models.tenant import Tenant

    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    tenant_slug = None
    if user.tenant_id:
        t = await db.get(Tenant, user.tenant_id)
        tenant_slug = t.slug if t else None

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        user_email=user.email,
        user_name=user.full_name,
        user_role=user.role,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        tenant_slug=tenant_slug,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_token(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    from app.models.user import User
    from app.models.tenant import Tenant

    payload = verify_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    tenant_slug = None
    if user.tenant_id:
        t = await db.get(Tenant, user.tenant_id)
        tenant_slug = t.slug if t else None

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user_id=str(user.id),
        user_email=user.email,
        user_name=user.full_name,
        user_role=user.role,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        tenant_slug=tenant_slug,
    )


@router.get("/me")
async def me(current_user=Depends(get_current_active_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else None,
    }
