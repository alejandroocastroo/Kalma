import uuid
from sqlalchemy import String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    custom_domain: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str] = mapped_column(String(100), default="Bogotá")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    instagram_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    plan: Mapped[str] = mapped_column(String(20), default="basic")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    users = relationship("User", back_populates="tenant", lazy="noload")
    class_types = relationship("ClassType", back_populates="tenant", lazy="noload")
    class_sessions = relationship("ClassSession", back_populates="tenant", lazy="noload")
    clients = relationship("Client", back_populates="tenant", lazy="noload")
    spaces = relationship("Space", back_populates="tenant", lazy="noload")
    studio_schedule = relationship("StudioSchedule", lazy="noload")
    schedule_exceptions = relationship("ScheduleException", lazy="noload")
