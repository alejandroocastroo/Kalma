'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { schedule, spaces, classSessions } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CalendarDays, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isWithinInterval, getDay, addMonths,
  parseISO, isSameMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { GenerateSessionsResult } from '@/types'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${i}:00` }))

// ─── BlockedDaysPicker ────────────────────────────────────────────────────────

interface BlockedDaysPickerProps {
  fromDate: string
  toDate: string
  blockedDates: string[]
  holidays: Record<string, string>  // { 'yyyy-MM-dd': 'Nombre festivo' }
  onToggle: (date: string) => void
  onClear: () => void
  onAutoBlock: (dayOfWeek: number[]) => void
  onBlockHolidays: () => void
}

function BlockedDaysPicker({ fromDate, toDate, blockedDates, holidays, onToggle, onClear, onAutoBlock, onBlockHolidays }: BlockedDaysPickerProps) {
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
        {Object.keys(holidays).length > 0 && (
          <button
            type="button"
            onClick={onBlockHolidays}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 transition flex items-center gap-1"
          >
            🇨🇴 Bloquear festivos ({Object.keys(holidays).length})
          </button>
        )}
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

      {/* Lista de festivos del rango */}
      {Object.keys(holidays).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(holidays).sort().map(([d, name]) => (
            <span key={d} className={`text-xs px-2 py-0.5 rounded-full border ${
              blockedDates.includes(d)
                ? 'bg-amber-100 text-amber-700 border-amber-300 line-through'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              🎌 {format(parseISO(d), 'd MMM', { locale: es })} — {name}
            </span>
          ))}
        </div>
      )}

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
                  const holidayName = holidays[dateStr]

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
                      title={
                        isBlocked
                          ? `${dateStr} — bloqueado${holidayName ? ` (${holidayName})` : ''}`
                          : holidayName
                          ? `${holidayName}`
                          : dateStr
                      }
                      className={`h-8 flex items-center justify-center text-xs rounded-lg font-medium transition-colors relative ${
                        isBlocked
                          ? 'bg-red-100 text-red-500 line-through hover:bg-red-200'
                          : holidayName
                          ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300 hover:bg-red-100 hover:text-red-600'
                          : isSun
                          ? 'bg-orange-50 text-orange-700 hover:bg-red-100 hover:text-red-600'
                          : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                      }`}
                    >
                      {format(day, 'd')}
                      {holidayName && !isBlocked && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      )}
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
  const [holidays, setHolidays] = useState<Record<string, string>>({})

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

  // Fetch holidays for the selected range (Colombia por defecto)
  useEffect(() => {
    if (!rangeReady) { setHolidays({}); return }
    schedule.holidays({ from_date: fromDate, to_date: toDate, country: 'CO' })
      .then(data => {
        const map: Record<string, string> = {}
        data.forEach(h => { map[h.date] = h.name })
        setHolidays(map)
      })
      .catch(() => setHolidays({}))
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

  const blockHolidays = () => {
    const holidayDates = Object.keys(holidays)
    setBlockedDates(prev => Array.from(new Set([...prev, ...holidayDates])))
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
            holidays={holidays}
            onToggle={toggleDate}
            onClear={() => setBlockedDates([])}
            onAutoBlock={autoBlock}
            onBlockHolidays={blockHolidays}
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

// ─── HolidayConflictsSection ──────────────────────────────────────────────────

type ConflictAppt = { id: string; client_id: string; client_name: string; status: string }
type ConflictSession = {
  id: string
  start_datetime: string
  space_name: string | null
  class_type_name: string | null
  enrolled_count: number
  appointments: ConflictAppt[]
}
type HolidayConflict = { date: string; holiday_name: string; sessions: ConflictSession[] }

function bogotaTimeStr(utcIso: string): string {
  const dt = new Date(utcIso)
  const h = ((dt.getUTCHours() - 5) + 24) % 24
  return h.toString().padStart(2, '0') + ':00'
}

function HolidayConflictsSection() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM-dd')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(nextMonth)
  const [conflicts, setConflicts] = useState<HolidayConflict[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  const totalSessions = conflicts.reduce((sum, c) => sum + c.sessions.length, 0)

  const doSearch = async () => {
    setLoading(true)
    setSearched(false)
    try {
      const data = await schedule.holidayConflicts({ from_date: fromDate, to_date: toDate })
      setConflicts(data as HolidayConflict[])
      setSearched(true)
    } catch {
      toast.error('Error al buscar conflictos')
    } finally {
      setLoading(false)
    }
  }

  const removeSession = (sessionId: string) =>
    setConflicts(prev =>
      prev
        .map(c => ({ ...c, sessions: c.sessions.filter(s => s.id !== sessionId) }))
        .filter(c => c.sessions.length > 0)
    )

  const doCancel = async (sessionId: string, addMakeup: boolean) => {
    setProcessing(prev => new Set(prev).add(sessionId))
    try {
      const res = await classSessions.cancelHoliday(sessionId, { add_makeup: addMakeup })
      const extra = addMakeup && res.makeup_credits_added > 0
        ? ` · ${res.makeup_credits_added} crédito(s) de reposición agregado(s)`
        : ''
      toast.success(res.message + extra)
      removeSession(sessionId)
    } catch {
      toast.error('Error al cancelar la sesión')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(sessionId); return s })
    }
  }

  const cancelAll = async (addMakeup: boolean) => {
    const allIds = conflicts.flatMap(c => c.sessions.map(s => s.id))
    for (const id of allIds) {
      await doCancel(id, addMakeup)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Detecta sesiones programadas en días festivos y gestiona cancelaciones masivas con o sin crédito de reposición para cada cliente.
      </p>

      {/* Date range + search */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-300 text-sm"
          />
        </div>
        <Button type="button" onClick={doSearch} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar conflictos'}
        </Button>
      </div>

      {/* No conflicts */}
      {searched && conflicts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">
            No hay sesiones programadas en días festivos en este rango. ¡Todo en orden!
          </p>
        </div>
      )}

      {/* Conflicts list */}
      {conflicts.length > 0 && (
        <div className="space-y-4">
          {/* Bulk actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-amber-700">
              {totalSessions} sesión(es) en {conflicts.length} festivo(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cancelAll(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition font-medium"
              >
                Cancelar todo + reposición
              </button>
              <button
                type="button"
                onClick={() => cancelAll(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition"
              >
                Cancelar todo
              </button>
            </div>
          </div>

          {/* One card per holiday */}
          {conflicts.map(conflict => (
            <div key={conflict.date} className="border border-amber-200 rounded-2xl overflow-hidden">
              {/* Holiday header */}
              <div className="bg-amber-50 px-4 py-3 flex items-center gap-2">
                <span className="text-base">🎌</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">{conflict.holiday_name}</p>
                  <p className="text-xs text-amber-700">
                    {format(parseISO(conflict.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                    {' · '}{conflict.sessions.length} sesión(es)
                  </p>
                </div>
              </div>

              {/* Sessions inside the holiday */}
              <div className="divide-y divide-gray-100">
                {conflict.sessions.map(s => {
                  const isProc = processing.has(s.id)
                  const timeStr = bogotaTimeStr(s.start_datetime)
                  return (
                    <div key={s.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            🕐 {timeStr}
                            {s.space_name && (
                              <span className="text-gray-500 font-normal"> · {s.space_name}</span>
                            )}
                            {s.class_type_name && s.class_type_name !== s.space_name && (
                              <span className="text-gray-400 font-normal text-xs"> ({s.class_type_name})</span>
                            )}
                          </p>
                          {s.appointments.length > 0 ? (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              👤 {s.appointments.map(a => a.client_name).join(', ')}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 mt-0.5">Sin clientes inscritos</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            disabled={isProc}
                            onClick={() => doCancel(s.id, true)}
                            title="Cancelar y agregar crédito de reposición a cada cliente"
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50 font-medium"
                          >
                            {isProc ? '...' : '+ repo'}
                          </button>
                          <button
                            type="button"
                            disabled={isProc}
                            onClick={() => doCancel(s.id, false)}
                            title="Cancelar sin crédito de reposición"
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition disabled:opacity-50"
                          >
                            {isProc ? '...' : 'Cancelar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Conflictos con festivos</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestiona sesiones programadas en días feriados.
            </p>
          </div>
        </div>
        <HolidayConflictsSection />
      </section>
    </div>
  )
}
