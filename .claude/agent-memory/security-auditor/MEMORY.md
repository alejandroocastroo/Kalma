# Memory Index — Security Auditor (kalma-app)

- [project_security_context.md](project_security_context.md) — Stack, auth architecture, tenant isolation model, known patterns (updated 2026-07-06)
- [audit_findings_2026_04.md](audit_findings_2026_04.md) — First full audit findings (superseded by audit_findings_2026_07.md — kept for history)
- [incident_attack2_2026_04_28.md](incident_attack2_2026_04_28.md) — Active RCE incident: next@15.0.3 CVE-2024-56332 — RESOLVED as of 2026-07-06 (next upgraded to 15.5.15)
- [audit_findings_2026_07.md](audit_findings_2026_07.md) — 2026-07-06 audit: most 04-26 infra/auth fixes confirmed; NEW critical class found — cross-tenant FK injection via unvalidated client_id/space_id/instructor_id/plan_id in payments/appointments/memberships/class_sessions
