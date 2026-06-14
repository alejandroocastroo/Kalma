'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, RotateCcw, Pencil, RefreshCw, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react'
import { plans as plansApi, memberships, clients as clientsApi, spaces as spacesApi, classSessions, payments as paymentsApi } from '@/lib/api'
import type { ClientMembership, Plan, Client, WeeklyStats, AutoBookResult, ClassSession } from '@/types'
import { formatCurrency, getApiErrorMessage } from '@/lib/utils'
import { getTenantCurrency } from '@/lib/auth'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type StatusFilter = 'all' | 'active' | 'paused' | 'cancelled'

function MonthlyUsageBar({ membershipId }: { membershipId: string }) {
  const { data: stats } = useQuery<WeeklyStats>({
    queryKey: ['weekly-stats', membershipId],
    queryFn: () => memberships.weeklyStats(membershipId),
    staleTime: 5 * 60 * 1000,
  })
  if (!stats) return <div className="h-4 w-full bg-gray-100 rounded-full animate-pulse" />

  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>
        <span className="font-semibold text-gray-700">{stats.used_this_month}</span> asistidas este mes
        {stats.pending_this_month > 0 && (
          <span className="text-gray-400"> · {stats.pending_this_month} reservadas</span>
        )}
      </span>
      {stats.makeup_credits > 0 && (
        <span className="text-amber-500">+{stats.makeup_credits} repos.</span>
      )}
    </div>
  )
}

function formatSafeDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy', { locale: es })
  } catch {
    return dateStr
  }
}

function statusBadgeVariant(status: ClientMembership['status']) {
  if (status === 'active') return 'success' as const
  if (status === 'paused') return 'secondary' as const
  return 'destructive' as const
}

function statusLabel(status: ClientMembership['status']) {
  if (status === 'active') return 'Activa'
  if (status === 'paused') return 'Pausada'
  return 'Cancelada'
}

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Activas' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'cancelled', label: 'Canceladas' },
]

