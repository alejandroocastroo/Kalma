'use client'
import { useState } from 'react'
import { publicRoutes } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { toast } from 'sonner'
import { CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import type { PublicSession } from '@/types'

interface BookingWidgetProps {
  slug: string
  sessions: PublicSession[]
}

type Step = 'select-session' | 'enter-info' | 'success'

export function BookingWidget({ slug, sessions }: BookingWidgetProps) {
  const [step, setStep] = useState<Step>('select-session')
  const [selectedSession, setSelectedSession] = useState<PublicSession | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [bookingRef, setBookingRef] = useState('')

  const availableSessions = sessions.filter((s) => s.available_spots > 0)
  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value })

  const handleBook = async () => {
    if (!form.full_name || !form.phone) { toast.error('Nombre y teléfono son requeridos'); return }
    setLoading(true)
    try {
      const result = await publicRoutes.book(slug, {
        class_session_id: selectedSession!.id,
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || undefined,
      })
      setBookingRef(result.appointment_id)
      setStep('success')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al reservar')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">¡Reserva confirmada!</h3>
        <p className="text-gray-500 mb-2">
          Hola <strong>{form.full_name}</strong>, tu lugar está asegurado.
        </p>
        {selectedSession && (
          <p className="text-sm text-gray-500 mb-6">
            <strong>{selectedSession.class_type.name}</strong> ·{' '}
            {new Date(selectedSession.start_datetime).toLocaleString('es-CO', {
              weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: true
            })}
          </p>
        )}
        <p className="text-xs text-gray-400">Ref: {bookingRef.slice(0, 8).toUpperCase()}</p>
        <button
          onClick={() => { setStep('select-session'); setSelectedSession(null); setForm({ full_name: '', phone: '', email: '' }) }}
          className="mt-6 text-sm text-primary-600 hover:underline"
        >
          Reservar otra clase
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Progress */}
      <div className="flex border-b border-gray-100">
        {['Elige tu clase', 'Tus datos'].map((label, i) => (
          <div
            key={label}
            className={`flex-1 py-3 text-center text-sm font-medium transition ${
              (step === 'select-session' && i === 0) || (step === 'enter-info' && i === 1)
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-400'
            }`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      <div className="p-6">
        {step === 'select-session' && (
          <div className="space-y-3">
            {availableSessions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay sesiones disponibles esta semana. Contáctanos para más información.
              </p>
            ) : (
              availableSessions.map((session) => {
                const date = new Date(session.start_datetime)
                const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                const day = days[date.getDay()]
                const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                const isSelected = selectedSession?.id === session.id

                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition ${
                      isSelected ? 'border-primary-600 bg-primary-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{session.class_type.name}</p>
                        <p className="text-sm text-gray-500">{day} · {time} · {session.class_type.duration_minutes}min</p>
                        <p className="text-xs text-green-600 mt-0.5">{session.available_spots} lugares disponibles</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600">{formatCOP(session.class_type.price)}</p>
                        {isSelected && <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center ml-auto mt-1">
                          <span className="text-white text-xs">✓</span>
                        </div>}
                      </div>
                    </div>
                  </button>
                )
              })
            )}

            {selectedSession && (
              <button
                onClick={() => setStep('enter-info')}
                className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition flex items-center justify-center gap-2 mt-2"
              >
                Continuar <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {step === 'enter-info' && (
          <div className="space-y-4">
            {selectedSession && (
              <div className="bg-primary-50 rounded-xl p-3 text-sm">
                <p className="font-semibold text-primary-900">{selectedSession.class_type.name}</p>
                <p className="text-primary-700">
                  {new Date(selectedSession.start_datetime).toLocaleString('es-CO', {
                    weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: true
                  })}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                type="text"
                placeholder="Valentina Torres"
                value={form.full_name}
                onChange={f('full_name')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp *</label>
              <input
                type="tel"
                placeholder="+573001234567"
                value={form.phone}
                onChange={f('phone')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(opcional)</span></label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={f('email')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('select-session')}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Atrás
              </button>
              <button
                onClick={handleBook}
                disabled={loading}
                className="flex-2 flex-1 bg-primary-600 text-white py-2.5 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Reservando...</> : 'Confirmar reserva'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
