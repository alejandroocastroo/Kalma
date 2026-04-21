import uuid
from datetime import date
from sqlalchemy import String, Text, Integer, SmallInteger, Date, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
from app.models.base import TimestampMixin


class ClientMembership(Base, TimestampMixin):
    __tablename__ = "client_memberships"
    __table_args__ = (
        Index("ix_client_memberships_tenant_status", "tenant_id", "status"),
    )

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

    # v2 fields — cobros
    membership_type: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")  # monthly | session_based
    billing_day: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    next_billing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sessions_per_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    total_sessions: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sessions_used: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    scheduled_days: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # e.g. ['monday', 'tuesday']
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    makeups_allowed: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    makeups_used: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    client = relationship("Client", lazy="noload")
    plan = relationship("Plan", back_populates="memberships", lazy="noload")
    preferred_space = relationship("Space", foreign_keys=[preferred_space_id], lazy="noload")
    makeup_sessions = relationship("MakeupSession", back_populates="membership", cascade="all, delete-orphan", lazy="noload")
