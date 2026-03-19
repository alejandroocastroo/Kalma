import asyncio
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://kalma:kalmapassword@localhost:5432/kalma")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "dev-secret-key-minimo-32-caracteres-ok")
from seed import seed
asyncio.run(seed())
