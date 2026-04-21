'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { classSessions, appointments, spaces, clients, classTypes, memberships, apiClient } from '@/lib/api'
import { SessionCard } from '@/components/admin/session-card'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatCOP, appointmentStatusConfig } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, X, Users, Check, UserX, UserPlus, Pencil, AlertCircle } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import type { ClassSession, Client as ClientType } from '@/types'

// ClassSession may carry space_id from the backend even if not yet in the shared type
type SessionWithSpace = ClassSession & { space_id?: string | null }

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6am - 11pm (23:00)

// ─── Time picker hours available in CreateSessionForm ────────────────────────
const TIME_HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00 – 23:00

// ─── Duration options ─────────────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) {
  return String(n).padStart(2, '0')
}

function buildISO(date: string, hour: number) {
  // date is "yyyy-MM-dd", hour is 0–23
  return `${date}T${pad(hour)}:00:00`
}

// ─── QuickBookModal ───────────────────────────────────────────────────────────
interface QuickBookModalProps {
  day: Date
  hour: number
  onClose: () => void
}

function QuickBookModal({ day, hour, onClose }: QuickBookModalProps) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'hour' | 'specific'>('hour')

  // "Por hora" mode state
  const initialDate = format(day, 'yyyy-MM-dd')
  const [selectedHour, setSelectedHour] = useState(hour)

  // "Hora específica" mode state
  const [specificDatetime, setSpecificDatetime] = useState(
    `${initialDate}T${pad(hour)}:00`
  )
  const [duration, setDuration] = useState(60)

  // Shared state
  const [classTypeId, setClassTypeId] = useState('')
  const [customName, setCustomName] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null)
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Debt dialog state for QuickBookModal
  const [debtDialog, setDebtDialog] = useState<{
    open: boolean
    clientName: string
    onConfirm: (isDebt: boolean) => void
  }>({ open: false, clientName: '', onConfirm: () => {} })

  const { data: spaceList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spaces.list,
  })

  const { data: classTypeList = [] } = useQuery({
    queryKey: ['class-types'],
    queryFn: classTypes.list,
  })

  const selectedClassType = classTypeList.find((ct) => ct.id === classTypeId) ?? null

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clients.list({ limit: 100 }),
  })
  const allClients = clientsData?.items ?? []

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients.slice(0, 8)
    const q = clientSearch.toLowerCase()
    return allClients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    )
  }, [allClients, clientSearch])

  const doCreateSession = async (isDebt: boolean) => {
    setLoading(true)
    try {
      let startISO: string
      let endISO: string

      const effectiveDuration = selectedClassType?.duration_minutes ?? duration

      if (tab === 'hour') {
        startISO = new Date(buildISO(initialDate, selectedHour)).toISOString()
        endISO = new Date(new Date(buildISO(initialDate, selectedHour)).getTime() + effectiveDuration * 60000).toISOString()
      } else {
        const startDate = new Date(specificDatetime)
        startISO = startDate.toISOString()
        endISO = new Date(startDate.getTime() + effectiveDuration * 60000).toISOString()
      }

      const session = await classSessions.create({
        space_id: spaceId,
        start_datetime: startISO,
        end_datetime: endISO,
        ...(classTypeId && { class_type_id: classTypeId }),
        ...(customName.trim() && { custom_name: customName.trim() }),
        ...(selectedClassType && { capacity: selectedClassType.capacity }),
      })

      if (selectedClient) {
        await appointments.create({
          class_session_id: session.id,
          client_id: selectedClient.id,
          status: 'confirmed',
          paid: false,
          is_debt: isDebt,
        })
        qc.invalidateQueries({ queryKey: ['appointments'] })
        toast.success('Sesión creada y cliente agendado')
      } else {
        toast.success('Sesión creada')
      }

      qc.invalidateQueries({ queryKey: ['week-sessions'] })
      onClose()
    } catch {
      toast.error('Error al crear la sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!spaceId) {
      toast.error('Selecciona un espacio')
      return
    }

    if (selectedClient) {
      // Check active membership before booking
      try {
        const activeMembershipsResp = await memberships.list({ client_id: selectedClient.id, status: 'active' })
        const activeMemberships = activeMembershipsResp.items ?? activeMembershipsResp
        if ((activeMemberships as unknown[]).length === 0) {
          // No active membership — show debt dialog
          setDebtDialog({
            open: true,
            clientName: selectedClient.full_name,
            onConfirm: (isDebt: boolean) => {
              setDebtDialog((d) => ({ ...d, open: false }))
              doCreateSession(isDebt)
            },
          })
          return
        }
      } catch {
        // If check fails, continue normally
      }
    }

    doCreateSession(false)
  }

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setTab('hour')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            tab === 'hour'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Por hora
        </button>
        <button
          onClick={() => setTab('specific')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            tab === 'specific'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Hora específica
        </button>
      </div>

      {tab === 'hour' ? (
        <div className="space-y-3">
          {/* Date (read-only in hour mode) */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Fecha</p>
            <p className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
              {format(day, "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
          {/* Hour selector — pre-selected at the clicked hour */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Hora de inicio</p>
            <div className="grid grid-cols-6 gap-1.5">
              {TIME_HOURS.map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHour(h)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedHour === h
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {h}:00
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Duración: {selectedClassType ? `${selectedClassType.duration_minutes} min (del tipo de clase)` : '60 min (fija)'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y hora
            </label>
            <input
              type="datetime-local"
              value={specificDatetime}
              onChange={(e) => setSpecificDatetime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            />
          </div>
          {!selectedClassType && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duración
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
                    duration === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          )}
          {selectedClassType && (
            <p className="text-xs text-gray-500">
              Duración: <span className="font-medium">{selectedClassType.duration_minutes} min</span>
            </p>
          )}
        </div>
      )}

      {/* Class type selector — optional */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de clase (opcional)
        </label>
        <select
          value={classTypeId}
          onChange={(e) => setClassTypeId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        >
          <option value="">Sin tipo de clase</option>
          {classTypeList.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name} — {ct.duration_minutes} min · cap. {ct.capacity}
            </option>
          ))}
        </select>
        {selectedClassType && (
          <p className="text-xs text-gray-400 mt-1">
            Duración y capacidad se tomarán del tipo de clase seleccionado.
          </p>
        )}
      </div>

      {/* Custom name — optional, only shown if no class type selected */}
      {!classTypeId && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la clase (opcional)
        </label>
        <input
          type="text"
          placeholder="Ej: Estiramiento, Fortalecimiento..."
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        />
      </div>
      )}

      {/* Space selector — required */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Espacio *
        </label>
        <select
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        >
          <option value="">Selecciona un espacio...</option>
          {spaceList.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name} — capacidad {sp.capacity}
            </option>
          ))}
        </select>
      </div>

      {/* Client search — optional, books on creation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Agendar cliente (opcional)
        </label>
        {selectedClient ? (
          <div className="flex items-center justify-between px-3 py-2 bg-primary-50 border border-primary-200 rounded-xl">
            <div>
              <p className="text-sm font-medium text-primary-900">
                {selectedClient.full_name}
              </p>
              {selectedClient.phone && (
                <p className="text-xs text-primary-700">{selectedClient.phone}</p>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedClient(null)
                setClientSearch('')
              }}
              className="text-primary-400 hover:text-primary-600 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value)
                setClientDropdownOpen(true)
              }}
              onFocus={() => setClientDropdownOpen(true)}
              onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            />
            {clientDropdownOpen && filteredClients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => {
                      setSelectedClient(c)
                      setClientSearch('')
                      setClientDropdownOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {c.full_name}
                    </p>
                    {c.phone && (
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Creando...' : selectedClient ? 'Crear y agendar' : 'Crear sesión'}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
      </div>

      {/* Debt dialog */}
      <Dialog
        open={debtDialog.open}
        onOpenChange={(open) => !open && setDebtDialog((d) => ({ ...d, open: false }))}
      >
        <DialogContent title="Cliente sin membresía activa">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{debtDialog.clientName}</span> no tiene un plan activo.
              ¿Cómo desea registrar esta clase?
            </p>
            <div className="flex gap-2">
              <Button onClick={() => debtDialog.onConfirm(false)}>
                Ya pagó la clase
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => debtDialog.onConfirm(true)}
              >
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Registrar como deuda
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── CreateSessionForm (improved UX) ─────────────────────────────────────────
function CreateSessionForm({ onClose }: { onClose: () => void }) {
  const { data: spaceList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spaces.list,
  })

  const { data: classTypeList = [] } = useQuery({
    queryKey: ['class-types'],
    queryFn: classTypes.list,
  })

  const today = format(new Date(), 'yyyy-MM-dd')
  const [classTypeId, setClassTypeId] = useState('')
  const [customName, setCustomName] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [date, setDate] = useState(today)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  // Duration mode: 'fixed' = 60 min, 'custom' = choose
  const [durationMode, setDurationMode] = useState<'fixed' | 'custom'>('fixed')
  const [customDuration, setCustomDuration] = useState(60)
  const [loading, setLoading] = useState(false)

  const selectedClassType = classTypeList.find((ct) => ct.id === classTypeId) ?? null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!spaceId) {
      toast.error('Selecciona un espacio')
      return
    }
    if (selectedHour === null) {
      toast.error('Selecciona una hora')
      return
    }
    if (!date) {
      toast.error('Selecciona una fecha')
      return
    }

    setLoading(true)
    try {
      const durationMin = selectedClassType?.duration_minutes ?? (durationMode === 'fixed' ? 60 : customDuration)
      const start = new Date(buildISO(date, selectedHour))
      const end = new Date(start.getTime() + durationMin * 60000)

      await classSessions.create({
        space_id: spaceId,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        ...(classTypeId && { class_type_id: classTypeId }),
        ...(customName.trim() && { custom_name: customName.trim() }),
        ...(selectedClassType && { capacity: selectedClassType.capacity }),
      })
      toast.success('Sesión creada')
      onClose()
    } catch {
      toast.error('Error al crear sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Class type selector — optional */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de clase (opcional)
        </label>
        <select
          value={classTypeId}
          onChange={(e) => setClassTypeId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        >
          <option value="">Sin tipo de clase</option>
          {classTypeList.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name} — {ct.duration_minutes} min · cap. {ct.capacity}
            </option>
          ))}
        </select>
        {selectedClassType && (
          <p className="text-xs text-gray-400 mt-1">
            Duración y capacidad se tomarán del tipo de clase seleccionado.
          </p>
        )}
      </div>

      {/* Custom name — optional, only shown if no class type selected */}
      {!classTypeId && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la clase (opcional)
        </label>
        <input
          type="text"
          placeholder="Ej: Estiramiento, Fortalecimiento..."
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        />
      </div>
      )}

      {/* Space selector — required */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Espacio *
        </label>
        <select
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
        >
          <option value="">Selecciona un espacio...</option>
          {spaceList.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name} — capacidad {sp.capacity}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        />
      </div>

      {/* Time grid */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hora de inicio
        </label>
        <div className="grid grid-cols-6 gap-1.5">
          {TIME_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setSelectedHour(h)}
              className={`py-1.5 rounded-lg text-xs font-medium transition ${
                selectedHour === h
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {h}:00
            </button>
          ))}
        </div>
      </div>

      {/* Duration toggle — hidden when class type is selected (duration comes from class type) */}
      {!selectedClassType && <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Duración
        </label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setDurationMode('fixed')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
              durationMode === 'fixed'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {durationMode === 'fixed' && <Check className="w-3.5 h-3.5" />}
            1 hora (fija)
          </button>
          <button
            type="button"
            onClick={() => setDurationMode('custom')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
              durationMode === 'custom'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Personalizada
          </button>
        </div>
        {durationMode === 'custom' && (
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCustomDuration(opt.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
                  customDuration === opt.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {selectedClassType && (
        <p className="text-xs text-gray-500 -mt-2">
          Duración: <span className="font-medium">{selectedClassType.duration_minutes} min</span>
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creando...' : 'Crear sesión'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ─── AgendaPage ───────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedSession, setSelectedSession] = useState<SessionWithSpace | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [spaceFilter, setSpaceFilter] = useState<string>('all')
  // Quick-book modal state: null = closed, or { day, hour }
  const [quickBook, setQuickBook] = useState<{ day: Date; hour: number } | null>(null)
  const qc = useQueryClient()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['week-sessions', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () =>
      classSessions.list({
        start: format(weekStart, "yyyy-MM-dd'T'00:00:00"),
        end: format(addDays(weekStart, 7), "yyyy-MM-dd'T'00:00:00"),
      }),
  })

  const { data: spaceList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spaces.list,
  })

  // Cast sessions to SessionWithSpace to access optional space_id field
  const typedSessions = sessions as SessionWithSpace[]

  // Apply space filter — sessions without space_id are shown in all views
  const filteredSessions =
    spaceFilter === 'all'
      ? typedSessions
      : typedSessions.filter((s) =>
          spaceFilter === 'none' ? !s.space_id : s.space_id === spaceFilter
        )

  // Assign a distinct color per space for left border differentiation
  const SPACE_COLORS = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
  ]
  const spaceColorMap = Object.fromEntries(
    spaceList.map((sp, idx) => [sp.id, SPACE_COLORS[idx % SPACE_COLORS.length]])
  )

  const withSpaceColor = (s: SessionWithSpace): ClassSession => ({
    ...s,
    class_type_color:
      (s.space_id && spaceColorMap[s.space_id]) || s.class_type_color || '#6366f1',
  })

  const { data: sessionAppointments = [] } = useQuery({
    queryKey: ['appointments', selectedSession?.id],
    queryFn: () => appointments.list({ session_id: selectedSession?.id }),
    enabled: !!selectedSession,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => classSessions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week-sessions'] })
      setSelectedSession(null)
      toast.success('Sesión eliminada')
    },
  })

  // ── Edit session name ─────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')

  const updateNameMutation = useMutation({
    mutationFn: ({ id, custom_name }: { id: string; custom_name: string | null }) =>
      classSessions.update(id, { custom_name: custom_name ?? undefined }),
    onSuccess: (updated) => {
      setSelectedSession((prev) => prev ? { ...prev, custom_name: updated.custom_name } : prev)
      qc.invalidateQueries({ queryKey: ['week-sessions'] })
      setEditingName(false)
      toast.success('Nombre actualizado')
    },
    onError: () => toast.error('Error al actualizar el nombre'),
  })

  // ── Remove client from session ────────────────────────────────────────────
  const [removingApptId, setRemovingApptId] = useState<string | null>(null)

  const removeClientMutation = useMutation({
    mutationFn: (apptId: string) => appointments.remove(apptId),
    onMutate: (apptId) => setRemovingApptId(apptId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments', selectedSession?.id] })
      qc.invalidateQueries({ queryKey: ['week-sessions'] })
      toast.success('Cliente eliminado de la sesión')
    },
    onError: () => toast.error('Error al eliminar cliente'),
    onSettled: () => setRemovingApptId(null),
  })

  // ── Add client to session ─────────────────────────────────────────────────
  const [showAddClient, setShowAddClient] = useState(false)
  const [addClientSearch, setAddClientSearch] = useState('')
  const [addClientDropdownOpen, setAddClientDropdownOpen] = useState(false)
  const [isAddingClient, setIsAddingClient] = useState(false)

  // Debt dialog state for the "add client to session" flow
  const [addClientDebtDialog, setAddClientDebtDialog] = useState<{
    open: boolean
    clientName: string
    onConfirm: (isDebt: boolean) => void
  }>({ open: false, clientName: '', onConfirm: () => {} })

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clients.list({ limit: 100 }),
  })
  const allClients = clientsData?.items ?? []

  const filteredAddClients = useMemo(() => {
    if (!addClientSearch.trim()) return allClients.slice(0, 8)
    const q = addClientSearch.toLowerCase()
    return allClients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    )
  }, [allClients, addClientSearch])

  const doAddClient = async (client: ClientType, isDebt: boolean) => {
    if (!selectedSession) return
    setIsAddingClient(true)
    try {
      await appointments.create({
        class_session_id: selectedSession.id,
        client_id: client.id,
        status: 'confirmed',
        paid: false,
        is_debt: isDebt,
      })
      qc.invalidateQueries({ queryKey: ['appointments', selectedSession.id] })
      qc.invalidateQueries({ queryKey: ['week-sessions'] })
      toast.success('Cliente agendado')
      setShowAddClient(false)
      setAddClientSearch('')
    } catch {
      toast.error('Error al agendar cliente')
    } finally {
      setIsAddingClient(false)
    }
  }

  const handleAddClient = async (client: ClientType) => {
    if (!selectedSession) return
    if (selectedSession.enrolled_count >= selectedSession.capacity) {
      toast.error('La sesión está llena')
      return
    }

    // Check active membership
    try {
      const activeMembershipsResp = await memberships.list({ client_id: client.id, status: 'active' })
      const activeMembershipsArr = activeMembershipsResp.items ?? activeMembershipsResp
      if ((activeMembershipsArr as unknown[]).length === 0) {
        setAddClientDebtDialog({
          open: true,
          clientName: client.full_name,
          onConfirm: (isDebt: boolean) => {
            setAddClientDebtDialog((d) => ({ ...d, open: false }))
            doAddClient(client, isDebt)
          },
        })
        return
      }
    } catch {
      // If membership check fails, continue normally
    }

    doAddClient(client, false)
  }

  const getSessionsForDay = (day: Date) =>
    filteredSessions.filter((s) => isSameDay(parseISO(s.start_datetime), day))

  return (
    <div className="space-y-4">
      {/* Space filter tabs */}
      {spaceList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSpaceFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
              spaceFilter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {spaceList.map((space) => (
            <button
              key={space.id}
              onClick={() => setSpaceFilter(space.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
                spaceFilter === space.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {space.name}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="p-2 hover:bg-gray-100 rounded-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-48 text-center">
            {format(weekStart, "d 'de' MMMM", { locale: es })} —{' '}
            {format(addDays(weekStart, 6), "d 'de' MMMM, yyyy", { locale: es })}
          </span>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="p-2 hover:bg-gray-100 rounded-xl"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="px-3 py-1.5 text-sm border rounded-xl hover:bg-gray-50"
          >
            Hoy
          </button>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> Nueva sesión
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 border-b border-gray-100">
          <div className="p-3 text-xs text-gray-400 font-medium border-r border-gray-100" />
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date())
            return (
              <div
                key={day.toISOString()}
                className="p-3 text-center border-r border-gray-100 last:border-r-0"
              >
                <p className="text-xs text-gray-500 uppercase">
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p
                  className={`text-lg font-semibold mt-0.5 ${
                    isToday ? 'text-primary-600' : 'text-gray-900'
                  }`}
                >
                  {format(day, 'd')}
                </p>
              </div>
            )
          })}
        </div>

        {/* Time slots */}
        <div className="overflow-y-auto max-h-[900px]">
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-50">
              <div className="p-2 text-xs text-gray-400 border-r border-gray-100 text-right pr-3 pt-3">
                {hour}:00
              </div>
              {weekDays.map((day) => {
                const daySessions = getSessionsForDay(day).filter((s) => {
                  const sessionHour = parseISO(s.start_datetime).getHours()
                  return sessionHour === hour
                })
                return (
                  // The cell itself is clickable — opens the quick-book modal.
                  // Individual session cards use stopPropagation to open the detail modal instead.
                  <div
                    key={day.toISOString()}
                    onClick={() => setQuickBook({ day, hour })}
                    className="relative p-1 border-r border-gray-50 last:border-r-0 min-h-[60px] cursor-pointer hover:bg-primary-50/40 transition-colors group"
                  >
                    {/* Hover affordance shown when cell is empty */}
                    {daySessions.length === 0 && (
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-4 h-4 text-primary-400" />
                      </span>
                    )}
                    {daySessions.map((s) => (
                      <button
                        key={s.id}
                        className="w-full text-left"
                        onClick={(e) => {
                          // Prevent the cell click from also firing
                          e.stopPropagation()
                          setSelectedSession(s)
                        }}
                      >
                        <SessionCard session={withSpaceColor(s)} />
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Session detail modal */}
      <Dialog
        open={!!selectedSession}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSession(null)
            setShowAddClient(false)
            setAddClientSearch('')
            setEditingName(false)
            setEditNameValue('')
          }
        }}
      >
        <DialogContent title={selectedSession?.custom_name || selectedSession?.class_type_name || 'Sesión'}>
          {selectedSession && (
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Editable custom name */}
                <div className="col-span-2">
                  <p className="text-gray-500 mb-1">Nombre personalizado</p>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateNameMutation.mutate({ id: selectedSession.id, custom_name: editNameValue.trim() || null })
                          if (e.key === 'Escape') setEditingName(false)
                        }}
                        placeholder="Ej: Estiramiento, Fortalecimiento..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={() => updateNameMutation.mutate({ id: selectedSession.id, custom_name: editNameValue.trim() || null })}
                        disabled={updateNameMutation.isPending}
                        className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <p className="font-medium">
                        {selectedSession.custom_name || (
                          <span className="text-gray-400 italic">Sin nombre personalizado</span>
                        )}
                      </p>
                      <button
                        onClick={() => {
                          setEditNameValue(selectedSession.custom_name || '')
                          setEditingName(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-opacity"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">Inicio</p>
                  <p className="font-medium">
                    {formatDateTime(selectedSession.start_datetime)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Instructor</p>
                  <p className="font-medium">
                    {selectedSession.instructor_name || 'Sin asignar'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Capacidad</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="font-medium">
                      {selectedSession.enrolled_count}/{selectedSession.capacity}
                    </p>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full min-w-16">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (selectedSession.enrolled_count / selectedSession.capacity) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500">Estado</p>
                  <Badge
                    variant={
                      selectedSession.status === 'cancelled' ? 'destructive' : 'success'
                    }
                  >
                    {selectedSession.status}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Espacio</p>
                  <p className="font-medium">
                    {(selectedSession as any).space_name || 'Sin espacio asignado'}
                  </p>
                </div>
              </div>

              {/* Enrolled clients */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-700">
                    Inscritos ({sessionAppointments.length})
                  </p>
                </div>
                {sessionAppointments.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin inscripciones</p>
                ) : (
                  <div className="space-y-2">
                    {sessionAppointments.map((appt: any) => {
                      const cfg = appointmentStatusConfig[appt.status]
                      const isRemoving = removingApptId === appt.id
                      return (
                        <div
                          key={appt.id}
                          className="flex items-center justify-between py-2 border-b border-gray-50"
                        >
                          <div>
                            <p className={`text-sm font-medium ${appt.is_debt ? 'text-red-600' : ''}`}>
                              {appt.client_name}
                              {appt.is_debt && (
                                <span className="ml-1.5 text-xs font-normal">(debe)</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{appt.client_phone}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {appt.paid && <Badge variant="success">Pagó</Badge>}
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className}`}
                            >
                              {cfg?.label}
                            </span>
                            {appt.status !== 'cancelled' && (
                              <button
                                onClick={() => removeClientMutation.mutate(appt.id)}
                                disabled={isRemoving}
                                title="Quitar cliente"
                                className="ml-1 text-gray-300 hover:text-red-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add client section */}
                {selectedSession.status !== 'cancelled' && (
                  <div className="mt-3">
                    {!showAddClient ? (
                      <button
                        onClick={() => setShowAddClient(true)}
                        className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
                      >
                        <UserPlus className="w-4 h-4" />
                        Agregar cliente
                      </button>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">Agregar cliente</p>
                          <button
                            onClick={() => {
                              setShowAddClient(false)
                              setAddClientSearch('')
                            }}
                            className="text-gray-400 hover:text-gray-600 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={addClientSearch}
                            onChange={(e) => {
                              setAddClientSearch(e.target.value)
                              setAddClientDropdownOpen(true)
                            }}
                            onFocus={() => setAddClientDropdownOpen(true)}
                            onBlur={() =>
                              setTimeout(() => setAddClientDropdownOpen(false), 150)
                            }
                            disabled={isAddingClient}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm disabled:opacity-50"
                          />
                          {addClientDropdownOpen && filteredAddClients.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {filteredAddClients.map((c) => (
                                <button
                                  key={c.id}
                                  onMouseDown={() => handleAddClient(c)}
                                  disabled={isAddingClient}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition disabled:opacity-50"
                                >
                                  <p className="text-sm font-medium text-gray-900">
                                    {c.full_name}
                                  </p>
                                  {c.phone && (
                                    <p className="text-xs text-gray-500">{c.phone}</p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {isAddingClient && (
                          <p className="text-xs text-gray-400">Agendando...</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => cancelMutation.mutate(selectedSession.id)}
                >
                  Eliminar sesión
                </Button>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Cerrar
                  </Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick-book modal — opened by clicking a calendar cell */}
      <Dialog
        open={!!quickBook}
        onOpenChange={(open) => !open && setQuickBook(null)}
      >
        {quickBook && (
          <DialogContent
            title={`Nueva sesión · ${format(quickBook.day, "d MMM", { locale: es })} ${quickBook.hour}:00`}
          >
            <QuickBookModal
              day={quickBook.day}
              hour={quickBook.hour}
              onClose={() => setQuickBook(null)}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* Create session modal (full form, opened via "Nueva sesión" button) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent title="Nueva sesión">
          <CreateSessionForm
            onClose={() => {
              setShowCreateModal(false)
              qc.invalidateQueries({ queryKey: ['week-sessions'] })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Debt dialog — add client to existing session */}
      <Dialog
        open={addClientDebtDialog.open}
        onOpenChange={(open) => !open && setAddClientDebtDialog((d) => ({ ...d, open: false }))}
      >
        <DialogContent title="Cliente sin membresía activa">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{addClientDebtDialog.clientName}</span> no tiene un plan activo.
              ¿Cómo desea registrar esta clase?
            </p>
            <div className="flex gap-2">
              <Button onClick={() => addClientDebtDialog.onConfirm(false)}>
                Ya pagó la clase
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => addClientDebtDialog.onConfirm(true)}
              >
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Registrar como deuda
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
