from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.middleware.tenant import TenantMiddleware
from app.routers import auth, class_types, class_sessions, clients, appointments, payments, public, spaces, reports, schedule, plans, memberships, export, superadmin
from app.routers.cobros import router as cobros_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Kalma API",
    version="1.0.0",
    description="API para gestión de gimnasios y estudios de fitness",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Slug"],
)

# Tenant middleware
app.add_middleware(TenantMiddleware)

# Routers
PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(class_types.router, prefix=PREFIX)
app.include_router(class_sessions.router, prefix=PREFIX)
app.include_router(clients.router, prefix=PREFIX)
app.include_router(appointments.router, prefix=PREFIX)
app.include_router(payments.router, prefix=PREFIX)
app.include_router(public.router, prefix=PREFIX)
app.include_router(spaces.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(schedule.router, prefix=PREFIX)
app.include_router(plans.router, prefix=PREFIX)
app.include_router(memberships.router, prefix=PREFIX)
app.include_router(export.router, prefix=PREFIX)
app.include_router(superadmin.router, prefix=PREFIX)
app.include_router(cobros_router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/")
async def root():
    return {"app": "Kalma API", "version": "1.0.0"}
