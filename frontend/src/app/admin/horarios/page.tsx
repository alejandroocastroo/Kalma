'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { schedule, spaces } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { GenerateSessionsResult } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

// Both open and close use 0–23 (close is inclusive: last session starts at that hour)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i}:00`,
}))

// ─── GenerateSessionsSection ──────────────────────────────────────────────────

function GenerateSessionsSection() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState('')
  const [openHour, setOpenHour] = useState(6)
  const [closeHour, setCloseHour] = useState(21)
  const [spaceId, setSpaceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerateSessionsResult | null>(null)

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
    if (openHour >= closeHour) {
      toast.error('La hora de apertura debe ser menor que la de cierre')
      return
    }

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
      <p className="text-sm text-gray-500">
        Crea una sesión por hora para cada día del rango. La{' '}
        <strong>primera clase</strong> inicia en la hora de apertura y la{' '}
        <strong>última clase</strong> inicia en la hora de cierre (cada clase
        dura 1 hora). Sesiones ya existentes serán omitidas.
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

        {/* Hour range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primera clase
          </label>
          <select
            value={openHour}
            onChange={(e) => setOpenHour(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
          >
            {HOUR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Última clase
          </label>
          <select
            value={closeHour}
            onChange={(e) => setCloseHour(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
          >
            {HOUR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Space — required */}
        <div className="sm:col-span-2">
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
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Generar sesiones
            </h2>
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
