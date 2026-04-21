---
name: audit_findings_2026_04
description: Full security audit findings from 2026-04-21 — severity map and open issues
type: project
---

Audit performed 2026-04-21 on branch feat-cobros.

**CRITICAL (open)**:
- No rate limiting on /auth/login, /auth/refresh, /public/{slug}/book
- Auth cookie (kalma_token) has no HttpOnly, Secure, or SameSite flags — XSS extractable, CSRF risk
- ?tenant query param active in TenantMiddleware — allows any user to impersonate any tenant context

**HIGH (open)**:
- Refresh token not invalidated/revoked on use — indefinite reuse possible
- Access token lifetime = 24 hours (very long)
- PostgreSQL port 5432 and Redis port 6379 bound to 0.0.0.0 in docker-compose.yml
- No HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Tenant name injected unsanitized into Content-Disposition filename in export.py:489
- Wildcard image remote pattern in next.config.ts allows loading images from any HTTPS host
- Hardcoded weak SECRET_KEY default in config.py and docker-compose.dev.yml
- Hardcoded weak DB/Redis credentials in docker-compose.dev.yml (no env var fallback)
- Seed credentials admin@mantra.com / mantra123 in seed.py — run unconditionally on container start

**MEDIUM (open)**:
- Frontend /superadmin role check is client-side only (localStorage) — bypassable with devtools
- No Pydantic enum validation on PaymentCreate.type, .category, .payment_method — free-form strings accepted
- LIKE wildcard search on clients/memberships has no length cap — potential DoS via very long search strings
- allow_headers=["*"] on CORS allows arbitrary custom headers
- Admin password policy: only min 8 chars (no complexity requirement on superadmin-created admin accounts)

**LOW (open)**:
- FastAPI /docs and /openapi.json endpoints are publicly accessible (no auth)
- Nginx config missing: no request size limits on /api, no rate limiting at proxy layer
- redis in docker-compose.dev.yml has no password (no --requirepass flag)
- next.config.ts rewrites NEXT_PUBLIC_API_URL directly — if var is empty, falls back to localhost

**Why**: Baseline findings from first full audit.
**How to apply**: Check this list before raising any finding — update status to "fixed" when resolved.
