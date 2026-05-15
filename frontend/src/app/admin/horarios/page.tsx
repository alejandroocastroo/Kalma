'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { schedule, spaces } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CalendarDays, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isWithinInterval, isSameDay, getDay, addMonths,
  parseISO, isSameMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { GenerateSessionsResult } from '@/types'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${i}:00` }))

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ─── BlockedDaysPicker ────────────────────────────────────────────────────────

interface BlockedDaysPickerProps {
  fromDate: string   // 'yyyy-MM-dd'
  toDate: string     // 'yyyy-MM-dd'
  blockedDates: string[]
  onToggle: (date: string) => void
  onClear: () => void
  onAutoBlock: (dayOfWeek: number[]) => void
}

function BlockedDaysPicker({ fromDate, toDate, blockedDates, onToggle, onClear, onAutoBlock }: BlockedDaysPickerProps) {
  const from = parseISO(fromDate)
  const to = parseISO(toDate)

  // Build list of months that span the range
  const months = useMemo(() => {
    const result: Date[] = []
    let m = startOfMonth(from)
    while (m <= endOfMonth(to)) {
      result.push(m)
      m = addMonths(m, 1)
    }
    return result
  }, [fromDate, toDate])

  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates])

  const daysInRange = useMemo(
    () => eachDayOfInterval({ start: from, end: to }),
    [fromDate, toDate]
  )
  const totalDays = daysInRange.length
  const blockedCount = daysInRange.filter(d => blockedSet.has(format(d, 'yyyy-MM-dd'))).length
  const activeDays = totalDays - blockedCount

  return (
    <div className="space-y-3">
      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAutoBlock([0])}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
        >
          Bloquear domingos
        </button>
        <button
          type="button"
          onClick={() => onAutoBlock([0, 6])}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
        >
          Bloquear sáb. y dom.
        </button>
        {blockedCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Limpiar ({blockedCount})
          </button>
        )}
      </div>

      {/* Summary */}
      <p className="text-xs text-gray-500">
        <span className="font-medium text-gray-800">{activeDays}</span> días activos
        {blockedCount > 0 && (
          <> · <span className="text-red-600 font-medium">{blockedCount} bloqueados</span></>
        )}
        {' '}de {totalDays} en el rango
      </p>

      {/* Calendar grid — one month per row */}
      <div className="space-y-5">
        {months.map((monthStart) => {
          const monthEnd = endOfMonth(monthStart)
          // Pad week start to Monday
          const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
          const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
          const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

          return (
            <div key={monthStart.toISOString()}>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                {format(monthStart, 'MMMM yyyy', { locale: es })}
              </p>
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 mb-1">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">
                    {d}
                  </div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {gridDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const inRange = isWithinInterval(day, { start: from, end: to })
                  const isBlocked = blockedSet.has(dateStr)
                  const inCurrentMonth = isSameMonth(day, monthStart)
                  const isSun = getDay(day) === 0

                  if (!inCurrentMonth) {
                    return <div key={dateStr} />
                  }

                  if (!inRange) {
                    return (
                      <div
                        key={dateStr}
                        className="h-8 flex items-center justify-center text-xs text-gray-200 rounded-lg"
                      >
                        {format(day, 'd')}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => onToggle(dateStr)}
                      title={isBlocked ? `${dateStr} — bloqueado` : dateStr}
                      className={`h-8 flex items-center justify-center text-xs rounded-lg font-medium transition-colors ${
                        isBlocked
                          ? 'bg-red-100 text-red-500 line-through hover:bg-red-200'
                          : isSun
                          ? 'bg-orange-50 text-orange-700 hover:bg-red-100 hover:text-red-600'
                          : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                      }`}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── GenerateSessionsSection ──────────────────────────────────────────────────

function GenerateSessionsSection() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState('')
  const [openHour, setOpenHour] = useState(6)
  const [closeHour, setCloseHour] = useState(21)
  const [blockedHours, setBlockedHours] = useState<number[]>([])
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [spaceId, setSpaceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerateSessionsResult | null>(null)

  const { data: spaceList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spaces.list,
  })

  const rangeReady = fromDate && toDate && new Date(toDate) >= new Date(fromDate)

  // Auto-block sundays whenever the date range changes
  useEffect(() => {
    if (!rangeReady) return
    const from = parseISO(fromDate)
    const to = parseISO(toDate)
    const days = eachDayOfInterval({ start: from, end: to })
    const sundays = days.filter(d => getDay(d) === 0).map(d => format(d, 'yyyy-MM-dd'))
    setBlockedDates(sundays)
  }, [fromDate, toDate])

  const toggleDate = (dateStr: string) => {
    setBlockedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    )
  }

  const autoBlock = (daysOfWeek: number[]) => {
    if (!rangeReady) return
    const from = parseISO(fromDate)
    const to = parseISO(toDate)
    const days = eachDayOfInterval({ start: from, end: to })
    const toBlock = days
      .filter(d => daysOfWeek.includes(getDay(d)))
      .map(d => format(d, 'yyyy-MM-dd'))
    setBlockedDates(prev => Array.from(new Set([...prev, ...toBlock])))
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromDate || !toDate) { toast.error('Selecciona el rango de fechas'); return }
    if (!spaceId) { toast.error('Selecciona un espacio'); return }
    if (new Date(toDate) < new Date(fromDate)) { toast.error('La fecha de fin debe ser posterior'); return }
    if (openHour >= closeHour) { toast.error('La hora de apertura debe ser menor que la de cierre'); return }

    setLoading(true)
    setResult(null)
    try {
      const data = await schedule.generate({
        from_date: fromDate,
        to_date: toDate,
        space_id: spaceId,
        skip_existing: true,
        open_hour: openHour,
        close_hour: closeHour,
        blocked_hours: blockedHours,
        blocked_dates: blockedDates,
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
    <form onSubmit={handleGenerate} className="space-y-6">
      <p className="text-sm text-gray-500">
        Crea una sesión por hora para cada día activo del rango. Sesiones ya existentes serán omitidas.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
          <input
            type="date"
            value={fromDate}
            min={today}
            onChange={(e) => { setFromDate(e.target.value); setResult(null) }}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
          <input
            type="date"
            value={toDate}
            min={fromDate || today}
            onChange={(e) => { setToDate(e.target.value); setResult(null) }}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            required
          />
        </div>

        {/* Hour range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primera clase</label>
          <select
            value={openHour}
            onChange={(e) => setOpenHour(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
          >
            {HOUR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Última clase</label>
          <select
            value={closeHour}
            onChange={(e) => setCloseHour(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
          >
            {HOUR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Space */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Espacio *</label>
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
            required
          >
            <option value="">Selecciona un espacio...</option>
            {spaceList.map((sp) => (
              <option key={sp.id} value={sp.id}>{sp.name} — capacidad {sp.capacity}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Blocked days calendar — shown once both dates are selected */}
      {rangeReady && (
        <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">Días a excluir</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Haz clic en los días del calendario para marcarlos como libres (sin sesiones).
              Los domingos quedan bloqueados por defecto.
            </p>
          </div>
          <BlockedDaysPicker
            fromDate={fromDate}
            toDate={toDate}
            blockedDates={blockedDates}
            onToggle={toggleDate}
            onClear={() => setBlockedDates([])}
            onAutoBlock={autoBlock}
          />
        </div>
      )}

      {/* Blocked hours */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Horas sin servicio
          <span className="ml-1.5 text-xs font-normal text-gray-400">(ej: hora de almuerzo)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: closeHour - openHour + 1 }, (_, i) => openHour + i).map(hour => {
            const isBlocked = blockedHours.includes(hour)
            return (
              <button
                key={hour}
                type="button"
                onClick={() => setBlockedHours(prev =>
                  isBlocked ? prev.filter(h => h !== hour) : [...prev, hour].sort((a, b) => a - b)
                )}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isBlocked
                    ? 'bg-red-100 text-red-700 border-red-300 line-through'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {hour}:00
              </button>
            )
          })}
        </div>
        {blockedHours.length > 0 && (
          <p className="text-xs text-red-600">
            Se omitirán: {blockedHours.map(h => `${h}:00`).join(', ')}
            {' '}· <button type="button" onClick={() => setBlockedHours([])} className="underline">limpiar</button>
          </p>
        )}
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
              <p className="text-xs text-green-700 mt-0.5">{result.dates_processed} días procesados</p>
            )}
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading || !rangeReady}>
        {loading ? 'Generando...' : 'Generar sesiones'}
      </Button>
    </form>
  )
}

// ─── HorariosPage ─────────────────────────────────────────────────────────────

export default function HorariosPage() {
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Generar sesiones</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Crea automáticamente sesiones para un rango de fechas y horas.
            </p>
          </div>
        </div>
        <GenerateSessionsSection />
      </section>
    </div>
  )
}
