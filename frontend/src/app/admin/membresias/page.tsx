'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, RotateCcw, Pencil, RefreshCw, Calendar } from 'lucide-react'
import { plans as plansApi, memberships, clients as clientsApi, spaces as spacesApi } from '@/lib/api'
import type { ClientMembership, Plan, Client, WeeklyStats, AutoBookResult } from '@/types'
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

export default function MembresiasPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClientMembership | null>(null)
  const [makeupTarget, setMakeupTarget] = useState<ClientMembership | null>(null)
  const [makeupAmount, setMakeupAmount] = useState('1')
  const [form, setForm] = useState({
    client_id: '',
    plan_id: '',
    start_date: '',
    end_date: '',
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

  const { data: membershipsList, isLoading } = useQuery({
    queryKey: ['memberships', statusFilter],
    queryFn: () =>
      memberships.list(statusFilter !== 'all' ? { status: statusFilter } : {}),
  })

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

  const addMakeupMutation = useMutation({
    mutationFn: ({ id, credits }: { id: string; credits: number }) =>
      memberships.addMakeup(id, credits),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      toast.success('Reposición añadida')
      setMakeupTarget(null)
    },
    onError: () => toast.error('Error al añadir reposición'),
  })

  function openCreate() {
    setEditing(null)
    setForm({ client_id: '', plan_id: '', start_date: '', end_date: '', notes: '', preferred_days: [], preferred_hour: '', preferred_space_id: '' })
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
      start_date: m.start_date.slice(0, 10),
      end_date: m.end_date ? m.end_date.slice(0, 10) : '',
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

  function handleSave() {
    if (!form.client_id || !form.plan_id || !form.start_date) {
      toast.error('Completa los campos requeridos')
      return
    }
    const payload = {
      client_id: form.client_id,
      plan_id: form.plan_id,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      notes: form.notes || undefined,
      preferred_days: form.preferred_days.length > 0 ? form.preferred_days : undefined,
      preferred_hour: form.preferred_hour !== '' ? Number(form.preferred_hour) : undefined,
      preferred_space_id: form.preferred_space_id || undefined,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || autoBookMutation.isPending

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
            onClick={() => setStatusFilter(tab.key)}
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
                <Badge variant={statusBadgeVariant(m.status)}>{statusLabel(m.status)}</Badge>
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
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <span>Desde {formatSafeDate(m.start_date)}</span>
                {m.end_date && <span>hasta {formatSafeDate(m.end_date)}</span>}
              </div>

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
              {m.status === 'active' && <MonthlyUsageBar membershipId={m.id} />}

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
                    onClick={() => { setMakeupTarget(m); setMakeupAmount('1') }}
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false) }}>
        <DialogContent title={editing ? 'Editar Membresía' : 'Nueva Membresía'} className="max-w-lg">
          <div className="space-y-4 py-2">
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
                onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecciona un plan...</option>
                {plansList.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {formatCOP(p.price_cop)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Fecha inicio *</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
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

      {/* Add makeup credits dialog */}
      <Dialog open={!!makeupTarget} onOpenChange={open => { if (!open) setMakeupTarget(null) }}>
        <DialogContent title="Añadir Reposición">
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Añadir créditos de reposición a{' '}
              <span className="font-semibold">{makeupTarget?.client_name}</span>.
              Créditos actuales: <span className="font-semibold">{makeupTarget?.makeup_credits ?? 0}</span>
            </p>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Créditos a añadir</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={makeupAmount}
                onChange={e => setMakeupAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMakeupTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!makeupTarget) return
                const n = Number(makeupAmount)
                if (!n || n < 1) { toast.error('Ingresa un número válido'); return }
                addMakeupMutation.mutate({ id: makeupTarget.id, credits: n })
              }}
              disabled={addMakeupMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {addMakeupMutation.isPending ? 'Guardando...' : 'Añadir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
