import uuid
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin


class ClassType(Base, TimestampMixin):
    __tablename__ = "class_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    capacity: Mapped[int] = mapped_column(Integer, default=10)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant = relationship("Tenant", back_populates="class_types", lazy="noload")
    sessions = relationship("ClassSession", back_populates="class_type", lazy="noload")
