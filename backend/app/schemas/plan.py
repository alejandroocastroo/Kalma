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


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_cop: Optional[int] = None
    classes_per_week: Optional[int] = None
    is_active: Optional[bool] = None


class PlanResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: Optional[str]
    price_cop: int
    classes_per_week: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
