import uuid
from sqlalchemy import SmallInteger, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin


class StudioSchedule(Base, TimestampMixin):
    __tablename__ = "studio_schedule"
    __table_args__ = (
        UniqueConstraint("tenant_id", "day_of_week", name="uq_studio_schedule_tenant_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Monday ... 6=Sunday
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    open_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=6)
    close_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=21)

    tenant = relationship("Tenant", lazy="noload")
