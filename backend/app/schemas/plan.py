import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_cop: int
    classes_per_week: int
    is_active: bool = True
    membership_type: str = "monthly"        # monthly | session_based
    sessions_per_week: Optional[int] = None
    space_id: Optional[uuid.UUID] = None


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_cop: Optional[int] = None
    classes_per_week: Optional[int] = None
    is_active: Optional[bool] = None
    membership_type: Optional[str] = None
    sessions_per_week: Optional[int] = None
    space_id: Optional[uuid.UUID] = None


class PlanResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: Optional[str]
    price_cop: int
    classes_per_week: int
    is_active: bool
    membership_type: str
    sessions_per_week: Optional[int]
    total_sessions: Optional[int]
    space_id: Optional[uuid.UUID]
    space_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
