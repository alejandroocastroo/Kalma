import uuid
from sqlalchemy import Column, String, Date, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class MakeupSession(Base, TimestampMixin):
    __tablename__ = "makeup_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    membership_id = Column(UUID(as_uuid=True), ForeignKey("client_memberships.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    original_date = Column(Date, nullable=False)
    makeup_date = Column(Date, nullable=True)
    class_session_id = Column(UUID(as_uuid=True), ForeignKey("class_sessions.id"), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, completed, cancelled
    notes = Column(Text, nullable=True)

    membership = relationship("ClientMembership", back_populates="makeup_sessions")
    client = relationship("Client")

    __table_args__ = (
        Index("ix_makeup_sessions_tenant_id", "tenant_id"),
        Index("ix_makeup_sessions_membership_id", "membership_id"),
        Index("ix_makeup_sessions_client_id", "client_id"),
    )
