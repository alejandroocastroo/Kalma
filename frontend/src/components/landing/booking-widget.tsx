'use client'
import { useState } from 'react'
import { formatCOP } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import type { PublicSession } from '@/types'

interface BookingWidgetProps {
  slug: string
  sessions: PublicSession[]
  whatsappPhone: string  // formato: "573113513135" (sin + ni espacios)
  studioName: string
}

type Step = 'select-session' | 'enter-info'

export function BookingWidget({ sessions, whatsappPhone, studioName }: BookingWidgetProps) {
  const [step, setStep] = useState<Step>('select-session')
  const [selectedSession, setSelectedSession] = useState<PublicSession | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [sent, setSent] = useState(false)

  const availableSessions = sessions.filter((s) => s.available_spots > 0)

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value })

  const handleSend = () => {
    if (!form.full_name.trim() || !form.phone.trim()) return

    const date = new Date(selectedSession!.start_datetime)
    const weekday = date.toLocaleDateString('es-CO', { weekday: 'long' })
    const dateStr = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
    const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
    const className = selectedSession!.class_type.name

    const message =
      `Hola ${studioName}! Mi nombre es ${form.full_name} y quisiera reservar una clase de *${className}* ` +
      `el ${weekday} ${dateStr} a las ${time}. Mi número es ${form.phone}.`

    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, '_blank')
    setSent(true)
  }

  const handleReset = () => {
    setStep('select-session')
    setSelectedSession(null)
    setForm({ full_name: '', phone: '' })
    setSent(false)
  }

  // ── Confirmación enviada ──────────────────────────────────
  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-green-600">
            <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896.002-3.176-1.24-6.165-3.48-8.45zm-8.475 18.307h-.004c-1.774 0-3.513-.476-5.031-1.378l-.361-.214-3.741.975.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm5.422-7.403c-.297-.149-1.758-.867-2.03-.967-.272-.099-.47-.148-.669.148-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Mensaje enviado!</h3>
        <p className="text-gray-500 text-sm mb-1">
          Tu solicitud de reserva fue enviada por WhatsApp a <strong>{studioName}</strong>.
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Te confirmarán tu lugar directamente por ese medio.
        </p>
        <button
          onClick={handleReset}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          Solicitar otra clase
        </button>
      </div>
    )
  }

  // ── Tabs de progreso ──────────────────────────────────────
  const steps = ['1. Elige tu clase', '2. Tus datos']
  const activeIndex = step === 'select-session' ? 0 : 1

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {steps.map((label, i) => (
          <div
            key={label}
            className={`flex-1 py-3 text-center text-sm font-medium transition ${
              i === activeIndex
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-400'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="p-6">

        {/* ── Paso 1: Elegir sesión ─────────────────────────── */}
        {step === 'select-session' && (
          <div className="space-y-3">
            {availableSessions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay sesiones disponibles esta semana.
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
                        <p className="text-sm text-gray-500">
                          {day} · {time} · {session.class_type.duration_minutes}min
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">
                          {session.available_spots} lugares disponibles
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600">{formatCOP(session.class_type.price)}</p>
                        {isSelected && (
                          <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center ml-auto mt-1">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
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

        {/* ── Paso 2: Datos del usuario ─────────────────────── */}
        {step === 'enter-info' && (
          <div className="space-y-4">
            {selectedSession && (
              <div className="bg-primary-50 rounded-xl p-3 text-sm">
                <p className="font-semibold text-primary-900">{selectedSession.class_type.name}</p>
                <p className="text-primary-700">
                  {new Date(selectedSession.start_datetime).toLocaleString('es-CO', {
                    weekday: 'long', day: 'numeric', month: 'long',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo *
              </label>
              <input
                type="text"
                placeholder="Valentina Torres"
                value={form.full_name}
                onChange={f('full_name')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono / WhatsApp *
              </label>
              <input
                type="tel"
                placeholder="3001234567"
                value={form.phone}
                onChange={f('phone')}
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
                onClick={handleSend}
                disabled={!form.full_name.trim() || !form.phone.trim()}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896.002-3.176-1.24-6.165-3.48-8.45zm-8.475 18.307h-.004c-1.774 0-3.513-.476-5.031-1.378l-.361-.214-3.741.975.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm5.422-7.403c-.297-.149-1.758-.867-2.03-.967-.272-.099-.47-.148-.669.148-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                </svg>
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
