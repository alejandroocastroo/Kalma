import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class AppointmentCreate(BaseModel):
    class_session_id: uuid.UUID
    client_id: uuid.UUID
    status: str = "confirmed"
    paid: bool = False
    payment_amount: Optional[Decimal] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    paid: Optional[bool] = None
    payment_amount: Optional[Decimal] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class_session_id: uuid.UUID
    client_id: uuid.UUID
    status: str
    paid: bool
    payment_amount: Optional[Decimal] = None
    payment_method: Optional[str] = None
    whatsapp_confirmation_sent: bool
    whatsapp_reminder_sent: bool
    notes: Optional[str] = None
    # Campos enriquecidos
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    session_start: Optional[datetime] = None
    class_type_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
