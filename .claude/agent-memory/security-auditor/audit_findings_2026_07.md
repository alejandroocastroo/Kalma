---
name: audit_findings_2026_07
description: Auditoría completa 2026-07-06 (rama dev) — verificación de fixes previos + nuevos hallazgos de fuga cross-tenant vía FKs no validadas
type: project
---

Auditoría realizada 2026-07-06 en rama `dev`, post-incidente RCE de 2026-04-28.

**CONFIRMADO CORREGIDO desde audit_findings_2026_04 / incident_attack2_2026_04_28**:
- Next.js actualizado a 15.5.15 (RCE CVE-2024-56332/46982 cerrado).
- Access token ahora 15 min (antes 24h) — config.py.
- Refresh token con rotación real (jti + Redis), se invalida al usarse y en logout — auth.py:79-134.
- Rate limiting en /auth/login (10/min) y /auth/refresh (20/min) vía slowapi.
- Cookie `kalma_token` con httpOnly, secure (prod), sameSite lax — session/route.ts.
- `?tenant` query param deshabilitado en producción — tenant.py:32.
- Postgres bind a 127.0.0.1, Redis sin puerto expuesto al host — docker-compose.yml.
- Volumen `./backend:/app` eliminado de producción.
- Headers HTTP de seguridad presentes (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP) — next.config.ts.
- CORS `allow_headers` ahora lista explícita, no wildcard.
- SECRET_KEY: validator bloquea default en producción — config.py:32-42.
- Imágenes remotas: wildcard `'**'` reemplazado por hosts explícitos.
- /docs, /redoc, /openapi.json deshabilitados en producción.
- security_opt no-new-privileges en contenedores backend/frontend.
- Query de borrado de espacio (spaces.py:106-119) confirmada bien parametrizada con bind params (:probe, :tenant) y CAST — no hay SQL injection en todo el backend (único uso de text() fuera de queries de modelo).

**NUEVO — CRÍTICO — patrón recurrente: FKs de recursos relacionados nunca validadas contra tenant_id del usuario en creación/actualización**:
Confirmado independientemente por dos auditorías paralelas. El patrón: endpoints de creación/actualización aceptan `client_id`/`space_id`/`instructor_id`/`plan_id`/`preferred_space_id` en el body y hacen `Model(tenant_id=current_user.tenant_id, **body.model_dump())` SIN validar que esos IDs pertenezcan al tenant del usuario. Las funciones `_enrich()` de cada router luego resuelven esos IDs con `db.get()` plano (sin filtro tenant_id), exponiendo nombre/datos de recursos de OTRO tenant.
Ubicaciones confirmadas:
- `payments.py:129-168` (`create_payment`, `update_payment`, `_enrich` líneas 20-34) — expone client_name/space_name/instructor_name de otro tenant.
- `appointments.py:59-94` (`create_appointment`, `_enrich` líneas 26-39) — expone client_name, client_phone, **client_notes (datos de salud)** de otro tenant.
- `memberships.py:277-368` (`create_membership`, `create_membership_v2`) — expone client/plan/preferred_space de otro tenant.
- `class_sessions.py` (`create_session` líneas 223-283, `quick_book` líneas 286-409, `update_session` líneas 412-432) — space_id/instructor_id nunca validados; update_session permite re-apuntar sesión existente a espacio/instructor de otro tenant en cualquier momento vía setattr ciego.
- Transitivo: `export.py:482-493` (reporte Excel contable) filtra nombres de otro tenant si un Payment ya tiene FK contaminada.
- Defensa en profundidad pendiente (hoy no explotable de forma aislada, depende de los anteriores): `clients.py:210`, `cobros.py:142-149`.

Fix recomendado (arquitectural, no puntual): helper único `assert_owned_by_tenant(model, id, tenant_id, db)` reusado en los ~6 puntos de creación/actualización, y añadir `tenant_id` a TODOS los `db.get()` dentro de funciones `_enrich()`.

**SIGUE ABIERTO (de auditorías previas)**:
- `middleware.ts:16-23,72-75` `decodeJwtPayload` no verifica firma JWT — bypass del gate de UI a /superadmin (backend sigue protegido, impacto limitado a shell/UI).
- Tokens (access+refresh) siguen en localStorage además de la cookie httpOnly — anula la protección XSS de la cookie (`frontend/src/lib/auth.ts:17,25`).
- `python-jose==3.3.0` (CVE-2024-33663/33664 algorithm confusion) sin actualizar — requirements.txt:8.
- `bcrypt==3.2.2` (truncamiento silencioso a 72 bytes) sin actualizar — requirements.txt:10.
- Dockerfile backend sin instrucción `USER` — uvicorn corre como root.
- CSP mantiene `unsafe-eval`/`unsafe-inline` en script-src — next.config.ts:31.
- docker-compose.yml mantiene defaults débiles hardcoded como fallback (kalmapassword, kalmaRedis123, super-secret-key-change-in-production-min-32-chars) — líneas 11,32,55.
- No se pudo verificar operacionalmente si los secretos comprometidos en el incidente 2026-04-28 (SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD) fueron rotados en el servidor real — eso está fuera del repo.

**NUEVO — otros hallazgos**:
- `public.py:77-149` endpoint `/public/{slug}/schedule` (fallback sin match directo de slug) sin rate limiting, escanea todos los tenants/espacios activos con regex Python — vector DoS de bajo costo, no autenticado.
- `public.py:191,226-227` reserva pública sin lock — condición de carrera permite overbooking (enrolled_count incrementado sin SELECT FOR UPDATE ni constraint atómica).
- `public.py:188` `uuid.UUID(class_session_id)` sin try/except en endpoint público no autenticado → 500.
- Patrón sistémico: 50 ocurrencias de `uuid.UUID(x)` sin try/except en 12 routers → 500 en vez de 400/422 ante input malformado (no filtra stack trace, pero degrada UX/logging).
- `PublicBookingRequest` (public.py:21-25) sin EmailStr, sin longitud máxima en full_name/phone — permite contaminación de datos/spam del CRM.
- `UserCreate` schema (con role/tenant_id libres) confirmado como código muerto, no usado en ningún endpoint — sin riesgo actual.

**Verificado OK (positivo)**: mass assignment en SpaceCreate/Update, ClientCreate/Update, ClientMembershipCreate/Update, PlanCreate/Update — schemas correctamente acotados. No hay dangerouslySetInnerHTML en frontend. superadmin.py usa require_superadmin correctamente en todas las rutas — un admin normal no puede invocar rutas de superadmin (403 confirmado).

**Why**: Auditoría de seguimiento tras el incidente RCE de abril — la mayoría de hallazgos críticos de infraestructura/auth ya fueron corregidos, pero apareció una clase nueva y más grave de vulnerabilidad de aislamiento de datos (fuga cross-tenant vía FKs no validadas) que no se había detectado en la auditoría de abril porque esa se centró más en infra/auth que en lógica de negocio por router.
**How to apply**: Antes de próxima auditoría, verificar si `assert_owned_by_tenant` (o equivalente) fue implementado y aplicado a los 6 puntos listados arriba. No re-flaggear los ítems de la sección "CONFIRMADO CORREGIDO". Este es ahora el hallazgo prioritario #1 del proyecto.
