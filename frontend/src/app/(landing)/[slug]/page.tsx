import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Clock, Users, MapPin, Phone, Mail, Instagram, MessageCircle, Star } from 'lucide-react'
import { BookingWidget } from '@/components/landing/booking-widget'
import { formatCOP } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function getStudioInfo(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}/info`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getSchedule(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}/schedule`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const studio = await getStudioInfo(slug)
  if (!studio) return { title: 'Estudio no encontrado' }
  return {
    title: `${studio.name} — Reserva tu clase`,
    description: studio.description || `Reserva tus clases en ${studio.name}, ${studio.city}`,
    openGraph: {
      title: studio.name,
      description: studio.description,
      images: studio.cover_url ? [studio.cover_url] : [],
    },
  }
}

export default async function StudioLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [studio, schedule] = await Promise.all([
    getStudioInfo(slug),
    getSchedule(slug),
  ])

  if (!studio) notFound()

  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ─────────────────────────────────── */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center text-white overflow-hidden">
        {studio.cover_url ? (
          <Image src={studio.cover_url} alt={studio.name} fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-800 to-purple-900" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <p className="text-primary-300 text-sm font-semibold uppercase tracking-widest mb-4">
            {studio.city}
          </p>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">{studio.name}</h1>
          {studio.description && (
            <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">{studio.description}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#reservar"
              className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3.5 rounded-2xl font-semibold transition text-lg"
            >
              Reserva tu clase
            </a>
            <a
              href="#clases"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-8 py-3.5 rounded-2xl font-semibold transition text-lg border border-white/30"
            >
              Ver clases
            </a>
          </div>
        </div>
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/70 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── About / Features ─────────────────────── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { icon: Star, title: 'Instructoras certificadas', desc: 'Formación internacional y años de experiencia' },
              { icon: Users, title: 'Grupos pequeños', desc: 'Atención personalizada, máximo 12 personas por clase' },
              { icon: MapPin, title: 'Ubicación premium', desc: studio.address || studio.city },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-8 shadow-sm">
                <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Classes ──────────────────────────────── */}
      <section id="clases" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Nuestras clases</h2>
            <p className="text-gray-500">Encuentra la modalidad que mejor se adapte a ti</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studio.class_types.map((ct: any) => (
              <div key={ct.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                <div className="h-2" style={{ backgroundColor: ct.color }} />
                <div className="p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{ct.name}</h3>
                  {ct.description && <p className="text-gray-500 text-sm mb-4 leading-relaxed">{ct.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{ct.duration_minutes}min</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" />Máx {ct.capacity}</span>
                    </div>
                    <span className="font-bold text-primary-600 text-base">{formatCOP(ct.price)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Schedule ─────────────────────────────── */}
      {schedule.length > 0 && (
        <section id="horario" className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Horario esta semana</h2>
              <p className="text-gray-500">Elige el horario que más te convenga</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedule.map((session: any) => {
                const date = new Date(session.start_datetime)
                const dayName = days[date.getDay() === 0 ? 6 : date.getDay() - 1]
                const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                const isFull = session.available_spots === 0

                return (
                  <div key={session.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{session.class_type.name}</p>
                        <p className="text-sm text-gray-500">{dayName} · {time}</p>
                      </div>
                      <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: session.class_type.color }} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {isFull ? (
                          <span className="text-red-500 font-medium">Lleno</span>
                        ) : (
                          <span>{session.available_spots} disponibles</span>
                        )}
                      </span>
                      <span className="font-semibold text-primary-600">{formatCOP(session.class_type.price)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Booking Widget ───────────────────────── */}
      <section id="reservar" className="py-20 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Reserva tu clase</h2>
            <p className="text-gray-500">Escoge tu horario y asegura tu lugar en minutos</p>
          </div>
          <BookingWidget slug={slug} sessions={schedule} />
        </div>
      </section>

      {/* ── Contact ──────────────────────────────── */}
      <section className="py-16 px-4 bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">{studio.name}</h2>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-300">
            {studio.address && (
              <a href={`https://maps.google.com?q=${encodeURIComponent(studio.address)}`} target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-white transition">
                <MapPin className="w-4 h-4" />{studio.address}
              </a>
            )}
            {studio.phone && (
              <a href={`tel:${studio.phone}`} className="flex items-center gap-2 hover:text-white transition">
                <Phone className="w-4 h-4" />{studio.phone}
              </a>
            )}
            {studio.whatsapp_number && (
              <a href={`https://wa.me/${studio.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-green-400 transition">
                <MessageCircle className="w-4 h-4" />WhatsApp
              </a>
            )}
            {studio.instagram_url && (
              <a href={studio.instagram_url} target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-pink-400 transition">
                <Instagram className="w-4 h-4" />Instagram
              </a>
            )}
            {studio.email && (
              <a href={`mailto:${studio.email}`} className="flex items-center gap-2 hover:text-white transition">
                <Mail className="w-4 h-4" />{studio.email}
              </a>
            )}
          </div>
          <p className="text-gray-600 text-xs mt-10">
            Powered by <span className="text-primary-400 font-semibold">Kalma</span> · usekalma.com
          </p>
        </div>
      </section>
    </div>
  )
}
