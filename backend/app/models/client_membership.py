import uuid
from datetime import date
from sqlalchemy import String, Text, Integer, Date, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin


class ClientMembership(Base, TimestampMixin):
    __tablename__ = "client_memberships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    makeup_credits: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_days: Mapped[list | None] = mapped_column(JSON, nullable=True)  # e.g. [0,2,4] lunes=0...domingo=6
    preferred_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-23
    preferred_space_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id"), nullable=True)

    client = relationship("Client", lazy="noload")
    plan = relationship("Plan", back_populates="memberships", lazy="noload")
    preferred_space = relationship("Space", foreign_keys=[preferred_space_id], lazy="noload")
