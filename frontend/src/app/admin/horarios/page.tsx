'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedule, spaces, classTypes } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarDays, Trash2, Plus, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ScheduleDay, ScheduleException, GenerateSessionsResult } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

// Spanish day names in order Mon=0 … Sun=6 (matching day_of_week from API)
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Build hour options 0..23 formatted as "0:00", "1:00", …, "23:00"
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i}:00`,
}))

// Default schedule skeleton in case the API returns fewer than 7 days
function buildDefaultDays(): ScheduleDay[] {
  return DAY_LABELS.map((name, idx) => ({
    day_of_week: idx,
    day_name: name,
    is_active: idx < 5, // Mon–Fri active by default
    open_hour: 6,
    close_hour: 21,
  }))
}

// Normalise the API response into a full 7-day array keyed by day_of_week
function normaliseDays(apiDays: ScheduleDay[]): ScheduleDay[] {
  const defaults = buildDefaultDays()
  return defaults.map((def) => {
    const found = apiDays.find((d) => d.day_of_week === def.day_of_week)
    return found ? { ...def, ...found, day_name: def.day_name } : def
  })
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

interface DayCardProps {
  day: ScheduleDay
  saving: boolean
  onChange: (updated: ScheduleDay) => void
}

function DayCard({ day, saving, onChange }: DayCardProps) {
  const handleToggle = () => {
    onChange({ ...day, is_active: !day.is_active })
  }

  const handleHour =
    (field: 'open_hour' | 'close_hour') =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...day, [field]: parseInt(e.target.value, 10) })
    }

  return (
    <div
      className={`rounded-2xl border shadow-sm p-4 flex flex-col gap-3 transition-colors ${
        day.is_active
          ? 'bg-white border-gray-100'
          : 'bg-gray-50 border-gray-100 opacity-60'
      }`}
    >
      {/* Day name + toggle */}
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-semibold ${
            day.is_active ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          {day.day_name}
        </span>

        {/* Pill toggle — CSS only, no external lib */}
        <button
          type="button"
          role="switch"
          aria-checked={day.is_active}
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed ${
            day.is_active ? 'bg-primary-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
              day.is_active ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Hour selectors — only shown when active */}
      {day.is_active && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Apertura</label>
            <select
              value={day.open_hour}
              onChange={handleHour('open_hour')}
              disabled={saving}
              className="w-full px-2 py-1.5 rounded-xl border border-gray-300 text-xs disabled:opacity-50"
            >
              {HOUR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cierre</label>
            <select
              value={day.close_hour}
              onChange={handleHour('close_hour')}
              disabled={saving}
              className="w-full px-2 py-1.5 rounded-xl border border-gray-300 text-xs disabled:opacity-50"
            >
              {HOUR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!day.is_active && (
        <p className="text-xs text-gray-400">Cerrado</p>
      )}
    </div>
  )
}

// ─── WeeklyScheduleSection ────────────────────────────────────────────────────

function WeeklyScheduleSection() {
  const qc = useQueryClient()
  // Track which day_of_week is currently being saved
  const [savingDay, setSavingDay] = useState<number | null>(null)

  const { data: rawDays, isLoading } = useQuery<ScheduleDay[]>({
    queryKey: ['schedule'],
    queryFn: schedule.get,
  })

  // Optimistic local state — initialised from API data
  const [localDays, setLocalDays] = useState<ScheduleDay[] | null>(null)

  // Sync local state when API data arrives (first load only)
  const days: ScheduleDay[] = localDays ?? (rawDays ? normaliseDays(rawDays) : buildDefaultDays())

  const updateMutation = useMutation({
    mutationFn: ({ dayOfWeek, data }: { dayOfWeek: number; data: { is_active: boolean; open_hour: number; close_hour: number } }) =>
      schedule.updateDay(dayOfWeek, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
    },
    onError: () => {
      toast.error('Error al guardar el horario')
    },
    onSettled: () => setSavingDay(null),
  })

  const handleDayChange = useCallback(
    (updated: ScheduleDay) => {
      // Apply optimistically to local state
      setLocalDays((prev) => {
        const base = prev ?? (rawDays ? normaliseDays(rawDays) : buildDefaultDays())
        return base.map((d) => (d.day_of_week === updated.day_of_week ? updated : d))
      })

      setSavingDay(updated.day_of_week)
      updateMutation.mutate({
        dayOfWeek: updated.day_of_week,
        data: {
          is_active: updated.is_active,
          open_hour: updated.open_hour,
          close_hour: updated.close_hour,
        },
      })
    },
    [rawDays, updateMutation]
  )

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {days.map((day) => (
        <DayCard
          key={day.day_of_week}
          day={day}
          saving={savingDay === day.day_of_week}
          onChange={handleDayChange}
        />
      ))}
    </div>
  )
}

// ─── ExceptionsSection ────────────────────────────────────────────────────────

function ExceptionsSection() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Fetch exceptions for the next 12 months
  const today = format(new Date(), 'yyyy-MM-dd')
  const yearEnd = `${new Date().getFullYear() + 1}-12-31`

  const { data: exceptions = [], isLoading } = useQuery<ScheduleException[]>({
    queryKey: ['schedule-exceptions', today],
    queryFn: () => schedule.exceptions({ from: today, to: yearEnd }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => schedule.removeException(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-exceptions'] })
      toast.success('Excepción eliminada')
    },
    onError: () => toast.error('Error al eliminar la excepción'),
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formDate) {
      toast.error('Selecciona una fecha')
      return
    }
    setFormLoading(true)
    try {
      await schedule.addException({
        date: formDate,
        reason: formReason || undefined,
        is_closed: true,
      })
      qc.invalidateQueries({ queryKey: ['schedule-exceptions'] })
      toast.success('Excepción agregada')
      setFormDate('')
      setFormReason('')
      setShowForm(false)
    } catch {
      toast.error('Error al agregar la excepción')
    } finally {
      setFormLoading(false)
    }
  }

  const formatExceptionDate = (dateStr: string) => {
    try {
      // date is "yyyy-MM-dd" — parse as local date to avoid TZ shifts
      const [year, month, day] = dateStr.split('-').map(Number)
      return format(new Date(year, month - 1, day), "EEEE d 'de' MMMM, yyyy", { locale: es })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Excepciones y días cerrados
        </h3>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" />
          Agregar excepción
        </Button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={formDate}
                min={today}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo
              </label>
              <input
                type="text"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Festivo, Vacaciones, Mantenimiento..."
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={formLoading}>
              {formLoading ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setFormDate('')
                setFormReason('')
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Exceptions list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : exceptions.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Sin excepciones registradas
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {exceptions.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {formatExceptionDate(ex.date)}
                </p>
                {ex.reason && (
                  <p className="text-xs text-gray-500 mt-0.5">{ex.reason}</p>
                )}
              </div>
              <button
                onClick={() => removeMutation.mutate(ex.id)}
                disabled={removeMutation.isPending}
                title="Eliminar excepción"
                className="p-1.5 text-gray-300 hover:text-red-500 transition rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── GenerateSessionsSection ──────────────────────────────────────────────────

function GenerateSessionsSection() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState('')
  const [classTypeId, setClassTypeId] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerateSessionsResult | null>(null)

  const { data: typeList = [] } = useQuery({
    queryKey: ['class-types'],
    queryFn: classTypes.list,
  })

  const { data: spaceList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spaces.list,
  })

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromDate || !toDate) {
      toast.error('Selecciona el rango de fechas')
      return
    }
    if (!spaceId) {
      toast.error('Selecciona un espacio')
      return
    }
    if (new Date(toDate) < new Date(fromDate)) {
      toast.error('La fecha de fin debe ser posterior a la de inicio')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const data = await schedule.generate({
        from_date: fromDate,
        to_date: toDate,
        class_type_id: classTypeId || undefined,
        space_id: spaceId,
        skip_existing: true,
      })
      setResult(data as GenerateSessionsResult)
      toast.success('Sesiones generadas correctamente')
    } catch {
      toast.error('Error al generar sesiones')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleGenerate} className="space-y-5">
      {/* Warning note */}
      <p className="text-sm text-gray-500">
        Generará una sesión por hora según el horario configurado. Días desactivados y
        excepciones serán omitidos. Las sesiones ya existentes en ese rango serán
        omitidas automáticamente.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Desde
          </label>
          <input
            type="date"
            value={fromDate}
            min={today}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hasta
          </label>
          <input
            type="date"
            value={toDate}
            min={fromDate || today}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            required
          />
        </div>

        {/* Class type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de clase *
          </label>
          <select
            value={classTypeId}
            onChange={(e) => setClassTypeId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            required
          >
            <option value="">Selecciona...</option>
            {typeList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Space — required */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Espacio *
          </label>
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            required
          >
            <option value="">Selecciona un espacio...</option>
            {spaceList.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} — capacidad {sp.capacity}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              {result.created} sesiones creadas
              {result.skipped > 0 && `, ${result.skipped} omitidas`}
            </p>
            {result.dates_processed > 0 && (
              <p className="text-xs text-green-700 mt-0.5">
                {result.dates_processed} días procesados
              </p>
            )}
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? 'Generando...' : 'Generar sesiones'}
      </Button>
    </form>
  )
}

// ─── HorariosPage ─────────────────────────────────────────────────────────────

export default function HorariosPage() {
  return (
    <div className="space-y-6">
      {/* Section A: Weekly schedule */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Horario semanal
            </h2>
            <p className="text-sm text-gray-500">
              Activa los días y define las horas de apertura y cierre. Los cambios se guardan automáticamente.
            </p>
          </div>
        </div>
        <WeeklyScheduleSection />
      </section>

      {/* Section B: Exceptions */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <ExceptionsSection />
      </section>

      {/* Section C: Generate sessions */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Generar sesiones
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Crea automáticamente sesiones para un rango de fechas según el horario configurado.
          </p>
        </div>
        <GenerateSessionsSection />
      </section>
    </div>
  )
}
