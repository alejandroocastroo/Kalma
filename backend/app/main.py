from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.middleware.tenant import TenantMiddleware
from app.routers import auth, class_types, class_sessions, clients, appointments, payments, public, spaces, reports, schedule, plans, memberships


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Kalma API",
    version="1.0.0",
    description="API para gestión de gimnasios y estudios de fitness",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/")
async def root():
    return {"app": "Kalma API", "version": "1.0.0", "docs": "/docs"}
