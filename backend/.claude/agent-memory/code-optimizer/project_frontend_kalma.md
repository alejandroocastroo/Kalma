---
name: project_frontend_kalma
description: Auditoría frontend kalma-app (Next.js App Router) 2026-07-06 — hallazgos de rendimiento, timezone y monolitos
metadata:
  type: project
---

Auditoría de solo lectura del frontend (`frontend/src/app/admin`, `superadmin`, `components`, `lib`) hecha el 2026-07-06. Contexto: [[project_kalma]], [[project_timezone_per_tenant]].

**Patrón recurrente — debounce inconsistente en búsquedas:** `caja/page.tsx` (líneas 574-578) debounce correcto de 300ms para búsqueda de cliente. Pero `clientes/page.tsx:83`, `membresias/page.tsx:765` (búsqueda principal) y `membresias/page.tsx:1032` (dropdown de cliente) disparan un query nuevo en CADA keystroke, sin debounce — golpea el backend en cada tecla. Al tocar estos archivos, replicar el patrón de `caja/page.tsx`.

**Patrón recurrente — timezone del tenant ignorado en cálculos de rango (no solo en display):** Existe `formatInTenantTz()` en `lib/utils.ts` y es usado correctamente para mostrar fechas, pero varias páginas siguen usando `new Date()` del navegador para calcular rangos que se mandan al backend (no solo para mostrar): `caja/page.tsx` (`getPeriodDates`, líneas 21-37, y defaults en 73-74) y `dashboard/page.tsx` (`monthStart`/`monthEnd`, líneas 19-21) — irónico porque el MISMO archivo dashboard/page.tsx línea 51/57 SÍ usa `formatInTenantTz` con un comentario explícito "comparando en la zona del tenant, no la del navegador" para las sesiones de hoy. `membresias/page.tsx:158` es peor: usa `new Date().toISOString().slice(0,10)` que da la fecha en UTC (no siquiera hora local del navegador), afectando la búsqueda de sesiones disponibles para reposición en horas de la tarde/noche en Bogotá (UTC-5). Ver [[project_timezone_per_tenant]] — esto es la Fase 2 del backend aplicada de forma incompleta en el frontend.

**Monolitos confirmados por línea:** `MembresiasPage` (membresias/page.tsx) es una sola función de componente de la línea 301 a ~1574 (>1270 líneas). `AgendaPage` (agenda/page.tsx) de la línea 775 a ~1542 (>760 líneas). Mezclan data-fetching, mutaciones, lógica de negocio y JSX de múltiples diálogos en un solo scope.

**Agenda: grilla semanal recalcula filtrado en cada render sin memoización.** `agenda/page.tsx` líneas 995-996 (`getSessionsForDay`) y 1119-1160 (el grid `HOURS.map` × `weekDays.map`, HOURS tiene 18 horas × 7 días = 126 celdas) — cada celda llama `getSessionsForDay(day).filter(...)` que recorre TODO el array de sesiones de la semana, sin `useMemo`. `agenda/page.tsx` no tiene ningún `useCallback`/`React.memo` (solo 2 `useMemo` en todo el archivo, líneas 139 y 927). Cualquier cambio de estado local (abrir dropdown, editar nombre) re-renderiza y recalcula el grid completo.

**Ningún query en `src/app/admin/*` maneja `isError`** — solo `isLoading`. Si el backend falla, las páginas muestran silenciosamente "sin resultados" en vez de un error real. Verificado con grep, 0 ocurrencias de `isError` en todo `src/app/admin`.

**Holidays hardcodeados a Colombia:** `horarios/page.tsx:243` llama `schedule.holidays({..., country: 'CO'})` fijo, sin importar el tenant. No existe helper `getTenantCountry()` en el frontend. Con tenants fuera de Colombia (México mencionado en memoria de timezone), la función de "bloquear festivos" al generar sesiones recurrentes usará festivos incorrectos.

**Lo que SÍ está bien (no tocar):** Los formularios de creación/edición con mutaciones (pagos en caja, membresías, renovaciones, cancelaciones) consistentemente usan `disabled={mutation.isPending}` o un estado `loading` propio — no se encontró riesgo de doble-submit/doble-cobro en ningún flujo revisado. El backend valida capacidad de sesión server-side (`appointments.py:71`) aunque el frontend también chequea client-side — no hay riesgo real de overbooking por dato stale.
