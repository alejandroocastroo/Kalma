import re
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


def _validate_document_number(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if not v:
        return None
    digits = re.sub(r'\D', '', v)
    if len(digits) < 9:
        raise ValueError('El número de documento debe tener al menos 9 dígitos')
    return v


class _ClientDocMixin(BaseModel):
    document_number: Optional[str] = None

    @field_validator('document_number')
    @classmethod
    def validate_document_number(cls, v: Optional[str]) -> Optional[str]:
        return _validate_document_number(v)


class ClientCreate(_ClientDocMixin):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    document_type: str = "CC"
    birth_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None


class ClientUpdate(_ClientDocMixin):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    document_type: Optional[str] = None
    birth_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    document_type: str
    document_number: Optional[str] = None
    birth_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None
    total_sessions: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
