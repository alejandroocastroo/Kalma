import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, field_validator
from app.schemas.class_type import ClassTypeResponse


class ClassSessionCreate(BaseModel):
    class_type_id: Optional[uuid.UUID] = None
    space_id: Optional[uuid.UUID] = None
    instructor_id: Optional[uuid.UUID] = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: Optional[int] = None
    custom_name: Optional[str] = None
    notes: Optional[str] = None


class ClassSessionUpdate(BaseModel):
    space_id: Optional[uuid.UUID] = None
    instructor_id: Optional[uuid.UUID] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    capacity: Optional[int] = None
    status: Optional[str] = None
    custom_name: Optional[str] = None
    notes: Optional[str] = None


class ClassSessionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class_type_id: Optional[uuid.UUID] = None
    space_id: Optional[uuid.UUID] = None
    instructor_id: Optional[uuid.UUID] = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: int
    enrolled_count: int
    status: str
    custom_name: Optional[str] = None
    notes: Optional[str] = None
    class_type_name: Optional[str] = None
    class_type_color: Optional[str] = None
    space_name: Optional[str] = None
    instructor_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QuickBookRequest(BaseModel):
    class_type_id: Optional[uuid.UUID] = None
    start_datetime: datetime
    duration_minutes: int = 60
    capacity: Optional[int] = None
    space_id: Optional[uuid.UUID] = None
    client_id: Optional[uuid.UUID] = None

    @field_validator("duration_minutes")
    @classmethod
    def duration_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("duration_minutes must be greater than 0")
        return v


class QuickBookResponse(BaseModel):
    session: ClassSessionResponse
    appointment: Optional[dict] = None
