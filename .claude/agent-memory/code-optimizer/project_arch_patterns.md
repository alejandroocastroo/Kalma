---
name: Kalma architecture and optimization patterns
description: Key architectural patterns, recurring anti-patterns, and optimization notes found during code review of memberships/cobros modules
type: project
---

## Architecture patterns confirmed

- Backend: FastAPI + SQLAlchemy 2.0 async + PostgreSQL. All routers use `AsyncSession` via `get_db` dependency.
- `_enrich()` helper pattern used in both `memberships.py` and `appointments.py` — this is the primary source of N+1 queries across the app.
- All relationship fields use `lazy="noload"` intentionally, which means joins must be done manually.
- Frontend: TanStack Query with global `staleTime: 30_000` in `providers.tsx`. Per-query overrides exist where needed.

## Confirmed anti-patterns (recurring)

1. **N+1 in _enrich()**: `memberships.py::_enrich()` fires 2–4 individual `db.get()` calls per membership row (Client, Plan, Space, MakeupSession query). With 20 items per page, this is 60–80 extra queries per list request.

2. **N+1 in cobros.py**: The `get_cobros()` endpoint fires one `db.execute(select(MakeupSession))` query **per client** inside a Python for-loop (line 131). With 50 clients this is 50 individual DB roundtrips on every page load.

3. **N+1 in appointments.py**: `_enrich()` fires 3 individual `db.get()` calls per appointment (Client, ClassSession, ClassType).

4. **auto-deduct on mount**: `membresias/page.tsx` calls `memberships.autoDeduct()` silently in a `useEffect` with empty deps on every page mount. This fires a write DB operation every time the admin opens the memberships page.

5. **Duplicate debt query**: `cobros.py` runs two separate queries to get debt data — one for counts, one for IDs — when a single query with both columns would suffice.

6. **formatShortDate duplicated**: Defined in both `frontend/src/lib/utils.ts` and locally in `frontend/src/app/admin/membresias/page.tsx` (line 81). The local version uses a different implementation (manual string split vs parseISO).

7. **`any` types in mutation onError**: All mutation `onError` handlers use `(e: any)` in `membresias/page.tsx`. Should use typed Axios error.

**Why:** These were found in the first deep review (2026-04-21). The N+1 in cobros is the most critical because the cobros endpoint is a high-frequency admin dashboard load with no pagination.

**How to apply:** When reviewing any new router that iterates over a result set and makes DB calls per row, flag it immediately as N+1.
