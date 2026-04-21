import uuid
from sqlalchemy import String, Text, Integer, SmallInteger, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_cop: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    classes_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # v2 fields — cobros
    membership_type: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")  # monthly | session_based
    sessions_per_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    total_sessions: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # calculated: sessions_per_week * 4

    space_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id"), nullable=True)

    memberships = relationship("ClientMembership", back_populates="plan", lazy="noload")
    space = relationship("Space", lazy="noload")
