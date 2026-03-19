'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { classSessions, classTypes, appointments, spaces, clients } from '@/lib/api'
import { SessionCard } from '@/components/admin/session-card'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatCOP, appointmentStatusConfig } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, X, Users, Check } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import type { ClassSession, Client as ClientType } from '@/types'

// ClassSession may carry space_id from the backend even if not yet in the shared type
type SessionWithSpace = ClassSession & { space_id?: string | null }

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6) // 6am - 8pm

// ─── Time picker hours available in CreateSessionForm ────────────────────────
const TIME_HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6:00 – 21:00

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
  const [capacity, setCapacity] = useState('8')
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null)
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const { data: types = [] } = useQuery({
    queryKey: ['class-types'],
    queryFn: classTypes.list,
  })

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

  const handleSubmit = async () => {
    if (!classTypeId) {
      toast.error('Selecciona un tipo de clase')
      return
    }

    setLoading(true)
    try {
      let startISO: string
      let endISO: string

      if (tab === 'hour') {
        startISO = buildISO(initialDate, selectedHour) + '.000Z'
        // Strip the fake Z — use local ISO for the API
        startISO = new Date(buildISO(initialDate, selectedHour)).toISOString()
        endISO = new Date(buildISO(initialDate, selectedHour + 1)).toISOString()
      } else {
        const startDate = new Date(specificDatetime)
        startISO = startDate.toISOString()
        endISO = new Date(startDate.getTime() + duration * 60000).toISOString()
      }

      const session = await classSessions.create({
        class_type_id: classTypeId,
        start_datetime: startISO,
        end_datetime: endISO,
        capacity: parseInt(capacity, 10),
      })

      if (selectedClient) {
        await appointments.create({
          class_session_id: session.id,
          client_id: selectedClient.id,
          status: 'confirmed',
          paid: false,
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
          <p className="text-xs text-gray-500">Duración fija: 60 minutos</p>
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
        </div>
      )}

      {/* Class type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de clase
        </label>
        <select
          value={classTypeId}
          onChange={(e) => setClassTypeId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        >
          <option value="">Selecciona...</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Capacity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Capacidad
        </label>
        <input
          type="number"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
        />
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
    </div>
  )
}

// ─── CreateSessionForm (improved UX) ─────────────────────────────────────────
function CreateSessionForm({ onClose }: { onClose: () => void }) {
  const { data: types = [] } = useQuery({
    queryKey: ['class-types'],
    queryFn: classTypes.list,
  })

  const today = format(new Date(), 'yyyy-MM-dd')
  const [classTypeId, setClassTypeId] = useState('')
  const [date, setDate] = useState(today)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  // Duration mode: 'fixed' = 60 min, 'custom' = choose
  const [durationMode, setDurationMode] = useState<'fixed' | 'custom'>('fixed')
  const [customDuration, setCustomDuration] = useState(60)
  const [capacity, setCapacity] = useState('8')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classTypeId) {
      toast.error('Selecciona un tipo de clase')
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
      const durationMin = durationMode === 'fixed' ? 60 : customDuration
      const start = new Date(buildISO(date, selectedHour))
      const end = new Date(start.getTime() + durationMin * 60000)

      await classSessions.create({
        class_type_id: classTypeId,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        capacity: parseInt(capacity, 10),
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
      {/* Class type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de clase
        </label>
        <select
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
          value={classTypeId}
          onChange={(e) => setClassTypeId(e.target.value)}
        >
          <option value="">Selecciona...</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
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

      {/* Duration toggle */}
      <div>
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
      </div>

      {/* Capacity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Capacidad
        </label>
        <input
          type="number"
          min="1"
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
      </div>

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
    mutationFn: (id: string) => classSessions.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week-sessions'] })
      setSelectedSession(null)
      toast.success('Sesión cancelada')
    },
  })

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
        <div className="overflow-y-auto max-h-[600px]">
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
        onOpenChange={(open) => !open && setSelectedSession(null)}
      >
        <DialogContent title={selectedSession?.class_type_name || 'Sesión'}>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
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
                  <p className="font-medium">
                    {selectedSession.enrolled_count}/{selectedSession.capacity}
                  </p>
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
                      return (
                        <div
                          key={appt.id}
                          className="flex items-center justify-between py-2 border-b border-gray-50"
                        >
                          <div>
                            <p className="text-sm font-medium">{appt.client_name}</p>
                            <p className="text-xs text-gray-500">{appt.client_phone}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {appt.paid && <Badge variant="success">Pagó</Badge>}
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className}`}
                            >
                              {cfg?.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => cancelMutation.mutate(selectedSession.id)}
                  disabled={selectedSession.status === 'cancelled'}
                >
                  Cancelar sesión
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
    </div>
  )
}
