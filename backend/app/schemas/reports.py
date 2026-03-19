import uuid
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class RevenueReport(BaseModel):
    space_id: Optional[uuid.UUID] = None
    space_name: Optional[str] = None
    total_revenue: Decimal
    session_count: int
    paid_appointments: int


class OccupancyReport(BaseModel):
    space_id: Optional[uuid.UUID] = None
    space_name: Optional[str] = None
    total_sessions: int
    avg_fill_rate: float
    fully_booked_count: int
