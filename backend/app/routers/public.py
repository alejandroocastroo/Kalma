from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.tenant import Tenant
from app.models.class_type import ClassType
from app.models.class_session import ClassSession
from app.models.client import Client
from app.models.appointment import Appointment

router = APIRouter(prefix="/public", tags=["Público"])


class PublicBookingRequest(BaseModel):
    class_session_id: str
    full_name: str
    phone: str
    email: Optional[str] = None


@router.get("/{slug}/info")
async def studio_info(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Estudio no encontrado")

    ct_result = await db.execute(
        select(ClassType).where(ClassType.tenant_id == tenant.id, ClassType.is_active == True)
    )
    class_types = ct_result.scalars().all()

    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "slug": tenant.slug,
        "description": tenant.description,
        "phone": tenant.phone,
        "email": tenant.email,
        "address": tenant.address,
        "city": tenant.city,
        "logo_url": tenant.logo_url,
        "cover_url": tenant.cover_url,
        "instagram_url": tenant.instagram_url,
        "whatsapp_number": tenant.whatsapp_number,
        "class_types": [
            {
                "id": str(ct.id),
                "name": ct.name,
                "description": ct.description,
                "duration_minutes": ct.duration_minutes,
                "capacity": ct.capacity,
                "price": float(ct.price),
                "color": ct.color,
            }
            for ct in class_types
        ],
    }


@router.get("/{slug}/schedule")
async def public_schedule(
    slug: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Estudio no encontrado")

    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    if start:
        week_start = datetime.fromisoformat(start)
    if end:
        week_end = datetime.fromisoformat(end)

    sessions_result = await db.execute(
        select(ClassSession).where(
            ClassSession.tenant_id == tenant.id,
            ClassSession.start_datetime >= week_start,
            ClassSession.start_datetime < week_end,
            ClassSession.status != "cancelled",
        ).order_by(ClassSession.start_datetime)
    )
    sessions = sessions_result.scalars().all()

    enriched = []
    for s in sessions:
        ct = await db.get(ClassType, s.class_type_id)
        enriched.append({
            "id": str(s.id),
            "start_datetime": s.start_datetime.isoformat(),
            "end_datetime": s.end_datetime.isoformat(),
            "capacity": s.capacity,
            "available_spots": max(0, s.capacity - s.enrolled_count),
            "enrolled_count": s.enrolled_count,
            "class_type": {
                "id": str(ct.id) if ct else None,
                "name": ct.name if ct else "Clase",
                "duration_minutes": ct.duration_minutes if ct else 60,
                "price": float(ct.price) if ct else 0,
                "color": ct.color if ct else "#6366f1",
            },
        })
    return enriched


@router.post("/{slug}/book")
async def public_book(slug: str, body: PublicBookingRequest, db: AsyncSession = Depends(get_db)):
    import uuid as uuid_lib

    result = await db.execute(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Estudio no encontrado")

    session = await db.get(ClassSession, uuid_lib.UUID(body.class_session_id))
    if not session or session.tenant_id != tenant.id:
        raise HTTPException(404, "Sesión no encontrada")
    if session.enrolled_count >= session.capacity:
        raise HTTPException(400, "La sesión está llena")

    # Find or create client
    client_result = await db.execute(
        select(Client).where(Client.tenant_id == tenant.id, Client.phone == body.phone)
    )
    client = client_result.scalar_one_or_none()
    if not client:
        client = Client(
            tenant_id=tenant.id,
            full_name=body.full_name,
            phone=body.phone,
            email=body.email,
        )
        db.add(client)
        await db.flush()

    # Check for existing appointment
    existing = await db.execute(
        select(Appointment).where(
            Appointment.class_session_id == session.id,
            Appointment.client_id == client.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Ya tienes una reserva en esta sesión")

    appointment = Appointment(
        tenant_id=tenant.id,
        class_session_id=session.id,
        client_id=client.id,
        status="confirmed",
    )
    db.add(appointment)
    session.enrolled_count += 1
    await db.commit()

    return {
        "message": "Reserva confirmada",
        "appointment_id": str(appointment.id),
        "client_name": client.full_name,
    }
