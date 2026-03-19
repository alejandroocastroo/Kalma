import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.class_type import ClassTypeResponse


class ClassSessionCreate(BaseModel):
    class_type_id: uuid.UUID
    instructor_id: Optional[uuid.UUID] = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: int
    notes: Optional[str] = None


class ClassSessionUpdate(BaseModel):
    instructor_id: Optional[uuid.UUID] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    capacity: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ClassSessionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class_type_id: uuid.UUID
    instructor_id: Optional[uuid.UUID] = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: int
    enrolled_count: int
    status: str
    notes: Optional[str] = None
    class_type_name: Optional[str] = None
    class_type_color: Optional[str] = None
    instructor_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
