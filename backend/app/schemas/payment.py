import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Dict, List
from pydantic import BaseModel


class PaymentCreate(BaseModel):
    client_id: Optional[uuid.UUID] = None
    appointment_id: Optional[uuid.UUID] = None
    amount: Decimal
    type: str  # income, expense
    category: str
    payment_method: str
    description: Optional[str] = None
    payment_date: date


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = None
    type: Optional[str] = None
    category: Optional[str] = None
    payment_method: Optional[str] = None
    description: Optional[str] = None
    payment_date: Optional[date] = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: Optional[uuid.UUID] = None
    appointment_id: Optional[uuid.UUID] = None
    amount: Decimal
    type: str
    category: str
    payment_method: str
    description: Optional[str] = None
    payment_date: date
    client_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CashFlowSummary(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net: Decimal
    by_category: Dict[str, Decimal]
    by_method: Dict[str, Decimal]
    income_count: int
    expense_count: int
