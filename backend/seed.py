"""
Seed script — Mantra Pilates Studio
Run: python seed.py (from backend/ folder)
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal

import pytz

from app.database import AsyncSessionLocal, engine, Base
from app.auth.jwt import get_password_hash
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


BOGOTA = pytz.timezone("America/Bogota")


def bogota_dt(year, month, day, hour, minute=0):
    return BOGOTA.localize(datetime(year, month, day, hour, minute)).astimezone(timezone.utc)


async def seed():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        from sqlalchemy import select
        existing = await db.execute(select(Tenant).where(Tenant.slug == "mantra"))
        if existing.scalar_one_or_none():
            print("Ya existe el seed de Mantra, omitiendo...")
            return

        print("Creando tenant: Mantra Pilates Studio...")
        tenant = Tenant(
            id=uuid.uuid4(),
            name="Mantra Pilates Studio",
            slug="mantra",
            phone="+573113513135",
            email="[EMAIL_ADDRESS]",
            address="Cra. 34 #16-6, Tuluá, Valle del Cauca",
            city="Tuluá",
            description="Somos un estudio de pilates creado por tres mujeres, enfocado en el movimiento consciente y el bienestar integral. Creamos espacios tranquilos donde las personas pueden fortalecer su cuerpo, equilibrar su mente y desarrollar hábitos de ejercicio saludables y sostenibles.",
            logo_url=None,
            cover_url="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200",
            instagram_url="https://www.instagram.com/mantrapilatesstudio/",
            whatsapp_number="+573113513135",
            plan="pro",
            is_active=True,
        )
        db.add(tenant)
        await db.flush()

        print("Creando usuarios...")
        admin = User(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            email="admin@mantra.com",
            hashed_password=get_password_hash("mantra123"),
            full_name="Ana García",
            phone="+573001234567",
            role="admin",
        )
        instructora = User(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            email="instructora@mantra.com",
            hashed_password=get_password_hash("mantra123"),
            full_name="Sofía Rodríguez",
            phone="+573009876543",
            role="instructor",
        )
        db.add_all([admin, instructora])
        await db.flush()

        print("Creando tipos de clase...")
        reformer = ClassType(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="Reformer Pilates",
            description="Trabaja con la máquina Reformer para fortalecer y alargar los músculos. Ideal para todos los niveles.",
            duration_minutes=55,
            capacity=8,
            price=Decimal("120000"),
            color="#6366f1",
        )
        mat = ClassType(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="Mat Pilates",
            description="Pilates en colchoneta. Desarrolla fuerza de core, flexibilidad y conciencia corporal.",
            duration_minutes=60,
            capacity=12,
            price=Decimal("80000"),
            color="#10b981",
        )
        terapeutico = ClassType(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="Pilates Terapéutico",
            description="Sesiones personalizadas para rehabilitación y manejo del dolor. Máximo 4 personas.",
            duration_minutes=60,
            capacity=4,
            price=Decimal("150000"),
            color="#f59e0b",
        )
        db.add_all([reformer, mat, terapeutico])
        await db.flush()

        print("Creando sesiones de la semana...")
        now = datetime.now(BOGOTA)
        # Get Monday of current week
        monday = now - timedelta(days=now.weekday())
        monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)

        sessions = []
        schedule = [
            # (day_offset, hour, class_type, instructor)
            (0, 7, reformer, instructora),   # Lun 7am Reformer
            (0, 10, mat, instructora),         # Lun 10am Mat
            (0, 18, reformer, instructora),    # Lun 6pm Reformer
            (1, 7, reformer, instructora),     # Mar 7am Reformer
            (1, 18, mat, instructora),         # Mar 6pm Mat
            (2, 7, terapeutico, instructora),  # Mie 7am Terapéutico
            (2, 10, reformer, instructora),    # Mie 10am Reformer
            (2, 18, reformer, instructora),    # Mie 6pm Reformer
            (3, 7, mat, instructora),          # Jue 7am Mat
            (3, 18, reformer, instructora),    # Jue 6pm Reformer
            (4, 7, reformer, instructora),     # Vie 7am Reformer
            (4, 10, mat, instructora),         # Vie 10am Mat
            (4, 18, terapeutico, instructora), # Vie 6pm Terapéutico
            (5, 9, reformer, instructora),     # Sab 9am Reformer
            (5, 11, mat, instructora),         # Sab 11am Mat
        ]

        for day_offset, hour, class_type, instructor in schedule:
            start = monday + timedelta(days=day_offset, hours=hour)
            start = BOGOTA.localize(start.replace(tzinfo=None)).astimezone(timezone.utc)
            end = start + timedelta(minutes=class_type.duration_minutes)
            s = ClassSession(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                class_type_id=class_type.id,
                instructor_id=instructor.id,
                start_datetime=start,
                end_datetime=end,
                capacity=class_type.capacity,
                enrolled_count=0,
                status="scheduled",
            )
            sessions.append(s)

        db.add_all(sessions)
        await db.flush()

        print("Creando clientes...")
        clients_data = [
            ("Valentina Torres", "valeto@gmail.com", "+573151234567"),
            ("Camila Pérez", "camiperez@hotmail.com", "+573202345678"),
            ("María Fernanda López", "mafe.lopez@gmail.com", "+573113456789"),
            ("Juanita Ramírez", "juana.r@outlook.com", "+573004567890"),
            ("Daniela Morales", "dani.morales@gmail.com", "+573175678901"),
        ]
        clients = []
        for name, email, phone in clients_data:
            c = Client(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                full_name=name,
                email=email,
                phone=phone,
                document_type="CC",
                total_sessions=0,
            )
            clients.append(c)
        db.add_all(clients)
        await db.flush()

        print("Creando citas...")
        appointments = []
        # Book first 3 clients into first session (Reformer Monday 7am)
        first_session = sessions[0]
        for i, client in enumerate(clients[:4]):
            appt = Appointment(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                class_session_id=first_session.id,
                client_id=client.id,
                status="confirmed" if i < 3 else "pending",
                paid=i < 2,
                payment_amount=Decimal("120000") if i < 2 else None,
                payment_method="nequi" if i == 0 else "transfer" if i == 1 else None,
            )
            appointments.append(appt)
        first_session.enrolled_count = 4

        # Book 2 clients into second session (Mat Monday 10am)
        second_session = sessions[1]
        for client in clients[1:3]:
            appt = Appointment(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                class_session_id=second_session.id,
                client_id=client.id,
                status="confirmed",
                paid=True,
                payment_amount=Decimal("80000"),
                payment_method="cash",
            )
            appointments.append(appt)
        second_session.enrolled_count = 2

        db.add_all(appointments)
        await db.flush()

        print("Creando pagos del mes...")
        today = date.today()
        payments_data = [
            # ingresos
            (clients[0].id, Decimal("120000"), "income", "class_fee", "nequi", "Reformer Pilates - Valentina"),
            (clients[1].id, Decimal("120000"), "income", "class_fee", "transfer", "Reformer Pilates - Camila"),
            (clients[1].id, Decimal("80000"), "income", "class_fee", "cash", "Mat Pilates - Camila"),
            (clients[2].id, Decimal("80000"), "income", "class_fee", "cash", "Mat Pilates - María Fernanda"),
            (None, Decimal("2400000"), "income", "membership", "transfer", "Membresía mensual x20"),
            # egresos
            (None, Decimal("800000"), "expense", "rent", "transfer", "Arriendo local Marzo"),
            (None, Decimal("300000"), "expense", "salary", "transfer", "Honorarios instructora"),
            (None, Decimal("50000"), "expense", "equipment", "cash", "Bandas de resistencia"),
        ]
        payments = []
        for client_id, amount, ptype, category, method, desc in payments_data:
            p = Payment(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                client_id=client_id,
                amount=amount,
                type=ptype,
                category=category,
                payment_method=method,
                description=desc,
                payment_date=today,
                created_by=admin.id,
            )
            payments.append(p)
        db.add_all(payments)
        await db.commit()

        print("✓ Seed completado exitosamente!")
        print(f"  Tenant: {tenant.name} (slug: {tenant.slug})")
        print(f"  Admin: admin@mantra.com / mantra123")
        print(f"  Instructora: instructora@mantra.com / mantra123")
        print(f"  Clases: {len([reformer, mat, terapeutico])}")
        print(f"  Sesiones esta semana: {len(sessions)}")
        print(f"  Clientes: {len(clients)}")


if __name__ == "__main__":
    asyncio.run(seed())