function MakeupDialogContent({
  membership, step, originalDate, selectedSession, sessionSearch,
  onOriginalDateChange, onSessionSearchChange, onSelectSession,
  onNextStep, onBack, onConfirm, isPending, onClose,
}: {
  membership: ClientMembership | null
  step: 1 | 2
  originalDate: string
  selectedSession: ClassSession | null
  sessionSearch: string
  onOriginalDateChange: (d: string) => void
  onSessionSearchChange: (s: string) => void
  onSelectSession: (s: ClassSession | null) => void
  onNextStep: () => void
  onBack: () => void
  onConfirm: () => void
  isPending: boolean
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: availableSessions = [], isLoading: loadingSessions } = useQuery<ClassSession[]>({
    queryKey: ['class-sessions-makeup', today, thirtyDaysAhead],
    queryFn: () => classSessions.list({ start: today, end: thirtyDaysAhead }),
    enabled: step === 2,
  })

  const filtered = availableSessions.filter(s => {
    const hasSpace = s.enrolled_count < s.capacity
    if (!hasSpace) return false
    if (!sessionSearch) return true
    const label = `${s.class_type_name ?? ''} ${s.space_name ?? ''} ${s.start_datetime ?? ''}`.toLowerCase()
    return label.includes(sessionSearch.toLowerCase())
  })

  const makeupInfo = membership
    ? `${membership.makeups_allowed - membership.makeups_used} reposición(es) disponible(s) de ${membership.makeups_allowed}`
    : ''

  if (step === 1) {
    return (
      <div className="space-y-5 py-2">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">1</span>
          <span className="text-gray-700 font-medium">Clase perdida</span>
          <ChevronRight className="w-3 h-3" />
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-xs font-bold">2</span>
          <span>Fecha de reposición</span>
        </div>

        <p className="text-sm text-gray-500">{makeupInfo}</p>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">¿Qué clase perdió el cliente? *</label>
          <Input
            type="date"
            value={originalDate}
            onChange={e => onOriginalDateChange(e.target.value)}
            max={today}
          />
          <p className="text-xs text-gray-400">Selecciona la fecha de la clase que no pudo asistir.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onNextStep} className="bg-primary-600 hover:bg-primary-700 text-white gap-1.5">
            Siguiente <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-2">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold">1</span>
        <span className="text-gray-400 line-through">{originalDate}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">2</span>
        <span className="text-gray-700 font-medium">Elige la clase de reposición</span>
      </div>

      <Input
        placeholder="Buscar por espacio, clase..."
        value={sessionSearch}
        onChange={e => onSessionSearchChange(e.target.value)}
        className="text-sm"
      />

      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {loadingSessions ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No hay clases disponibles con cupo en los próximos 30 días</p>
        ) : (
          filtered.map(session => {
            const isSelected = selectedSession?.id === session.id
            const dt = new Date(session.start_datetime)
            const dateLabel = format(dt, "EEE d MMM · HH:mm", { locale: es })
            const spotsLeft = session.capacity - session.enrolled_count
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(isSelected ? null : session)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{dateLabel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {session.class_type_name ?? 'Clase'}{session.space_name ? ` · ${session.space_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${spotsLeft <= 1 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {spotsLeft} cupo{spotsLeft !== 1 ? 's' : ''}
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {selectedSession && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          Reposición agendada para: <span className="font-semibold">{format(new Date(selectedSession.start_datetime), "EEE d MMM · HH:mm", { locale: es })}</span>
          {membership?.membership_type === 'session_based' && membership.expiry_date && selectedSession.start_datetime.slice(0,10) > membership.expiry_date && (
            <span className="ml-1 text-amber-600">· La fecha de vencimiento se extenderá hasta este día</span>
          )}
        </div>
      )}

      <div className="flex justify-between gap-2 pt-1">
        <Button variant="outline" onClick={onBack}>← Atrás</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            disabled={!selectedSession || isPending}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {isPending ? 'Guardando...' : 'Confirmar reposición'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function MembresiasPage() {
  const qc = useQueryClient()
  const currency = getTenantCurrency()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [spaceFilter, setSpaceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClientMembership | null>(null)
  const [makeupTarget, setMakeupTarget] = useState<ClientMembership | null>(null)
  const [makeupStep, setMakeupStep] = useState<1 | 2>(1)
  const [makeupOriginalDate, setMakeupOriginalDate] = useState('')
  const [makeupSelectedSession, setMakeupSelectedSession] = useState<ClassSession | null>(null)
  const [makeupSessionSearch, setMakeupSessionSearch] = useState('')
  const [bonusTarget, setBonusTarget] = useState<ClientMembership | null>(null)
  const [bonusQuantity, setBonusQuantity] = useState('1')
  const [bonusNotes, setBonusNotes] = useState('')
  const [renewTarget, setRenewTarget] = useState<ClientMembership | null>(null)
  const [renewDate, setRenewDate] = useState('')
  const [renewAmount, setRenewAmount] = useState('')
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('cash')
  const [sessionWarning, setSessionWarning] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [form, setForm] = useState({
    client_id: '',
    plan_id: '',
    membership_type: 'monthly' as 'monthly' | 'session_based' | 'weekly_sessions' | 'hybrid_fixed' | 'hybrid_monthly',
    start_date: '',
    end_date: '',
    sessions_per_week: '' as '' | '2' | '3' | '5',
    scheduled_days: [] as string[],
    // hybrid: space_quotas_with_days = [{space_id, sessions_per_week, scheduled_days}]
    space_quotas_with_days: [] as { space_id: string; sessions_per_week: number; scheduled_days: string[] }[],
    makeups_allowed: '1',
    notes: '',
    preferred_days: [] as number[],
    preferred_hour: '' as string | '',
    preferred_space_id: '',
    // session_based/hybrid_fixed: horario por día [{day:0,hour:9,space_id?}]
    preferred_schedule: [] as { day: number; hour: number | ''; space_id?: string }[],
  })
  // Client search autocomplete
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [selectedClientName, setSelectedClientName] = useState('')

  // Auto-deduct on mount — throttled to once every 10 min to avoid DB writes on every visit
  useEffect(() => {
    const THROTTLE_KEY = 'kalma_autodeduct_last'
    const THROTTLE_MS = 10 * 60 * 1000
    const last = Number(localStorage.getItem(THROTTLE_KEY) || 0)
    if (Date.now() - last < THROTTLE_MS) return
    memberships.autoDeduct()
      .then(() => localStorage.setItem(THROTTLE_KEY, String(Date.now())))
      .catch(() => {})
  }, [])

  const { data: membershipsData, isLoading } = useQuery({
    queryKey: ['memberships', statusFilter, search, spaceFilter, page],
    queryFn: () => memberships.list({
      status: statusFilter !== 'all' ? statusFilter : 'not_cancelled',
      search: search || undefined,
      space_id: spaceFilter || undefined,
      sort_by: statusFilter === 'active' ? 'fullness' : undefined,
      page,
      limit: 20,
    }),
  })
  const membershipsList = membershipsData?.items ?? []
  const totalPages = membershipsData?.pages ?? 1

  const { data: plansData } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: plansApi.list,
  })

  const { data: spacesList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.list,
  })

  const { data: clientSearchResults = [] } = useQuery<Client[]>({
    queryKey: ['clients-search', clientSearch],
    queryFn: () => clientsApi.list({ search: clientSearch || undefined, limit: 20 }).then(r => r.items),
    enabled: clientDropdownOpen,
  })
  const plansList: Plan[] = plansData ?? []

  const autoDeductMutation = useMutation({
    mutationFn: () => memberships.autoDeduct(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      qc.invalidateQueries({ queryKey: ['weekly-stats'] })
      if (data.updated > 0) {
        toast.success(`${data.updated} asistencias sincronizadas`)
      } else {
        toast.success('Sincronización completada')
      }
    },
    onError: () => toast.error('Error al sincronizar'),
  })

  const autoBookMutation = useMutation({
    mutationFn: (id: string) => memberships.autoBook(id),
    onSuccess: (data: AutoBookResult) => {
      qc.invalidateQueries({ queryKey: ['weekly-stats'] })
      qc.invalidateQueries({ queryKey: ['memberships'] })
      if (data.booked > 0) {
        toast.success(`✓ ${data.booked} clases agendadas automáticamente en el calendario`)
      } else {
        toast.success('Horario guardado. No hay sesiones creadas aún para esos días/hora este mes.')
      }
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'No se pudo agendar automáticamente. Verifica el horario configurado.')),
  })

  const createMutation = useMutation({
    mutationFn: (data: { client_id: string; plan_id: string; start_date: string; end_date?: string; notes?: string; preferred_days?: number[]; preferred_hour?: number; preferred_space_id?: string }) =>
      memberships.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Membresía creada')
      setDialogOpen(false)
      if (form.preferred_days.length > 0 && form.preferred_hour !== '') {
        autoBookMutation.mutate(created.id)
      }
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al crear membresía')),
  })

  const createV2Mutation = useMutation({
    mutationFn: (data: Parameters<typeof memberships.createV2>[0]) =>
      memberships.createV2(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Membresía creada')
      setDialogOpen(false)
      const shouldAutoBook = (form.membership_type === 'session_based' || form.membership_type === 'hybrid_fixed')
        ? form.preferred_schedule.some(e => e.hour !== '')
        : false
      if (shouldAutoBook) autoBookMutation.mutate(created.id)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al crear membresía')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientMembership> }) =>
      memberships.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Membresía actualizada')
      setDialogOpen(false)
      const shouldAutoBook = (form.membership_type === 'session_based' || form.membership_type === 'hybrid_fixed')
        ? form.preferred_schedule.some(e => e.hour !== '')
        : false
      if (shouldAutoBook) autoBookMutation.mutate(updated.id)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al actualizar')),
  })

  const createMakeupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { original_date: string; makeup_date?: string; class_session_id?: string } }) =>
      memberships.createMakeup(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Reposición registrada correctamente')
      setMakeupTarget(null)
      setMakeupStep(1)
      setMakeupOriginalDate('')
      setMakeupSelectedSession(null)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al registrar reposición')),
  })

  const addBonusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { quantity: number; notes?: string } }) =>
      memberships.addBonus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Clases adicionales agregadas')
      setBonusTarget(null)
      setBonusQuantity('1')
      setBonusNotes('')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al agregar clases')),
  })

  const renewMutation = useMutation({
    mutationFn: ({ id, start_date }: { id: string; start_date: string }) =>
      memberships.renew(id, start_date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      qc.invalidateQueries({ queryKey: ['cobros'] })
      toast.success('Membresía renovada correctamente')
      setRenewTarget(null)
      setRenewDate('')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al renovar membresía')),
  })

  const SCHEDULED_DAYS = [
    { key: 'monday', label: 'L' }, { key: 'tuesday', label: 'M' },
    { key: 'wednesday', label: 'X' }, { key: 'thursday', label: 'J' },
    { key: 'friday', label: 'V' }, { key: 'saturday', label: 'S' },
    { key: 'sunday', label: 'D' },
  ]

  const DAY_STR_TO_NUM: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  }
  const DAY_NUM_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  function scheduleFromDays(days: string[], spaceId?: string): { day: number; hour: number | ''; space_id?: string }[] {
    return days
      .map(d => DAY_STR_TO_NUM[d])
      .filter(n => n !== undefined)
      .sort((a, b) => a - b)
      .map(day => ({ day, hour: '', ...(spaceId ? { space_id: spaceId } : {}) }))
  }

  function scheduleFromHybridQuotas(quotas: { space_id: string; scheduled_days: string[] }[], prev: { day: number; hour: number | ''; space_id?: string }[]): { day: number; hour: number | ''; space_id?: string }[] {
    return quotas.flatMap(q =>
      (q.scheduled_days || [])
        .map(d => DAY_STR_TO_NUM[d])
        .filter(n => n !== undefined)
        .sort((a, b) => a - b)
        .map(day => {
          const existing = prev.find(e => e.space_id === q.space_id && e.day === day)
          return existing ?? { day, hour: '', space_id: q.space_id }
        })
    )
  }

  function openCreate() {
    setEditing(null)
    setForm({ client_id: '', plan_id: '', membership_type: 'monthly' as any, start_date: '', end_date: '', sessions_per_week: '', scheduled_days: [], space_quotas_with_days: [], makeups_allowed: '1', notes: '', preferred_days: [], preferred_hour: '', preferred_space_id: '', preferred_schedule: [] })
    setClientSearch('')
    setSelectedClientName('')
    setClientDropdownOpen(false)
    setDialogOpen(true)
  }

  function openEdit(m: ClientMembership) {
    setEditing(m)
    const existingSchedule = m.preferred_schedule && m.preferred_schedule.length > 0
      ? m.preferred_schedule.map(e => ({ day: e.day, hour: e.hour as number | '', space_id: e.space_id }))
      : scheduleFromDays(m.scheduled_days || [])
    setForm({
      client_id: m.client_id,
      plan_id: m.plan_id,
      membership_type: (m.membership_type as any) || 'monthly',
      start_date: m.start_date.slice(0, 10),
      end_date: m.end_date ? m.end_date.slice(0, 10) : '',
      sessions_per_week: m.sessions_per_week ? String(m.sessions_per_week) as '2'|'3'|'5' : '',
      scheduled_days: m.scheduled_days || [],
      space_quotas_with_days: (m.space_quotas || []).map(q => ({
        space_id: q.space_id,
        sessions_per_week: q.sessions_per_week,
        scheduled_days: q.scheduled_days || [],
      })),
      makeups_allowed: String(m.makeups_allowed ?? 1),
      notes: m.notes || '',
      preferred_days: m.preferred_days || [],
      preferred_hour: m.preferred_hour != null ? String(m.preferred_hour) : '',
      preferred_space_id: m.preferred_space_id || '',
      preferred_schedule: existingSchedule,
    })
    setClientSearch('')
    setSelectedClientName(m.client_name || '')
    setClientDropdownOpen(false)
    setDialogOpen(true)
  }

  function handlePlanChange(planId: string) {
    const plan = plansList.find(p => p.id === planId)
    if (!plan) {
      setForm(f => ({ ...f, plan_id: planId }))
      return
    }
    const hybridQuotas = (plan.membership_type === 'hybrid_fixed' || plan.membership_type === 'hybrid_monthly')
      ? (plan.space_quotas || []).map(q => ({ space_id: q.space_id, sessions_per_week: q.sessions_per_week, scheduled_days: [] }))
      : []
    setForm(f => ({
      ...f,
      plan_id: planId,
      membership_type: plan.membership_type as any,
      sessions_per_week: plan.sessions_per_week ? String(plan.sessions_per_week) as '2' | '3' | '5' : '',
      space_quotas_with_days: hybridQuotas,
      // Pre-seleccionar el espacio del plan para evitar que el admin lo asigne al espacio equivocado
      preferred_space_id: plan.space_id || f.preferred_space_id,
    }))
  }

  const isHybrid = form.membership_type === 'hybrid_fixed' || form.membership_type === 'hybrid_monthly'

  async function handleSave() {
    if (!form.client_id || !form.plan_id || !form.start_date) {
      toast.error('Completa los campos requeridos')
      return
    }
    if (form.membership_type === 'session_based') {
      if (!form.sessions_per_week) { toast.error('Selecciona las sesiones por semana'); return }
      const spw = Number(form.sessions_per_week)
      if (form.scheduled_days.length !== spw) {
        toast.error(`El plan requiere exactamente ${spw} día(s) por semana. Tienes ${form.scheduled_days.length} seleccionado(s).`)
        return
      }
      const missingHours = form.preferred_schedule.filter(e => e.hour === '').length
      if (missingHours > 0) {
        toast.error(`Debes asignar la hora a todos los días seleccionados. Faltan ${missingHours} hora(s).`)
        return
      }
    }
    if (form.membership_type === 'weekly_sessions') {
      if (!form.sessions_per_week) { toast.error('Selecciona las sesiones por semana'); return }
    }
    if (isHybrid && form.membership_type === 'hybrid_fixed') {
      for (const q of form.space_quotas_with_days) {
        const spaceName = spacesList.find((s: any) => s.id === q.space_id)?.name || q.space_id
        if (q.scheduled_days.length !== q.sessions_per_week) {
          toast.error(`Selecciona exactamente ${q.sessions_per_week} día(s) para ${spaceName}`)
          return
        }
        const spaceEntries = form.preferred_schedule.filter(e => e.space_id === q.space_id)
        const missingHours = spaceEntries.filter(e => e.hour === '').length
        if (missingHours > 0) {
          toast.error(`Asigna la hora a todos los días de ${spaceName}. Faltan ${missingHours} hora(s).`)
          return
        }
      }
    }
    const validSchedule = (form.membership_type === 'session_based' || form.membership_type === 'hybrid_fixed')
      ? form.preferred_schedule.filter(e => e.hour !== '')
      : []

    // Construir el payload y la función de guardado antes del check,
    // para poder capturarla en el closure del diálogo de confirmación.
    let proceed: () => void
    if (editing) {
      const payload = {
        plan_id: form.plan_id,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        notes: form.notes || undefined,
        sessions_per_week: (!isHybrid && form.sessions_per_week) ? Number(form.sessions_per_week) : undefined,
        scheduled_days: (form.membership_type === 'session_based' && form.scheduled_days.length > 0) ? form.scheduled_days : undefined,
        preferred_days: (!isHybrid && form.membership_type !== 'session_based' && form.preferred_days.length > 0) ? form.preferred_days : undefined,
        preferred_hour: (!isHybrid && form.membership_type !== 'session_based' && form.preferred_hour !== '') ? Number(form.preferred_hour) : undefined,
        preferred_space_id: (!isHybrid && form.preferred_space_id) || undefined,
        preferred_schedule: validSchedule.length > 0 ? validSchedule as { day: number; hour: number }[] : undefined,
        status: editing.status,
      }
      proceed = () => updateMutation.mutate({ id: editing.id, data: payload })
    } else {
      const payload: Parameters<typeof memberships.createV2>[0] = {
        client_id: form.client_id,
        plan_id: form.plan_id,
        membership_type: form.membership_type as any,
        start_date: form.start_date,
        sessions_per_week: (!isHybrid && form.sessions_per_week) ? Number(form.sessions_per_week) : undefined,
        scheduled_days: (!isHybrid && form.scheduled_days.length > 0) ? form.scheduled_days : undefined,
        space_quotas: isHybrid ? form.space_quotas_with_days.map(q => ({
          space_id: q.space_id,
          sessions_per_week: q.sessions_per_week,
          scheduled_days: form.membership_type === 'hybrid_fixed' ? q.scheduled_days : undefined,
        })) : undefined,
        makeups_allowed: Number(form.makeups_allowed) || 1,
        notes: form.notes || undefined,
        preferred_days: (!isHybrid && form.membership_type !== 'session_based' && form.preferred_days.length > 0) ? form.preferred_days : undefined,
        preferred_hour: (!isHybrid && form.membership_type !== 'session_based' && form.preferred_hour !== '') ? Number(form.preferred_hour) : undefined,
        preferred_space_id: (!isHybrid && form.preferred_space_id) || undefined,
        preferred_schedule: validSchedule.length > 0 ? validSchedule as { day: number; hour: number }[] : undefined,
      }
      proceed = () => createV2Mutation.mutate(payload)
    }

    // Verificar sesiones disponibles solo al crear planes con días seleccionados
    if (!editing && (form.membership_type === 'session_based' || form.membership_type === 'hybrid_fixed') && validSchedule.length > 0) {
      try {
        const check = await classSessions.checkSchedule({
          start_date: form.start_date,
          schedule: validSchedule.map(e => ({
            day: e.day,
            hour: e.hour as number,
            ...(e.space_id ? { space_id: e.space_id } : {}),
          })),
          weeks_ahead: 12,
        })
        const selectedPlan = plansList.find(p => p.id === form.plan_id)
        const expectedTotal = selectedPlan?.total_sessions ?? null

        if (check.sessions_found === 0) {
          setSessionWarning({
            message: 'No hay sesiones creadas para los días y horas seleccionados. Si continúas, la membresía se creará pero el cliente no quedará agendado en ninguna clase.',
            onConfirm: proceed,
          })
          return
        }
        if (expectedTotal && check.sessions_found < expectedTotal) {
          setSessionWarning({
            message: `Solo hay ${check.sessions_found} sesiones creadas de las ${expectedTotal} que requiere este plan. Si continúas, el cliente quedará sin clases disponibles cuando se agoten esas ${check.sessions_found} sesiones.`,
            onConfirm: proceed,
          })
          return
        }
      } catch {
        // Si el check falla por red, procedemos sin bloquear
      }
    }

    proceed()
  }

  const isSaving = createMutation.isPending || createV2Mutation.isPending || updateMutation.isPending || autoBookMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoDeductMutation.mutate()}
            disabled={autoDeductMutation.isPending}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${autoDeductMutation.isPending ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary-600 hover:bg-primary-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva Membresía
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1) }}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
              statusFilter === tab.key
                ? 'bg-primary-600 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Space filter */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={spaceFilter}
          onChange={e => { setSpaceFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none"
        >
          <option value="">Todos los espacios</option>
          {spacesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : !membershipsList?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400">
            {statusFilter === 'all'
              ? 'No hay membresías registradas'
              : `No hay membresías ${statusLabel(statusFilter as ClientMembership['status']).toLowerCase()}s`}
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Nueva Membresía
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {membershipsList.map(m => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900 leading-tight">{m.client_name || 'Cliente'}</p>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {(() => {
                    if (m.membership_type === 'hybrid_fixed' || m.membership_type === 'hybrid_monthly') {
                      return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Híbrido</span>
                    }
                    const plan = plansList.find(p => p.id === m.plan_id)
                    return plan?.space_name ? (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{plan.space_name}</span>
                    ) : null
                  })()}
                  <Badge variant={statusBadgeVariant(m.status)}>{statusLabel(m.status)}</Badge>
                </div>
              </div>

              {/* Plan info */}
              <div className="text-sm text-gray-600 space-y-0.5">
                <p className="font-medium text-gray-800">{m.plan_name || 'Sin plan'}</p>
                <div className="flex items-center gap-3">
                  {m.plan_classes_per_week != null && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {m.plan_classes_per_week} clases/sem
                    </span>
                  )}
                  {m.plan_price_cop != null && (
                    <span className="text-xs text-gray-500">{formatCurrency(m.plan_price_cop, currency)}/mes</span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                <span>Desde {formatSafeDate(m.start_date)}</span>
                {(m.membership_type === 'session_based' || m.membership_type === 'hybrid_fixed') && m.expiry_date
                  ? <span>hasta {formatSafeDate(m.expiry_date)} <span className="text-gray-400">(calculado)</span></span>
                  : m.end_date
                    ? <span>hasta {formatSafeDate(m.end_date)}</span>
                    : m.next_billing_date
                      ? <span>· próximo cobro {formatSafeDate(m.next_billing_date)}</span>
                      : null
                }
              </div>

              {/* Session progress for session_based and weekly_sessions */}
              {(m.membership_type === 'session_based' || m.membership_type === 'weekly_sessions') && m.total_sessions != null && (
                <div className="space-y-1">
                  {(() => {
                    const bonusAmt = m.bonus_sessions || 0
                    const totalWithBonus = m.total_sessions + bonusAmt
                    const pct = Math.min(100, (m.sessions_used / totalWithBonus) * 100)
                    return (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Sesiones</span>
                          <span className="font-semibold text-gray-700">
                            {m.sessions_used} <span className="font-normal text-gray-400">/ {totalWithBonus}</span>
                            {bonusAmt > 0 && <span className="ml-1 text-emerald-600">(+{bonusAmt} bonus)</span>}
                            {m.sessions_remaining != null && m.sessions_remaining <= 2 && (
                              <span className="ml-1 text-amber-500">({m.sessions_remaining} restantes)</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-green-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    )
                  })()}
                  {m.scheduled_days && m.scheduled_days.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {m.scheduled_days.map(d => d.slice(0,3).charAt(0).toUpperCase() + d.slice(1,3)).join(' · ')}
                    </p>
                  )}
                </div>
              )}

              {/* Info facturación para weekly_sessions */}
              {m.membership_type === 'weekly_sessions' && m.billing_day != null && (
                <p className="text-xs text-gray-400">Factura día {m.billing_day}</p>
              )}

              {/* Progreso por espacio para planes híbridos */}
              {(m.membership_type === 'hybrid_fixed' || m.membership_type === 'hybrid_monthly') && m.space_quotas && m.space_quotas.length > 0 && (
                <div className="space-y-2">
                  {m.space_quotas.map(q => {
                    const spaceName = spacesList.find((s: any) => s.id === q.space_id)?.name || 'Espacio'
                    const used = (m.space_usage || {})[q.space_id] ?? 0
                    const total = q.sessions_per_week * 4
                    const pct = Math.min(100, (used / total) * 100)
                    return (
                      <div key={q.space_id} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">{spaceName}</span>
                          <span className="font-semibold text-gray-700">{used} <span className="font-normal text-gray-400">/ {total}</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-green-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {m.membership_type === 'hybrid_fixed' && q.scheduled_days && q.scheduled_days.length > 0 && (
                          <p className="text-xs text-gray-400">
                            {q.scheduled_days.map(d => ({ monday:'L',tuesday:'M',wednesday:'X',thursday:'J',friday:'V',saturday:'S',sunday:'D' })[d] || d).join(' · ')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {m.membership_type === 'hybrid_monthly' && m.billing_day != null && (
                    <p className="text-xs text-gray-400">Factura día {m.billing_day}</p>
                  )}
                </div>
              )}

              {/* Horario fijo */}
              {m.preferred_days && m.preferred_days.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span>
                    {m.preferred_days.map(d => ['L','M','X','J','V','S','D'][d]).join(' · ')}
                    {m.preferred_hour != null && ` · ${m.preferred_hour}:00h`}
                  </span>
                  {m.preferred_space_name && (
                    <span className="text-gray-400">— {m.preferred_space_name}</span>
                  )}
                </div>
              )}

              {/* Horario fijo por día */}
              {m.preferred_schedule && m.preferred_schedule.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.preferred_schedule.map((e, i) => {
                    const spaceName = e.space_id ? spacesList.find((s: any) => s.id === e.space_id)?.name : null
                    return (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {spaceName ? `${spaceName.split(' ')[0]} · ` : ''}{['L','M','X','J','V','S','D'][e.day]} {e.hour < 10 ? `0${e.hour}` : e.hour}:00
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Monthly usage bar (solo para monthly) */}
              {m.status === 'active' && m.membership_type === 'monthly' && <MonthlyUsageBar membershipId={m.id} />}

              {/* Bottom row */}
              <div className="flex items-center justify-end pt-1 flex-wrap gap-2">
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(m)}
                    className="gap-1 text-xs px-2 py-1 h-auto"
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setBonusTarget(m); setBonusQuantity('1'); setBonusNotes('') }}
                    className="gap-1 text-xs px-2 py-1 h-auto text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    <Plus className="w-3 h-3" /> Agregar clases
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRenewTarget(m)
                      setRenewDate(format(new Date(), 'yyyy-MM-dd'))
                      const plan = plansList.find(p => p.id === m.plan_id)
                      const price = plan?.price_cop ?? 0
                      setRenewAmount(price > 0 ? new Intl.NumberFormat('es-CO').format(price) : '')
                      setRenewPaymentMethod('cash')
                    }}
                    className="gap-1 text-xs px-2 py-1 h-auto text-blue-700 border-blue-200 hover:bg-blue-50"
                  >
                    <RotateCcw className="w-3 h-3" /> Renovar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false) }}>
        <DialogContent title={editing ? 'Editar Membresía' : 'Nueva Membresía'} className="max-w-lg">
          <div className="space-y-4 py-2">
            {/* Tipo de membresía — se deriva automáticamente del plan seleccionado */}
            {!editing && form.plan_id && (
              <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
                Tipo: <span className="font-semibold text-gray-800">
                  {form.membership_type === 'session_based' ? 'Sesiones semanales días fijos'
                    : form.membership_type === 'weekly_sessions' ? 'Sesiones semanales'
                    : form.membership_type === 'hybrid_fixed' ? 'Híbrido días fijos'
                    : form.membership_type === 'hybrid_monthly' ? 'Híbrido mes a mes'
                    : 'Mensualidad fija'}
                </span>
                <span className="text-xs text-gray-400 ml-2">(se toma del plan)</span>
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Cliente *</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedClientName || clientSearch}
                  placeholder="Buscar cliente..."
                  onFocus={() => { setSelectedClientName(''); setClientDropdownOpen(true) }}
                  onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
                  onChange={e => { setClientSearch(e.target.value); setSelectedClientName(''); setForm(f => ({ ...f, client_id: '' })) }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {clientDropdownOpen && clientSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {clientSearchResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => {
                          setForm(f => ({ ...f, client_id: c.id }))
                          setSelectedClientName(c.full_name)
                          setClientSearch('')
                          setClientDropdownOpen(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {c.full_name}
                        {c.phone && <span className="text-gray-400 ml-2">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Plan *</label>
              <select
                value={form.plan_id}
                onChange={e => handlePlanChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecciona un plan...</option>
                {plansList.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price_cop, currency)}</option>
                ))}
              </select>
              {(() => {
                const selectedPlan = plansList.find(p => p.id === form.plan_id)
                return selectedPlan?.space_name ? (
                  <p className="text-xs text-purple-600 mt-1">Espacio: {selectedPlan.space_name}</p>
                ) : null
              })()}
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Fecha inicio *</label>
              <Input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>

            {/* Campos según tipo */}
            {form.membership_type === 'session_based' && (
              <div className="space-y-3">
                {form.sessions_per_week && (
                  <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
                    Plan seleccionado: <span className="font-semibold">{form.sessions_per_week}x / semana</span>
                    {' '}· {Number(form.sessions_per_week) * 4} sesiones en total
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Días de asistencia *</label>
                  <div className="flex gap-1.5">
                    {SCHEDULED_DAYS.map(({ key, label }) => {
                      const selected = form.scheduled_days.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const newDays = selected
                              ? form.scheduled_days.filter(d => d !== key)
                              : [...form.scheduled_days, key]
                            setForm(f => ({
                              ...f,
                              scheduled_days: newDays,
                              preferred_schedule: scheduleFromDays(newDays).map(entry => {
                                const existing = f.preferred_schedule.find(e => e.day === entry.day)
                                return existing ?? entry
                              }),
                            }))
                          }}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                            selected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {form.sessions_per_week && (
                    <p className={`text-xs mt-1 font-medium ${
                      form.scheduled_days.length === Number(form.sessions_per_week)
                        ? 'text-green-600'
                        : 'text-amber-600'
                    }`}>
                      {form.scheduled_days.length}/{Number(form.sessions_per_week)} días seleccionados
                      {form.scheduled_days.length === Number(form.sessions_per_week) && ' ✓'}
                    </p>
                  )}
                </div>

                {/* Horario por día — opcional */}
                {form.preferred_schedule.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Hora por día <span className="text-gray-400 font-normal">(opcional — para agendar automáticamente)</span>
                    </p>
                    <div className="space-y-2">
                      {form.preferred_schedule.map((entry, idx) => (
                        <div key={entry.day} className="flex items-center gap-3">
                          <span className="text-sm text-gray-700 w-20 shrink-0">{DAY_NUM_LABELS[entry.day]}</span>
                          <select
                            value={entry.hour}
                            onChange={e => setForm(f => ({
                              ...f,
                              preferred_schedule: f.preferred_schedule.map((s, i) =>
                                i === idx ? { ...s, hour: e.target.value === '' ? '' : Number(e.target.value) } : s
                              ),
                            }))}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Sin hora fija</option>
                            {Array.from({ length: 16 }, (_, i) => i + 5).map(h => (
                              <option key={h} value={h}>
                                {h < 10 ? `0${h}` : h}:00 {h < 12 ? 'am' : h === 12 ? 'pm' : `${h - 12}pm`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    {/* Espacio preferido */}
                    <div className="pt-1 space-y-1">
                      <label className="block text-xs text-gray-500">Espacio (opcional)</label>
                      <select
                        value={form.preferred_space_id}
                        onChange={e => setForm(f => ({ ...f, preferred_space_id: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Cualquier espacio</option>
                        {spacesList.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    {form.preferred_schedule.some(e => e.hour !== '') && (
                      <p className="text-xs text-green-600">
                        Al guardar se agendarán automáticamente las clases existentes en el período del plan.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {form.membership_type === 'weekly_sessions' && (
              <div className="space-y-2">
                {form.sessions_per_week && form.start_date && (
                  <div className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
                    <p>Referencia: <span className="font-semibold">{form.sessions_per_week} sesiones/semana</span></p>
                    <p className="text-xs text-blue-500 mt-0.5">
                      Sin días fijos. Se renueva el día {new Date(form.start_date + 'T00:00:00').getDate()} de cada mes. El cliente puede usar sus clases libremente según acuerdo con el estudio.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Híbrido días fijos — picker de días por espacio */}
            {form.membership_type === 'hybrid_fixed' && form.space_quotas_with_days.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Días fijos por espacio *</p>
                {form.space_quotas_with_days.map((q, idx) => {
                  const spaceName = spacesList.find((s: any) => s.id === q.space_id)?.name || `Espacio ${idx + 1}`
                  return (
                    <div key={q.space_id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800">{spaceName}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          q.scheduled_days.length === q.sessions_per_week
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {q.scheduled_days.length}/{q.sessions_per_week} días
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {SCHEDULED_DAYS.map(({ key, label }) => {
                          const selected = q.scheduled_days.includes(key)
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                const newDays = selected
                                  ? q.scheduled_days.filter(d => d !== key)
                                  : [...q.scheduled_days, key]
                                setForm(f => {
                                  const newQuotas = f.space_quotas_with_days.map((sq, i) =>
                                    i === idx ? { ...sq, scheduled_days: newDays } : sq
                                  )
                                  return {
                                    ...f,
                                    space_quotas_with_days: newQuotas,
                                    preferred_schedule: scheduleFromHybridQuotas(
                                      newQuotas.map(sq => ({ space_id: sq.space_id, scheduled_days: sq.scheduled_days })),
                                      f.preferred_schedule
                                    ),
                                  }
                                })
                              }}
                              className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                                selected ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Hora por día para este espacio */}
                      {q.scheduled_days.length > 0 && (() => {
                        const spaceEntries = form.preferred_schedule.filter(e => e.space_id === q.space_id)
                        return spaceEntries.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-xs text-gray-500">Hora por día <span className="text-gray-400">(opcional)</span></p>
                            {spaceEntries.map((entry) => (
                              <div key={`${q.space_id}-${entry.day}`} className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 w-16 shrink-0">{DAY_NUM_LABELS[entry.day]}</span>
                                <select
                                  value={entry.hour}
                                  onChange={e => setForm(f => ({
                                    ...f,
                                    preferred_schedule: f.preferred_schedule.map(s =>
                                      s.space_id === q.space_id && s.day === entry.day
                                        ? { ...s, hour: e.target.value === '' ? '' : Number(e.target.value) }
                                        : s
                                    ),
                                  }))}
                                  className="flex-1 px-2 py-1 rounded-lg border border-gray-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                >
                                  <option value="">Sin hora fija</option>
                                  {Array.from({ length: 16 }, (_, i) => i + 5).map(h => (
                                    <option key={h} value={h}>
                                      {h < 10 ? `0${h}` : h}:00 {h < 12 ? 'am' : h === 12 ? 'pm' : `${h - 12}pm`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        ) : null
                      })()}
                    </div>
                  )
                })}
                {form.space_quotas_with_days.every(q => q.scheduled_days.length === q.sessions_per_week) && (
                  <p className="text-xs text-gray-400">
                    Total: {form.space_quotas_with_days.reduce((s, q) => s + q.sessions_per_week, 0)} sesiones/semana · {form.space_quotas_with_days.reduce((s, q) => s + q.sessions_per_week, 0) * 4} sesiones totales
                  </p>
                )}
                {form.preferred_schedule.some(e => e.hour !== '') && (
                  <p className="text-xs text-green-600">
                    Al guardar se agendarán automáticamente las clases existentes en ambos espacios.
                  </p>
                )}
              </div>
            )}

            {/* Híbrido mes a mes — resumen */}
            {form.membership_type === 'hybrid_monthly' && form.space_quotas_with_days.length > 0 && (
              <div className="rounded-xl bg-purple-50 border border-purple-100 px-3 py-2.5 text-sm text-purple-700 space-y-1">
                {form.space_quotas_with_days.map((q, idx) => {
                  const spaceName = spacesList.find((s: any) => s.id === q.space_id)?.name || `Espacio ${idx + 1}`
                  return (
                    <p key={q.space_id}>{spaceName}: <span className="font-semibold">{q.sessions_per_week} ses./sem</span></p>
                  )
                })}
                <p className="text-xs text-purple-500">
                  Total: {form.space_quotas_with_days.reduce((s, q) => s + q.sessions_per_week, 0)} ses./sem
                  {form.start_date && ` · Se renueva el día ${new Date(form.start_date + 'T00:00:00').getDate()} de cada mes`}
                </p>
              </div>
            )}

            {editing && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <select
                  value={editing.status}
                  onChange={e => setEditing(ed => ed ? { ...ed, status: e.target.value as ClientMembership['status'] } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="active">Activa</option>
                  <option value="paused">Pausada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Notas</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notas opcionales..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Renovar membresía */}
      <Dialog open={!!renewTarget} onOpenChange={open => { if (!open) { setRenewTarget(null); setRenewDate(''); setRenewAmount(''); setRenewPaymentMethod('cash') } }}>
        <DialogContent title="Renovar membresía">
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                Cliente: <span className="font-semibold">{renewTarget?.client_name}</span>
              </p>
              <p className="text-sm text-gray-600">
                Plan: <span className="font-semibold">{renewTarget?.plan_name}</span>
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              Se reiniciará el contador de sesiones a 0 y se recalcularán las fechas del plan.
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Fecha de inicio</label>
              <input
                type="date"
                value={renewDate}
                onChange={e => setRenewDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Valor cobrado ({getTenantCurrency()})</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 150.000"
                value={renewAmount}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '')
                  setRenewAmount(digits ? new Intl.NumberFormat('es-CO').format(parseInt(digits, 10)) : '')
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-400">Puedes ajustar si hay descuento. Déjalo vacío para no registrar pago.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Método de pago</label>
              <select
                value={renewPaymentMethod}
                onChange={e => setRenewPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setRenewTarget(null); setRenewDate(''); setRenewAmount(''); setRenewPaymentMethod('cash') }}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!renewTarget || !renewDate) return
                try {
                  await renewMutation.mutateAsync({ id: renewTarget.id, start_date: renewDate })
                } catch {
                  return // el error ya lo maneja onError del mutation
                }
                const rawAmount = parseInt(renewAmount.replace(/\D/g, ''), 10)
                if (rawAmount > 0) {
                  const plan = plansList.find(p => p.id === renewTarget.plan_id)
                  const isHybrid = renewTarget.membership_type === 'hybrid_fixed' || renewTarget.membership_type === 'hybrid_monthly'
                  try {
                    await paymentsApi.create({
                      type: 'income',
                      amount: rawAmount as any,
                      category: isHybrid ? 'membresia_hibrida' : 'membresia',
                      payment_method: renewPaymentMethod,
                      space_id: plan?.space_id || undefined,
                      client_id: renewTarget.client_id,
                      description: `Renovación membresía — ${renewTarget.client_name}`,
                      payment_date: renewDate,
                    })
                  } catch {
                    toast.error('La membresía se renovó pero no se pudo registrar el pago en caja')
                  }
                }
              }}
              disabled={renewMutation.isPending || !renewDate}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {renewMutation.isPending ? 'Renovando...' : 'Confirmar renovación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar clases bonus */}
      <Dialog open={!!bonusTarget} onOpenChange={open => { if (!open) { setBonusTarget(null); setBonusQuantity('1'); setBonusNotes('') } }}>
        <DialogContent title="Agregar clases adicionales">
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Membresía de <span className="font-semibold">{bonusTarget?.client_name}</span>
            </p>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Cantidad de clases *</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={bonusQuantity}
                onChange={e => setBonusQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Motivo <span className="text-gray-400 font-normal">(opcional)</span></label>
              <textarea
                value={bonusNotes}
                onChange={e => setBonusNotes(e.target.value)}
                placeholder="Ej: compensación por cierre del estudio, cortesía, regalo..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBonusTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!bonusTarget) return
                addBonusMutation.mutate({
                  id: bonusTarget.id,
                  data: { quantity: Number(bonusQuantity), notes: bonusNotes || undefined },
                })
              }}
              disabled={addBonusMutation.isPending || !bonusQuantity || Number(bonusQuantity) < 1}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {addBonusMutation.isPending ? 'Guardando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Makeup dialog — 2 steps */}
      <Dialog open={!!makeupTarget} onOpenChange={open => {
        if (!open) { setMakeupTarget(null); setMakeupStep(1); setMakeupOriginalDate(''); setMakeupSelectedSession(null) }
      }}>
        <DialogContent title={`Reposición — ${makeupTarget?.client_name}`} className="max-w-lg">
          <MakeupDialogContent
            membership={makeupTarget}
            step={makeupStep}
            originalDate={makeupOriginalDate}
            selectedSession={makeupSelectedSession}
            sessionSearch={makeupSessionSearch}
            onOriginalDateChange={setMakeupOriginalDate}
            onSessionSearchChange={setMakeupSessionSearch}
            onSelectSession={setMakeupSelectedSession}
            onNextStep={() => {
              if (!makeupOriginalDate) { toast.error('Selecciona la fecha de la clase perdida'); return }
              setMakeupStep(2)
            }}
            onBack={() => setMakeupStep(1)}
            onConfirm={() => {
              if (!makeupTarget) return
              createMakeupMutation.mutate({
                id: makeupTarget.id,
                data: {
                  original_date: makeupOriginalDate,
                  makeup_date: makeupSelectedSession?.start_datetime?.slice(0, 10),
                  class_session_id: makeupSelectedSession?.id,
                },
              })
            }}
            isPending={createMakeupMutation.isPending}
            onClose={() => { setMakeupTarget(null); setMakeupStep(1); setMakeupOriginalDate(''); setMakeupSelectedSession(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación: sesiones insuficientes */}
      <Dialog open={!!sessionWarning} onOpenChange={open => { if (!open) setSessionWarning(null) }}>
        <DialogContent title="Sesiones insuficientes">
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800 leading-relaxed">{sessionWarning?.message}</p>
            </div>
            <p className="text-sm text-gray-600">¿Deseas continuar de todas formas o ir al módulo de Horarios a crear las sesiones primero?</p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setSessionWarning(null)}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSessionWarning(null)
                  window.open('/admin/horarios', '_self')
                }}
              >
                Ir a Horarios
              </Button>
              <Button
                className="bg-primary-600 hover:bg-primary-700 text-white"
                onClick={() => {
                  sessionWarning?.onConfirm()
                  setSessionWarning(null)
                }}
              >
                Continuar de todas formas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
