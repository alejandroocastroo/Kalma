from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, model_validator


DAY_NAMES_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


class ScheduleDay(BaseModel):
    id: Optional[str] = None
    day_of_week: int
    day_name: str
    is_active: bool
    open_hour: int
    close_hour: int

    model_config = {"from_attributes": True}


class ScheduleDayUpdate(BaseModel):
    is_active: bool
    open_hour: int = Field(ge=0, le=23)
    close_hour: int = Field(ge=1, le=24)

    @model_validator(mode="after")
    def validate_hours(self) -> "ScheduleDayUpdate":
        if self.open_hour >= self.close_hour:
            raise ValueError("open_hour debe ser menor que close_hour")
        return self


class ScheduleExceptionResponse(BaseModel):
    id: str
    date: date
    reason: Optional[str] = None
    is_closed: bool

    model_config = {"from_attributes": True}


class ScheduleExceptionCreate(BaseModel):
    date: date
    reason: Optional[str] = None
    is_closed: bool = True


class GenerateSessionsRequest(BaseModel):
    from_date: date
    to_date: date
    space_id: str                         # required — capacity comes from the space
    skip_existing: bool = True
    open_hour: Optional[int] = Field(default=None, ge=0, le=23)
    close_hour: Optional[int] = Field(default=None, ge=0, le=23)  # inclusive: last session starts here

    @model_validator(mode="after")
    def validate_range(self) -> "GenerateSessionsRequest":
        if self.to_date < self.from_date:
            raise ValueError("to_date debe ser mayor o igual a from_date")
        delta = (self.to_date - self.from_date).days
        if delta > 60:
            raise ValueError("El rango máximo es de 60 días")
        if self.open_hour is not None and self.close_hour is not None:
            if self.open_hour > self.close_hour:
                raise ValueError("La hora de apertura no puede ser mayor que la de cierre")
        return self


class GenerateSessionsResponse(BaseModel):
    created: int
    skipped: int
    dates_processed: int
