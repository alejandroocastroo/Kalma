---
name: kalma_security_context
description: Stack, auth architecture, tenant isolation model, and recurring security patterns for kalma-app (updated 2026-07-06)
type: project
---

FastAPI + SQLAlchemy 2.0 async + PostgreSQL backend. Next.js 15 App Router frontend (next@15.5.15).

**Auth model (current as of 2026-07-06)**: JWT (HS256 via python-jose 3.3.0) with access (15 min, config.py) + refresh (30-day, rotated with jti stored in Redis, invalidated on use and on logout — auth.py:79-134) tokens. Rate limited via slowapi: login 10/min, refresh 20/min. Auth cookie `kalma_token` now has httpOnly + secure (prod) + sameSite lax (session/route.ts). BUT access_token/refresh_token are ALSO still stored in localStorage for `apiClient` — this duplicate storage defeats the httpOnly cookie's XSS protection (frontend/src/lib/auth.ts:17,25).

**Tenant isolation model**: Tenant resolved via X-Tenant-Slug header, subdomain, or `?tenant` query param (query param now disabled in production — tenant.py:32). Isolation enforced per-query with `WHERE tenant_id = current_user.tenant_id` on the PRIMARY resource. No row-level security at DB level.

**Known architectural gap (critical, open as of 2026-07-06)**: creation/update endpoints across several routers accept related-resource FKs (client_id, space_id, instructor_id, plan_id, preferred_space_id) in the request body and do NOT validate those FKs belong to current_user.tenant_id before insert/update. The per-router `_enrich()` helpers that resolve those FKs for display (`db.get(Client, id)`, `db.get(Space, id)`, etc.) also don't filter by tenant. Net effect: a user in Tenant A can reference a resource ID from Tenant B and get that resource's name/PII echoed back in API responses. Confirmed in payments.py, appointments.py (leaks client health notes), memberships.py, class_sessions.py; transitively in export.py. See [[audit_findings_2026_07]] for exact line numbers. This is now the top-priority open finding — check before re-flagging as new.

**Role model**: superadmin, admin, staff, instructor, client. `require_superadmin` dependency correctly guards all /superadmin backend routes (verified 403 for non-superadmin). Frontend /superadmin page guard in middleware.ts uses `decodeJwtPayload` which only base64-decodes the payload WITHOUT verifying the JWT signature — a forged token with `role: superadmin` bypasses the Next.js middleware gate to reach the /superadmin UI shell. Real data stays protected because the backend API independently verifies the signature (jwt.py `verify_token`) — so impact is UI-shell access only, not data leakage, unless a /superadmin page ever renders sensitive data without an API round-trip.

**Recurring patterns identified (status as of 2026-07-06)**:
- FIXED: rate limiting now present on auth + public booking endpoints (still absent on public.py's slug-fallback /schedule endpoint — DoS vector).
- FIXED: `?tenant` query param backdoor disabled in production.
- FIXED: refresh token now rotated/revoked on use (jti + Redis).
- FIXED: auth cookie now httpOnly/secure/sameSite — but see localStorage duplication above.
- FIXED: CORS allow_headers is now an explicit list, not wildcard.
- FIXED: HTTP security headers present (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP).
- FIXED: Postgres/Redis no longer bound to 0.0.0.0.
- FIXED: images wildcard remote pattern replaced with explicit hosts.
- FIXED: access token lifetime now 15 min (was 24h).
- OPEN: hardcoded weak defaults still present as fallback in docker-compose.yml (used only if env vars unset — check prod env vars are actually set).
- OPEN: CSP still has unsafe-eval/unsafe-inline in script-src.
- OPEN: python-jose 3.3.0 (algorithm confusion CVE) and bcrypt 3.2.2 (72-byte silent truncation) not upgraded.
- OPEN: backend Dockerfile has no USER instruction — uvicorn runs as root in container.
- OPEN (new class, see above): cross-tenant FK injection via unvalidated related-resource IDs in create/update endpoints + tenant-blind `_enrich()` helpers.
- OPEN: systemic pattern — ~50 call sites of `uuid.UUID(x)` across 12 routers with no try/except, causing 500s (not 400/422) on malformed IDs. No global exception handler for ValueError in main.py.
- OPEN: public booking endpoint has no DB-level lock/atomic constraint on enrolled_count vs capacity — race condition allows overbooking under concurrent requests.
- Not yet re-verified: Tenant name injected unsanitized into Content-Disposition filename header (export.py) — was open in April, not explicitly re-checked in July audit.

**Why**: Baseline updated 2026-07-06 after full re-audit (see [[audit_findings_2026_07]]). Most infra/auth findings from the April incident are now fixed; the center of gravity has shifted to business-logic tenant isolation (FK validation) as the top open risk.
**How to apply**: Use this to avoid re-flagging fixed issues and to prioritize the FK-validation gap first in any follow-up work. Verify current state before trusting any single line here if significant time has passed — check audit_findings_2026_07.md for exact file:line citations.
