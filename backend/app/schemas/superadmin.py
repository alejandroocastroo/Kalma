import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

from app.utils.timezone import is_valid_timezone


_VALID_CURRENCIES = {"COP", "MXN", "USD", "EUR", "ARS", "PEN", "CLP"}


class SuperadminTenantCreate(BaseModel):
    tenant_name: str
    tenant_slug: str
    plan: str = "basic"
    currency: str = "COP"
    timezone: str = "America/Bogota"
    admin_full_name: str
    admin_email: EmailStr
    admin_password: str

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in _VALID_CURRENCIES:
            raise ValueError(f"Moneda no soportada. Opciones: {', '.join(sorted(_VALID_CURRENCIES))}")
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        v = v.strip()
        if not is_valid_timezone(v):
            raise ValueError(f"Zona horaria '{v}' no válida (debe ser una zona IANA, ej. America/Mexico_City)")
        return v

    @field_validator("tenant_slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$', v):
            raise ValueError("El slug solo puede contener letras minúsculas, números y guiones, y debe tener al menos 2 caracteres")
        return v

    @field_validator("admin_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    currency: str = "COP"
    timezone: str = "America/Bogota"
    is_active: bool
    email: Optional[str] = None
    phone: Optional[str] = None
    city: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SuperadminTenantCreateResponse(BaseModel):
    tenant: TenantResponse
    admin_user_id: str
    admin_email: str


class TenantListItem(TenantResponse):
    pass
