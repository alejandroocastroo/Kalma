'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { classSessions, classTypes, appointments } from '@/lib/api'
import { SessionCard } from '@/components/admin/session-card'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatCOP, appointmentStatusConfig } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, X, Users } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import type { ClassSession } from '@/types'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6) // 6am - 8pm

export default function AgendaPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const qc = useQueryClient()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['week-sessions', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () => classSessions.list({
      start: format(weekStart, "yyyy-MM-dd'T'00:00:00"),
      end: format(addDays(weekStart, 7), "yyyy-MM-dd'T'00:00:00"),
    }),
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
    sessions.filter((s) => isSameDay(parseISO(s.start_datetime), day))

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-48 text-center">
            {format(weekStart, "d 'de' MMMM", { locale: es })} — {format(addDays(weekStart, 6), "d 'de' MMMM, yyyy", { locale: es })}
          </span>
          <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => setCurrentWeek(new Date())} className="px-3 py-1.5 text-sm border rounded-xl hover:bg-gray-50">
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
              <div key={day.toISOString()} className="p-3 text-center border-r border-gray-100 last:border-r-0">
                <p className="text-xs text-gray-500 uppercase">{format(day, 'EEE', { locale: es })}</p>
                <p className={`text-lg font-semibold mt-0.5 ${isToday ? 'text-primary-600' : 'text-gray-900'}`}>
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
                  <div key={day.toISOString()} className="p-1 border-r border-gray-50 last:border-r-0 min-h-[60px]">
                    {daySessions.map((s) => (
                      <button key={s.id} className="w-full text-left" onClick={() => setSelectedSession(s)}>
                        <SessionCard session={s} />
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
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent title={selectedSession?.class_type_name || 'Sesión'}>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Inicio</p>
                  <p className="font-medium">{formatDateTime(selectedSession.start_datetime)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Instructor</p>
                  <p className="font-medium">{selectedSession.instructor_name || 'Sin asignar'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Capacidad</p>
                  <p className="font-medium">{selectedSession.enrolled_count}/{selectedSession.capacity}</p>
                </div>
                <div>
                  <p className="text-gray-500">Estado</p>
                  <Badge variant={selectedSession.status === 'cancelled' ? 'destructive' : 'success'}>
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
                        <div key={appt.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <div>
                            <p className="text-sm font-medium">{appt.client_name}</p>
                            <p className="text-xs text-gray-500">{appt.client_phone}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {appt.paid && <Badge variant="success">Pagó</Badge>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className}`}>
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
                  <Button variant="outline" size="sm">Cerrar</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create session modal - simplified */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent title="Nueva sesión">
          <CreateSessionForm onClose={() => { setShowCreateModal(false); qc.invalidateQueries({ queryKey: ['week-sessions'] }) }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateSessionForm({ onClose }: { onClose: () => void }) {
  const { data: types = [] } = useQuery({ queryKey: ['class-types'], queryFn: classTypes.list })
  const [form, setForm] = useState({ class_type_id: '', start_datetime: '', capacity: '8' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.class_type_id || !form.start_datetime) { toast.error('Completa todos los campos'); return }
    setLoading(true)
    try {
      const start = new Date(form.start_datetime)
      const ct = types.find((t) => t.id === form.class_type_id)
      const end = new Date(start.getTime() + (ct?.duration_minutes || 60) * 60000)
      await classSessions.create({ class_type_id: form.class_type_id, start_datetime: start.toISOString(), end_datetime: end.toISOString(), capacity: parseInt(form.capacity) })
      toast.success('Sesión creada')
      onClose()
    } catch { toast.error('Error al crear sesión') } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de clase</label>
        <select className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={form.class_type_id} onChange={(e) => setForm({ ...form, class_type_id: e.target.value })}>
          <option value="">Selecciona...</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora</label>
        <input type="datetime-local" className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
        <input type="number" min="1" className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear sesión'}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}
