import uuid
from decimal import Decimal
from sqlalchemy import String, Text, Boolean, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin


class Appointment(Base, TimestampMixin):
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint("class_session_id", "client_id", name="uq_appointment_session_client"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    class_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("class_sessions.id"), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")  # pending, confirmed, cancelled, attended, no_show
    paid: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    whatsapp_confirmation_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    class_session = relationship("ClassSession", back_populates="appointments", lazy="noload")
    client = relationship("Client", back_populates="appointments", lazy="noload")
