---
name: incident_attack2_2026_04_28
description: Active exploitation incident 2026-04-28 — Next.js 15.0.3 RCE via CVE-2024-46982/CVE-2024-56332, attacker executed env and ls in frontend container
type: project
---

Active exploitation confirmed on 2026-04-28 in the frontend Next.js container.

**Root cause**: next@15.0.3 is vulnerable to CVE-2024-56332 (middleware bypass via x-middleware-subrequest header) and CVE-2024-46982 (RCE via manipulated internal headers in standalone mode). CVSS 9.1 each.

**Attack trace confirmed**:
1. Attacker bypassed middleware via CVE-2024-56332
2. Executed `env` — obtained INTERNAL_API_URL, NODE_ENV, and likely SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD
3. Executed `ls -la /app` — recon of container filesystem
4. Attempted dropper: `echo <base64> | base64 -d | bash` — FAILED because Alpine Linux has no bash
5. Error surfaced in app-page.runtime.prod.js logs — confirms SSR execution context

**All secrets are compromised**: SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD must be rotated immediately.

**What stopped the attack**: Alpine Linux image has no `bash`. Next iteration will use `sh` or `ash`.

**Immediate fixes required**:
- Update next to 15.2.4+ (fixes both CVEs)
- Rotate all secrets in .env
- Audit ./backend:/app volume for modified files (writable volume in production)
- Add nginx header filtering: block x-middleware-subrequest, x-invoke-path, x-matched-path
- Add read_only: true, cap_drop: ALL, no-new-privileges to frontend container in compose
- Remove ./backend:/app volume mount in production (docker-compose.yml line 65)

**Secondary findings from this audit**:
- Backend Dockerfile has no USER instruction — uvicorn runs as root
- python-jose 3.3.0 has CVE-2024-33664/33663 (JWT algorithm confusion) — especially critical given SECRET_KEY compromise
- bcrypt 3.2.2 has silent truncation at 72 bytes — upgrade to 4.2.0
- next.config.ts CSP has unsafe-eval — remove it
- middleware.ts decodeJwtPayload does NOT verify JWT signature — only base64 decodes payload — superadmin role check bypassable

**Why**: Recorded 2026-04-28 as active incident context. All future audits should verify Next.js version and confirm secrets have been rotated.
**How to apply**: Before any future audit, verify next version is >= 15.2.4 and confirm incident secrets were rotated. Do not re-flag these as new findings if fixed.
