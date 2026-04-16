"""
Script para crear el usuario superadmin de Kalma.
Corre una sola vez: python seed_superadmin.py

Puedes cambiar EMAIL y PASSWORD antes de correr,
o pasarlos por variables de entorno:
  SUPERADMIN_EMAIL=yo@kalma.com SUPERADMIN_PASSWORD=MiClave123 python seed_superadmin.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

from app.database import AsyncSessionLocal
from app.auth.jwt import get_password_hash
# Importar todos los modelos para que SQLAlchemy resuelva las relaciones
from app.models.tenant import Tenant
from app.models.user import User
from app.models.class_type import ClassType
from app.models.class_session import ClassSession
from app.models.client import Client
from app.models.appointment import Appointment
from app.models.payment import Payment
from app.models.space import Space
from app.models.studio_schedule import StudioSchedule
from app.models.schedule_exception import ScheduleException
from sqlalchemy import select


SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "superadmin@kalma.com")
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "KalmaSuper2024!")


async def create_superadmin():
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == SUPERADMIN_EMAIL))
        if existing.scalar_one_or_none():
            print(f"Ya existe un usuario con el email {SUPERADMIN_EMAIL}. Nada que hacer.")
            return

        now = datetime.now(timezone.utc)
        user = User(
            id=uuid.uuid4(),
            tenant_id=None,
            email=SUPERADMIN_EMAIL,
            hashed_password=get_password_hash(SUPERADMIN_PASSWORD),
            full_name="Superadmin Kalma",
            role="superadmin",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        await db.commit()

        print("=" * 50)
        print("Superadmin creado exitosamente.")
        print(f"  Email:      {SUPERADMIN_EMAIL}")
        print(f"  Contraseña: {SUPERADMIN_PASSWORD}")
        print("=" * 50)
        print("Guarda estas credenciales en un lugar seguro.")


if __name__ == "__main__":
    asyncio.run(create_superadmin())
