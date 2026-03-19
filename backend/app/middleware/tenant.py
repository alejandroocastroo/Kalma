from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        slug = self._extract_slug(request)
        request.state.tenant_slug = slug
        response = await call_next(request)
        return response

    def _extract_slug(self, request: Request) -> str | None:
        # 1. Header explícito
        if slug := request.headers.get("X-Tenant-Slug"):
            return slug.lower()

        # 2. Subdominio: mantra.usekalma.com → "mantra"
        host = request.headers.get("host", "")
        hostname = host.split(":")[0]
        parts = hostname.split(".")
        # Si hay más de 2 partes y el sub no es "www", "app", "api"
        reserved = {"www", "app", "api", "localhost"}
        if len(parts) >= 3 and parts[0] not in reserved:
            return parts[0].lower()

        # 3. Query param (solo desarrollo)
        if slug := request.query_params.get("tenant"):
            return slug.lower()

        return None


async def get_tenant(request: Request, db: AsyncSession):
    from app.models.tenant import Tenant

    slug = getattr(request.state, "tenant_slug", None)
    if not slug:
        return None
    result = await db.execute(select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True))
    return result.scalar_one_or_none()


async def require_tenant(request: Request, db: AsyncSession):
    tenant = await get_tenant(request, db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    return tenant
