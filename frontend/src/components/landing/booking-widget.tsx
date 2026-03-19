'use client'
import { useState } from 'react'
import { publicRoutes } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { toast } from 'sonner'
import { CheckCircle2, ChevronRight, Loader2, Users, Building2 } from 'lucide-react'
import type { PublicSession } from '@/types'

// The public API does not require auth so we call fetch directly for spaces/availability
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface PublicSpace {
  id: string
  name: string
  description?: string
  capacity: number
  price: number
  currency: string
  is_active: boolean
}

interface SlotAvailability {
  hour: number
  booked: number
  available: number
  is_full: boolean
}

interface BookingWidgetProps {
  slug: string
  sessions: PublicSession[]
}

type Step = 'select-space' | 'select-session' | 'enter-info' | 'success'

async function fetchPublicSpaces(slug: string): Promise<PublicSpace[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}/spaces`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

async function fetchSlotAvailability(spaceId: string, date: string): Promise<SlotAvailability[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/spaces/${spaceId}/availability?date=${date}`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export function BookingWidget({ slug, sessions }: BookingWidgetProps) {
  const [step, setStep] = useState<Step>('select-space')
  const [publicSpaces, setPublicSpaces] = useState<PublicSpace[]>([])
  const [spacesLoaded, setSpacesLoaded] = useState(false)
  const [spacesLoading, setSpacesLoading] = useState(false)
  const [selectedSpace, setSelectedSpace] = useState<PublicSpace | null>(null)
  const [selectedSession, setSelectedSession] = useState<PublicSession | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [bookingRef, setBookingRef] = useState('')

  // Load spaces on first mount (once)
  const loadSpaces = async () => {
    if (spacesLoaded || spacesLoading) return
    setSpacesLoading(true)
    const result = await fetchPublicSpaces(slug)
    setPublicSpaces(result)
    setSpacesLoaded(true)
    setSpacesLoading(false)
    // If no spaces returned from backend, skip straight to session selection
    if (result.length === 0) {
      setStep('select-session')
    }
  }

  // Trigger space load on component first render
  if (!spacesLoaded && !spacesLoading) {
    loadSpaces()
  }

  const availableSessions = sessions.filter((s) => s.available_spots > 0)
  const spaceFilteredSessions = selectedSpace
    ? availableSessions.filter((s) => (s as any).space_id === selectedSpace.id)
    : availableSessions

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

  const handleReset = () => {
    setStep('select-space')
    setSelectedSpace(null)
    setSelectedSession(null)
    setForm({ full_name: '', phone: '', email: '' })
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
          onClick={handleReset}
          className="mt-6 text-sm text-primary-600 hover:underline"
        >
          Reservar otra clase
        </button>
      </div>
    )
  }

  // Step labels depend on whether spaces are available
  const hasSpaces = publicSpaces.length > 0
  const stepLabels = hasSpaces
    ? ['Espacio', 'Elige tu clase', 'Tus datos']
    : ['Elige tu clase', 'Tus datos']

  const activeStepIndex = hasSpaces
    ? { 'select-space': 0, 'select-session': 1, 'enter-info': 2, success: 3 }[step]
    : { 'select-space': -1, 'select-session': 0, 'enter-info': 1, success: 2 }[step]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Progress tabs */}
      <div className="flex border-b border-gray-100">
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={`flex-1 py-3 text-center text-sm font-medium transition ${
              i === activeStepIndex
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-400'
            }`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      <div className="p-6">
        {/* Step 0: Space selection */}
        {step === 'select-space' && (
          <div className="space-y-3">
            {spacesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : publicSpaces.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay espacios disponibles en este momento.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-1">Selecciona el espacio donde deseas reservar:</p>
                {publicSpaces.filter((sp) => sp.is_active).map((space) => {
                  const isSelected = selectedSpace?.id === space.id
                  return (
                    <button
                      key={space.id}
                      onClick={() => setSelectedSpace(space)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition ${
                        isSelected
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-primary-600' : 'bg-gray-100'
                          }`}>
                            <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{space.name}</p>
                            {space.description && (
                              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{space.description}</p>
                            )}
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                              <Users className="w-3 h-3" /> Máx {space.capacity} personas
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-primary-600 text-sm">{formatCOP(space.price)}</p>
                          {isSelected && (
                            <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center ml-auto mt-1">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}

                {selectedSpace && (
                  <button
                    onClick={() => setStep('select-session')}
                    className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition flex items-center justify-center gap-2 mt-2"
                  >
                    Continuar <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 1: Session selection */}
        {step === 'select-session' && (
          <div className="space-y-3">
            {selectedSpace && (
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-3 h-3 text-primary-600" />
                </div>
                <p className="text-sm font-medium text-primary-700">{selectedSpace.name}</p>
              </div>
            )}
            {spaceFilteredSessions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay sesiones disponibles esta semana. Contáctanos para más información.
              </p>
            ) : (
              spaceFilteredSessions.map((session) => {
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

            <div className="flex gap-2 mt-2">
              {hasSpaces && (
                <button
                  onClick={() => setStep('select-space')}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Atrás
                </button>
              )}
              {selectedSession && (
                <button
                  onClick={() => setStep('enter-info')}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition flex items-center justify-center gap-2"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Enter info */}
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
                {selectedSpace && (
                  <p className="text-primary-600 text-xs mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {selectedSpace.name}
                  </p>
                )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400">(opcional)</span>
              </label>
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
                className="flex-1 bg-primary-600 text-white py-2.5 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
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
