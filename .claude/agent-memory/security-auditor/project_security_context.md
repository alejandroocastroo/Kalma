---
name: kalma_security_context
description: Stack, auth architecture, tenant isolation model, and recurring security patterns for kalma-app
type: project
---

FastAPI + SQLAlchemy 2.0 async + PostgreSQL backend. Next.js 15 App Router frontend.

**Auth model**: JWT (HS256 via python-jose) with access (1-day) + refresh (30-day) tokens. Both tokens signed with the same SECRET_KEY. No token revocation / blocklist — refresh tokens are stateless. Tokens stored in localStorage + a plain `kalma_token` cookie (no HttpOnly, no Secure, no SameSite flags set).

**Tenant isolation model**: Tenant resolved via X-Tenant-Slug header (from nginx or client), subdomain, or `?tenant` query param. Isolation enforced per-query with `WHERE tenant_id = current_user.tenant_id`. No row-level security at DB level.

**Role model**: superadmin, admin, staff, instructor, client. `require_superadmin` dependency guards /superadmin routes on backend correctly. Frontend /superadmin guard is client-side only (localStorage read), not SSR-enforced.

**Recurring patterns identified**:
- No rate limiting anywhere (auth, public booking, API)
- `?tenant` query param is a dev backdoor left active in production code
- Both access and refresh tokens share the same signing secret and algorithm — no token type enforcement beyond a "type" claim check
- refresh token is not revoked on use (no rotation invalidation in DB)
- Auth cookie is non-HttpOnly and non-Secure — XSS readable
- `allow_headers=["*"]` on CORS
- No HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- PostgreSQL and Redis ports 5432/6379 exposed on 0.0.0.0 in docker-compose.yml
- Hardcoded weak defaults in config.py and docker-compose.dev.yml
- Tenant name injected unsanitized into Content-Disposition filename header
- Images wildcard remote pattern in next.config.ts (`hostname: '**'`)
- No password strength requirement on admin password creation (only min 8 chars via Zod)
- ACCESS_TOKEN_EXPIRE_MINUTES set to 60*24 (1 full day) — very long
- Admin layout has no server-side auth check — relies entirely on middleware cookie check

**Why**: Recorded 2026-04-21 as baseline for future audits. Check this before re-flagging issues.
**How to apply**: Use this to avoid re-flagging issues already documented and to understand the existing architecture when auditing new code.
