---
name: project_kalma_backend
description: Kalma SaaS backend — stack, architecture, DB patterns, and established conventions
type: project
---

Stack: FastAPI + SQLAlchemy async (asyncpg) + PostgreSQL. Pydantic v2 schemas. Uvicorn with WatchFiles hot-reload inside Docker (container: kalma_backend, DB: kalma_db).

Architecture layers: routers (controllers + service logic combined) → SQLAlchemy ORM models → PostgreSQL. No separate service/repository layer — business logic lives directly in route handlers.

Transaction pattern: `autocommit=False`, `autoflush=False`. All routes call `await db.commit()` directly. For multi-step atomic operations use `await db.flush()` to get generated PKs before the final `await db.commit()`. No `async with db.begin()` usage anywhere — do not introduce it.

Route ordering: static path segments (e.g. `/quick-book`, `/week`) MUST be registered before parameterized routes (e.g. `/{session_id}`) to avoid FastAPI attempting UUID coercion on the literal string.

Enrichment pattern: each router module has a private `_enrich(obj, db)` async helper that serializes the ORM model via `SomeResponse.model_validate(obj).model_dump()` and then attaches denormalized fields (names, colors) via separate `db.get()` calls. Reuse within the same module; for cross-router enrichment, inline the logic to avoid circular imports.

Multi-tenancy: every model has `tenant_id` (UUID FK). Every query filters by `current_user.tenant_id`. Tenant context is set via `X-Tenant-Slug` header and resolved by `TenantMiddleware`.

DB access in tests/curl: `docker exec kalma_db psql -U kalma -d kalma -c "..."`.

**Why:** Document for future sessions so conventions are followed without re-reading every file.
**How to apply:** Follow these patterns on every new endpoint — commit pattern, enrichment pattern, route ordering, tenant filtering.
