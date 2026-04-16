import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


class SuperadminTenantCreate(BaseModel):
    tenant_name: str
    tenant_slug: str
    plan: str = "basic"
    admin_full_name: str
    admin_email: EmailStr
    admin_password: str

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
