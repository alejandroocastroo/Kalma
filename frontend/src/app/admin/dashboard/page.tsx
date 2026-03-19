'use client'
import { useQuery } from '@tanstack/react-query'
import { classSessions, payments, clients, appointments } from '@/lib/api'
import { StatsCard } from '@/components/admin/stats-card'
import { SessionCard } from '@/components/admin/session-card'
import { formatCOP, formatDateTime, appointmentStatusConfig } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, DollarSign, TrendingUp, Plus } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

export default function DashboardPage() {
  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  const { data: weekSessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['week-sessions'],
    queryFn: () => classSessions.week(),
  })

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['payment-summary', monthStart, monthEnd],
    queryFn: () => payments.summary({ start: monthStart, end: monthEnd }),
  })

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ['clients-count'],
    queryFn: () => clients.list({ limit: 1 }),
  })

  const { data: recentAppointments, isLoading: loadingAppts } = useQuery({
    queryKey: ['recent-appointments'],
    queryFn: () => appointments.list(),
  })

  // Filtrar sesiones de hoy
  const todaySessions = weekSessions?.filter((s) => {
    const sessionDate = new Date(s.start_datetime)
    return sessionDate.toDateString() === today.toDateString()
  }) || []

  // Dummy bar chart data desde summary
  const chartData = weekSessions
    ? Object.entries(
        weekSessions.reduce((acc: Record<string, number>, s) => {
          const day = format(new Date(s.start_datetime), 'EEE', { locale: undefined })
          acc[day] = (acc[day] || 0) + s.enrolled_count
          return acc
        }, {})
      ).map(([day, count]) => ({ day, count }))
    : []

  const recentAppts = recentAppointments?.slice(0, 8) || []

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/admin/agenda" className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 transition">
          <Plus className="w-4 h-4" /> Nueva sesión
        </Link>
        <Link href="/admin/clientes" className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </Link>
        <Link href="/admin/caja" className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
          <Plus className="w-4 h-4" /> Registrar pago
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Clases hoy"
          value={loadingSessions ? '—' : todaySessions.length}
          icon={<Calendar className="w-5 h-5" />}
          loading={loadingSessions}
        />
        <StatsCard
          title="Clientes activos"
          value={loadingClients ? '—' : clientsData?.total || 0}
          icon={<Users className="w-5 h-5" />}
          loading={loadingClients}
        />
        <StatsCard
          title="Ingresos del mes"
          value={loadingSummary ? '—' : formatCOP(summary?.total_income || 0)}
          icon={<DollarSign className="w-5 h-5" />}
          loading={loadingSummary}
        />
        <StatsCard
          title="Balance neto"
          value={loadingSummary ? '—' : formatCOP(summary?.net || 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          loading={loadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Weekly chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Asistencia esta semana</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">Sin sesiones esta semana</p>
          )}
        </div>

        {/* Today's sessions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Clases de hoy</h3>
          {loadingSessions ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : todaySessions.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin clases programadas</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent appointments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Citas recientes</h3>
        {loadingAppts ? (
          <p className="text-gray-400 text-sm">Cargando...</p>
        ) : recentAppts.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin citas registradas</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentAppts.map((appt) => {
              const statusCfg = appointmentStatusConfig[appt.status]
              return (
                <div key={appt.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{appt.client_name || 'Cliente'}</p>
                    <p className="text-xs text-gray-500">
                      {appt.class_type_name} · {appt.session_start ? formatDateTime(appt.session_start) : '—'}
                    </p>
                  </div>
                  <Badge className={statusCfg?.className}>{statusCfg?.label || appt.status}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
