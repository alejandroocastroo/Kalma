import os
import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://kalma:kalmapassword@localhost:5432/kalma"
    REDIS_URL: str = "redis://:kalmaRedis123@localhost:6379/0"
    SECRET_KEY: str = "super-secret-key-change-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:8080"]
    APP_NAME: str = "Kalma"
    TIMEZONE: str = "America/Bogota"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v) -> List[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_changed(cls, v: str, info) -> str:
        default = "super-secret-key-change-in-production-min-32-chars"
        env = os.getenv("ENVIRONMENT", "development")
        if v == default and env == "production":
            raise ValueError(
                "SECRET_KEY no puede ser el valor por defecto en producción. "
                "Genera uno con: openssl rand -hex 32"
            )
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
