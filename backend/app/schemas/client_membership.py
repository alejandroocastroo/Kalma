import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ClientMembershipCreate(BaseModel):
    client_id: uuid.UUID
    plan_id: uuid.UUID
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None
    preferred_days: Optional[list[int]] = None   # [0,2,4] → lun, mié, vie
    preferred_hour: Optional[int] = None          # 15 → 3pm
    preferred_space_id: Optional[uuid.UUID] = None


class ClientMembershipUpdate(BaseModel):
    plan_id: Optional[uuid.UUID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    preferred_days: Optional[list[int]] = None
    preferred_hour: Optional[int] = None
    preferred_space_id: Optional[uuid.UUID] = None


class ClientMembershipResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: uuid.UUID
    plan_id: uuid.UUID
    start_date: date
    end_date: Optional[date] = None
    status: str
    makeup_credits: int
    notes: Optional[str] = None
    preferred_days: Optional[list[int]] = None
    preferred_hour: Optional[int] = None
    preferred_space_id: Optional[uuid.UUID] = None
    created_at: datetime
    client_name: Optional[str] = None
    plan_name: Optional[str] = None
    plan_classes_per_week: Optional[int] = None
    plan_price_cop: Optional[int] = None
    preferred_space_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WeeklyStatsResponse(BaseModel):
    membership_id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    plan_name: str
    classes_per_week: int
    makeup_credits: int
    used_this_week: int
    pending_this_week: int
    total_committed_week: int
    week_start: date
    week_end: date
    classes_per_month: int        # classes_per_week * 4
    used_this_month: int          # appointments attended este mes
    pending_this_month: int       # appointments confirmed futuros este mes
    total_committed_month: int    # used_this_month + pending_this_month
    month_start: date
    month_end: date


class AddMakeupBody(BaseModel):
    credits: int


class AutoBookResponse(BaseModel):
    booked: int          # sesiones agendadas exitosamente
    skipped: int         # ya tenía cita o sin capacidad
    sessions: list[str]  # fechas de sesiones agendadas (ISO strings)
