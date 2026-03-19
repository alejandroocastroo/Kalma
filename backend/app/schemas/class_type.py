import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ClassTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = 60
    capacity: int = 10
    price: Decimal
    color: str = "#6366f1"


class ClassTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    capacity: Optional[int] = None
    price: Optional[Decimal] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class ClassTypeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: Optional[str] = None
    duration_minutes: int
    capacity: int
    price: Decimal
    color: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
