import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class SpaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    capacity: int
    price: Decimal
    currency: str = "COP"


class SpaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    price: Optional[Decimal] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None


class SpaceResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: Optional[str] = None
    capacity: int
    price: Decimal
    currency: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SpaceAvailabilitySlot(BaseModel):
    hour: int
    booked: int
    available: int
    is_full: bool
