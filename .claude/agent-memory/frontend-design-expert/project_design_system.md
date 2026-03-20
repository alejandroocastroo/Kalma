---
name: Kalma frontend design system
description: Design tokens, component patterns, file conventions, and architectural decisions for the Kalma SaaS frontend
type: project
---

## Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- React Query (@tanstack/react-query) for all data fetching
- Recharts for charts (already installed)
- Sonner for toast notifications (toast.success / toast.error)
- Radix UI for Dialog primitives
- date-fns + date-fns-tz (America/Bogota timezone)
- lucide-react for icons

## Card pattern
All admin content cards: `bg-white rounded-2xl border border-gray-100 shadow-sm p-6`

## Color tokens
- Primary: `primary-600` (indigo-ish, #6366f1 in recharts)
- Active badge: `variant="success"` (green-100/700)
- Inactive badge: `variant="secondary"` (gray-100/700)
- Destructive: `variant="destructive"` (red-100/700)

## Typography
- Section headings: `text-base font-semibold text-gray-900`
- Card sub-labels: `text-sm text-gray-500`
- Stat values: `text-2xl font-bold text-gray-900`

## Component locations
- UI primitives: `src/components/ui/` — do NOT modify
- Admin shared: `src/components/admin/` — sidebar, stats-card, session-card
- Landing: `src/components/landing/` — booking-widget

## Sidebar nav
Defined in `src/components/admin/sidebar.tsx` as `navItems` array.
Layout title map is in `src/app/admin/layout.tsx` → `pageTitles`.
Both must be updated together when adding a new admin page.

## Page pattern
All admin pages follow:
1. `'use client'` directive
2. useQuery/useMutation with typed queryKeys
3. Skeleton loading states (import from `@/components/ui/skeleton`)
4. toast.success / toast.error for mutations
5. Dialog + inline form component co-located in the page file
6. Grid of cards: `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`

## API conventions (`src/lib/api.ts`)
- Named export groups: `auth`, `classTypes`, `classSessions`, `clients`, `appointments`, `payments`, `spaces`, `reports`, `schedule`
- All authenticated routes use `apiClient` (has auth + X-Tenant-Slug interceptors)
- Public routes use separate `publicApi` axios instance (no auth headers)
- New types imported from `@/types` and added to the import list in api.ts

## Monetary values
Always use `formatCOP()` from `src/lib/utils.ts`. Never format COP manually.

## Multi-space feature (added 2026-03-19)
- New types: Space, SlotAvailability, RevenueReport, OccupancyReport in `src/types/index.ts`
- New API groups: `spaces` and `reports` in `src/lib/api.ts`
- Admin page: `src/app/admin/espacios/page.tsx`
- Dashboard: occupancy section fetches `reports.occupancy({ from: today, to: today })`
- Agenda: space filter tabs; space color palette (`SPACE_COLORS`) assigned by index
- Caja: horizontal BarChart (layout="vertical") for revenue by space using recharts
- Public widget: step 0 space selection; spaces fetched from `/public/{slug}/spaces` (no auth)

**Why:** Client Mantra Pilates requested multi-space support to differentiate Pilates and Barre rooms.
**How to apply:** When adding features that touch sessions or bookings, consider space_id filtering.

## Hydration pattern (sidebar)
`src/components/admin/sidebar.tsx` reads user data from localStorage via `getStoredUser()`.
This must be deferred with a `mounted` guard (`useState(false)` + `useEffect(() => setMounted(true), [])`)
so the server and client render the same initial HTML (both produce `null` user = initials "U").
**Never** call `getStoredUser()` (or any `localStorage`/`window` API) synchronously at component render time.

## Agenda quick-book modal (added 2026-03-19)
- Clicking any calendar cell opens `QuickBookModal` with `{ day, hour }` props.
- Session card clicks use `e.stopPropagation()` to prevent bubbling to the cell handler.
- `QuickBookModal` has two tabs: "Por hora" (time-grid hour picker) and "Hora específica" (datetime-local input).
- Client search: fetch all via `clients.list({ limit: 100 })`, filter on the frontend with `useMemo`.
- Dropdown uses `onMouseDown` (not `onClick`) to fire before the input `onBlur` hides it.
- After session create + optional appointment create: invalidate `['week-sessions']` and `['appointments']`.

## CreateSessionForm time UX (updated 2026-03-19)
Replaced `datetime-local` input with separate:
- `<input type="date">` for the date
- A grid of hour pill-buttons (6:00–21:00) for start time
- Duration toggle: "1 hora (fija)" | "Personalizada" — custom shows 30/45/60/90 min pills
- Selected pills use `bg-primary-600 text-white`; unselected use `bg-gray-100 text-gray-700 hover:bg-gray-200`

## Session detail modal — manage clients (updated 2026-03-19)
The inline session detail modal (`AgendaPage`) now supports:
- **Remove client:** `appointments.remove(apptId)` via `removeClientMutation` — calls DELETE `/appointments/{id}`.
  - This is a hard delete (row removed from DB), NOT a soft cancel. Toast: "Cliente eliminado de la sesión".
  - Per-appointment loading tracked with `removingApptId` (string | null) state set in `onMutate`.
  - `UserX` icon button, only shown when `appt.status !== 'cancelled'`.
  - On success: invalidate `['appointments', sessionId]` + `['week-sessions']`.
- **Add client:** Collapsible section toggled with `showAddClient` boolean state.
  - Reuses the same `['clients-all']` query (cached from QuickBookModal).
  - Capacity guard: checks `enrolled_count >= capacity` before calling `appointments.create`.
  - Collapse + clear search on success.
  - Only shown when `selectedSession.status !== 'cancelled'`.
- **Space row** in info grid: looks up `spaceList` (already fetched in AgendaPage scope) by `selectedSession.space_id`.
- **Capacity progress bar:** inline `<div>` with `style={{ width: X% }}` overlay, `bg-primary-500`, alongside the `N/M` text.
- Modal `onOpenChange` resets `showAddClient` and `addClientSearch` on close to prevent stale state.

## Space selector in session creation (updated 2026-03-19)
Both `QuickBookModal` and `CreateSessionForm` in `agenda/page.tsx` now:
- Fetch spaces via `useQuery(['spaces'], spaces.list)` — deduped by React Query cache.
- Render an optional space `<select>` below the class type selector (only if spaceList.length > 0).
- Pass `...(spaceId ? { space_id: spaceId } : {})` spread to `classSessions.create`.
- Sessions without space_id are "unassigned" and only appear in the "Todos" filter tab.
- Sessions with space_id appear only under their specific space filter tab.

## Horarios page (added 2026-03-19)
New page at `src/app/admin/horarios/page.tsx` with three sections:
- **WeeklyScheduleSection:** 7 DayCard components (Mon–Sun) in a responsive 2→4→7 column grid.
  - Pill toggle (CSS only, `role="switch"`) for active/inactive. Inactive cards have `opacity-60 bg-gray-50`.
  - Hour dropdowns (0–23) shown only when day is active.
  - Optimistic local state pattern: state updated immediately, then `schedule.updateDay(dayOfWeek, data)` mutation called.
  - API returns fewer than 7 days sometimes — `normaliseDays()` helper merges with default 7-day skeleton.
- **ExceptionsSection:** list from `schedule.exceptions({ from: today, to: yearEnd })`, with inline add form.
  - Date formatted as "lunes 3 de abril, 2026" using date-fns `es` locale.
  - Date parsed as `new Date(year, month-1, day)` (local) to avoid timezone shift.
- **GenerateSessionsSection:** date range + class type + space + capacity inputs → `schedule.generate(...)`.
  - Result banner: `bg-green-50 border border-green-200 rounded-xl p-4` with `CheckCircle2` icon.
  - `skip_existing: true` always passed to avoid duplicate session creation.
- New API group `schedule` added to `src/lib/api.ts`.
- New types `ScheduleDay`, `ScheduleException`, `GenerateSessionsResult` added to `src/types/index.ts`.
- Nav item: `{ href: '/admin/horarios', icon: CalendarDays, label: 'Horarios' }` in sidebar.
- Layout title: `'/admin/horarios': 'Configuración de Horarios'`.
