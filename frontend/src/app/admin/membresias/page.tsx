'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, RotateCcw, Pencil, RefreshCw, Calendar, ChevronRight, CheckCircle2, ArrowRight, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { plans as plansApi, memberships, clients as clientsApi, spaces as spacesApi, classSessions } from '@/lib/api'
import type { ClientMembership, Plan, Client, WeeklyStats, AutoBookResult, ClassSession } from '@/types'
import { formatCOP } from '@/lib/utils'
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

  const total = stats.classes_per_month + stats.makeup_credits
  const committed = stats.total_committed_month
  const pct = total > 0 ? Math.min(100, (committed / total) * 100) : 0
  const barColor = pct >= 100 ? 'bg-red-400' : pct >= 75 ? 'bg-amber-400' : 'bg-green-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Clases este mes</span>
        <span className={`font-semibold ${pct >= 100 ? 'text-red-600' : pct >= 75 ? 'text-amber-600' : 'text-gray-700'}`}>
          {committed} <span className="font-normal text-gray-400">/ {total}</span>
          {stats.makeup_credits > 0 && (
            <span className="ml-1 text-amber-500">(+{stats.makeup_credits} repos.)</span>
          )}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{stats.used_this_month} asistidas · {stats.pending_this_month} reservadas</span>
        <span>{stats.classes_per_week} cls/sem × 4</span>
      </div>
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

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function MakeupSessionsBlock({ makeupSessions }: { makeupSessions: { id: string; original_date: string; makeup_date: string | null; status: string }[] }) {
  const [showCompleted, setShowCompleted] = useState(false)
  if (!makeupSessions?.length) return null

  const pending   = makeupSessions.filter(s => s.status === 'pending')
  const completed = makeupSessions.filter(s => s.status === 'completed')
  const cancelled = makeupSessions.filter(s => s.status === 'cancelled')

  return (
    <div className="mt-1 space-y-1.5">
      <div className="border-t border-gray-100" />

      {pending.map(s => (
        <div key={s.id} className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200/70 px-2.5 py-1.5">
          <RotateCcw className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-xs font-medium text-amber-700">Reposición pendiente</span>
          <div className="ml-auto flex items-center gap-1 text-xs text-amber-600">
            <span>{formatShortDate(s.original_date)}</span>
            <ArrowRight className="h-3 w-3" />
            {s.makeup_date
              ? <span className="font-medium text-amber-700">{formatShortDate(s.makeup_date)}</span>
              : <span className="italic text-amber-400">sin fecha</span>
            }
          </div>
        </div>
      ))}

      {(completed.length > 0 || cancelled.length > 0) && (
        <div>
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-1.5 px-0.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {completed.length + cancelled.length} reposición{completed.length + cancelled.length > 1 ? 'es' : ''} anterior{completed.length + cancelled.length > 1 ? 'es' : ''}
          </button>
          {showCompleted && (
            <div className="space-y-1 mt-1">
              {completed.map(s => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200/60 px-2.5 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700">Repuesta</span>
                  <div className="ml-auto flex items-center gap-1 text-xs text-emerald-600/70">
                    <span className="line-through opacity-60">{formatShortDate(s.original_date)}</span>
                    <ArrowRight className="h-3 w-3" />
                    {s.makeup_date && <span>{formatShortDate(s.makeup_date)}</span>}
                  </div>
                </div>
              ))}
              {cancelled.map(s => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200/70 px-2.5 py-1.5">
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">Cancelada</span>
                  <span className="ml-auto text-xs text-gray-400 line-through">{formatShortDate(s.original_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [form, setForm] = useState({
    client_id: '',
    plan_id: '',
    membership_type: 'monthly' as 'monthly' | 'session_based',
    start_date: '',
    end_date: '',
    sessions_per_week: '' as '' | '2' | '3' | '5',
    scheduled_days: [] as string[],
    makeups_allowed: '1',
    notes: '',
    preferred_days: [] as number[],
    preferred_hour: '' as string | '',
    preferred_space_id: '',
  })
  // Client search autocomplete
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [selectedClientName, setSelectedClientName] = useState('')

  // Auto-deduct on mount (silent)
  useEffect(() => {
    memberships.autoDeduct().catch(e => console.log('auto-deduct error:', e))
  }, [])

  const { data: membershipsData, isLoading } = useQuery({
    queryKey: ['memberships', statusFilter, search, spaceFilter, page],
    queryFn: () => memberships.list({
      status: statusFilter !== 'all' ? statusFilter : 'not_cancelled',
      search: search || undefined,
      space_id: spaceFilter || undefined,
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
    onError: () => {},
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
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Error al crear membresía'),
  })

  const createV2Mutation = useMutation({
    mutationFn: (data: Parameters<typeof memberships.createV2>[0]) =>
      memberships.createV2(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Membresía creada')
      setDialogOpen(false)
      if (form.preferred_days.length > 0 && form.preferred_hour !== '') {
        autoBookMutation.mutate(created.id)
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Error al crear membresía'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientMembership> }) =>
      memberships.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Membresía actualizada')
      setDialogOpen(false)
      if (form.preferred_days.length > 0 && form.preferred_hour !== '') {
        autoBookMutation.mutate(updated.id)
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Error al actualizar'),
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
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Error al registrar reposición'),
  })

  const SCHEDULED_DAYS = [
    { key: 'monday', label: 'L' }, { key: 'tuesday', label: 'M' },
    { key: 'wednesday', label: 'X' }, { key: 'thursday', label: 'J' },
    { key: 'friday', label: 'V' }, { key: 'saturday', label: 'S' },
    { key: 'sunday', label: 'D' },
  ]

  function openCreate() {
    setEditing(null)
    setForm({ client_id: '', plan_id: '', membership_type: 'monthly', start_date: '', end_date: '', sessions_per_week: '', scheduled_days: [], makeups_allowed: '1', notes: '', preferred_days: [], preferred_hour: '', preferred_space_id: '' })
    setClientSearch('')
    setSelectedClientName('')
    setClientDropdownOpen(false)
    setDialogOpen(true)
  }

  function openEdit(m: ClientMembership) {
    setEditing(m)
    setForm({
      client_id: m.client_id,
      plan_id: m.plan_id,
      membership_type: (m.membership_type as 'monthly' | 'session_based') || 'monthly',
      start_date: m.start_date.slice(0, 10),
      end_date: m.end_date ? m.end_date.slice(0, 10) : '',
      sessions_per_week: m.sessions_per_week ? String(m.sessions_per_week) as '2'|'3'|'5' : '',
      scheduled_days: m.scheduled_days || [],
      makeups_allowed: String(m.makeups_allowed ?? 1),
      notes: m.notes || '',
      preferred_days: m.preferred_days || [],
      preferred_hour: m.preferred_hour != null ? String(m.preferred_hour) : '',
      preferred_space_id: m.preferred_space_id || '',
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
    setForm(f => ({
      ...f,
      plan_id: planId,
      membership_type: plan.membership_type as 'monthly' | 'session_based',
      sessions_per_week: plan.sessions_per_week ? String(plan.sessions_per_week) as '2' | '3' | '5' : '',
    }))
  }

  function handleSave() {
    if (!form.client_id || !form.plan_id || !form.start_date) {
      toast.error('Completa los campos requeridos')
      return
    }
    if (form.membership_type === 'session_based') {
      if (!form.sessions_per_week) { toast.error('Selecciona las sesiones por semana'); return }
      if (form.scheduled_days.length === 0) { toast.error('Selecciona al menos un día de asistencia'); return }
    }
    if (editing) {
      const payload = {
        plan_id: form.plan_id,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        notes: form.notes || undefined,
        preferred_days: form.preferred_days.length > 0 ? form.preferred_days : undefined,
        preferred_hour: form.preferred_hour !== '' ? Number(form.preferred_hour) : undefined,
        preferred_space_id: form.preferred_space_id || undefined,
        status: editing.status,
      }
      updateMutation.mutate({ id: editing.id, data: payload })
    } else {
      const payload = {
        client_id: form.client_id,
        plan_id: form.plan_id,
        membership_type: form.membership_type,
        start_date: form.start_date,
        sessions_per_week: form.sessions_per_week ? Number(form.sessions_per_week) : undefined,
        scheduled_days: form.scheduled_days.length > 0 ? form.scheduled_days : undefined,
        makeups_allowed: Number(form.makeups_allowed) || 1,
        notes: form.notes || undefined,
        preferred_days: form.preferred_days.length > 0 ? form.preferred_days : undefined,
        preferred_hour: form.preferred_hour !== '' ? Number(form.preferred_hour) : undefined,
        preferred_space_id: form.preferred_space_id || undefined,
      }
      createV2Mutation.mutate(payload)
    }
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
                    <span className="text-xs text-gray-500">{formatCOP(m.plan_price_cop)}/mes</span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                <span>Desde {formatSafeDate(m.start_date)}</span>
                {m.membership_type === 'session_based' && m.expiry_date
                  ? <span>hasta {formatSafeDate(m.expiry_date)} <span className="text-gray-400">(calculado)</span></span>
                  : m.end_date
                    ? <span>hasta {formatSafeDate(m.end_date)}</span>
                    : m.next_billing_date
                      ? <span>· próximo cobro {formatSafeDate(m.next_billing_date)}</span>
                      : null
                }
              </div>

              {/* Session progress for session_based */}
              {m.membership_type === 'session_based' && m.total_sessions != null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Sesiones</span>
                    <span className="font-semibold text-gray-700">
                      {m.sessions_used} <span className="font-normal text-gray-400">/ {m.total_sessions}</span>
                      {m.sessions_remaining != null && m.sessions_remaining <= 2 && (
                        <span className="ml-1 text-amber-500">({m.sessions_remaining} restantes)</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (m.sessions_used / m.total_sessions) >= 0.9 ? 'bg-red-400' :
                        (m.sessions_used / m.total_sessions) >= 0.7 ? 'bg-amber-400' : 'bg-green-400'
                      }`}
                      style={{ width: `${Math.min(100, (m.sessions_used / m.total_sessions) * 100)}%` }}
                    />
                  </div>
                  {m.scheduled_days && m.scheduled_days.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {m.scheduled_days.map(d => d.slice(0,3).charAt(0).toUpperCase() + d.slice(1,3)).join(' · ')}
                    </p>
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

              {/* Monthly usage bar (active only) */}
              {m.status === 'active' && m.membership_type !== 'session_based' && <MonthlyUsageBar membershipId={m.id} />}

              {/* Makeup sessions */}
              <MakeupSessionsBlock makeupSessions={m.makeup_sessions ?? []} />

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
                    onClick={() => { setMakeupTarget(m); setMakeupStep(1); setMakeupOriginalDate(''); setMakeupSelectedSession(null) }}
                    className={`gap-1 text-xs px-2 py-1 h-auto ${
                      m.makeup_credits > 0
                        ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                        : ''
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" /> Reposición
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
                  {form.membership_type === 'session_based' ? 'Por sesiones' : 'Mensualidad fija'}
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
                  <option key={p.id} value={p.id}>{p.name} — {formatCOP(p.price_cop)}</option>
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
            {form.membership_type === 'monthly' ? (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Sesiones por semana — viene del plan seleccionado */}
                {form.sessions_per_week && (
                  <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
                    Plan seleccionado: <span className="font-semibold">{form.sessions_per_week}x / semana</span>
                    {' '}· {Number(form.sessions_per_week) * 4} sesiones en total
                  </div>
                )}

                {/* Días de asistencia */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Días de asistencia *</label>
                  <div className="flex gap-1.5">
                    {SCHEDULED_DAYS.map(({ key, label }) => {
                      const selected = form.scheduled_days.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            scheduled_days: selected
                              ? f.scheduled_days.filter(d => d !== key)
                              : [...f.scheduled_days, key],
                          }))}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                            selected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {form.sessions_per_week && form.scheduled_days.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      La fecha de vencimiento se calculará automáticamente contando {Number(form.sessions_per_week) * 4} ocurrencias de esos días desde el inicio.
                    </p>
                  )}
                </div>

                {/* Reposiciones permitidas */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Reposiciones permitidas</label>
                  <select
                    value={form.makeups_allowed}
                    onChange={e => setForm(f => ({ ...f, makeups_allowed: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {[0, 1, 2, 3].map(n => (
                      <option key={n} value={n}>{n === 0 ? 'Sin reposiciones' : `${n} reposición${n > 1 ? 'es' : ''}`}</option>
                    ))}
                  </select>
                </div>
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

            {/* Horario fijo — opcional */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Horario fijo <span className="text-gray-400 font-normal">(opcional)</span></p>
              <p className="text-xs text-gray-400">Si se configura, se agendarán automáticamente los cupos en el calendario del mes actual.</p>

              {/* Días de la semana */}
              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Días</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { d: 0, label: 'L' }, { d: 1, label: 'M' }, { d: 2, label: 'X' },
                    { d: 3, label: 'J' }, { d: 4, label: 'V' }, { d: 5, label: 'S' }, { d: 6, label: 'D' }
                  ].map(({ d, label }) => {
                    const selected = form.preferred_days.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          preferred_days: selected
                            ? f.preferred_days.filter(x => x !== d)
                            : [...f.preferred_days, d].sort()
                        }))}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                          selected
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Hora y Espacio */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-gray-500">Hora</label>
                  <select
                    value={form.preferred_hour}
                    onChange={e => setForm(f => ({ ...f, preferred_hour: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Sin hora</option>
                    {Array.from({ length: 16 }, (_, i) => i + 5).map(h => (
                      <option key={h} value={h}>
                        {h < 10 ? `0${h}` : h}:00 {h < 12 ? 'am' : h === 12 ? 'pm' : `${h - 12}pm`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Espacio */}
                <div className="space-y-1">
                  <label className="block text-xs text-gray-500">Espacio</label>
                  <select
                    value={form.preferred_space_id}
                    onChange={e => setForm(f => ({ ...f, preferred_space_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Cualquier espacio</option>
                    {spacesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
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
    </div>
  )
}
