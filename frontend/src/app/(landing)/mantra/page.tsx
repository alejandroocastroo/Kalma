import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Cormorant_Garamond } from 'next/font/google'
import { Users, MapPin, Phone, Instagram, MessageCircle, Facebook } from 'lucide-react'
import { BookingWidget } from '@/components/landing/booking-widget'
import { ClassesCarousel } from '@/components/landing/classes-carousel'
import { formatCOP } from '@/lib/utils'
import type { PublicSession } from '@/types'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
})

// ─── API (solo horario de reservas) ─────────────────────────────────────────

const API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'

async function getMantraSchedule(): Promise<PublicSession[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/mantra/schedule`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// ─── METADATA ───────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Mantra Pilates Studio — Reserva tu clase',
  description:
    'Somos un estudio de pilates, creado por 3 mujeres, enfocado en el movimiento consciente y el bienestar integral.',
  openGraph: {
    title: 'Mantra Pilates Studio',
    description: 'Estudio de pilates en Tuluá, Valle del Cauca.',
    images: ['/mantra/galeria-1.jpg'],
  },
}

// ─── CONTENIDO ESTÁTICO ──────────────────────────────────────────────────────

const INSTRUCTORS = [
  { name: 'Samantha', file: 'instructor-samantha.jpg', role: 'Instructora certificada' },
  { name: 'Isabella', file: 'instructor-isabella.jpg', role: 'Instructora certificada' },
  { name: 'Carlos', file: 'instructor-carlos.jpg', role: 'Instructor certificado' },
]

const GALLERY = [
  'galeria-1.jpg', 'galeria-2.jpg', 'galeria-3.jpg', 'galeria-4.jpg',
  'galeria-5.jpg', 'galeria-6.jpg', 'galeria-7.jpg', 'galeria-8.jpg',
  'galeria-9.jpg', 'galeria-10.jpg', 'galeria-11.jpg', 'galeria-12.jpg',
]

const CLASES = [
  {
    nombre: 'Full Body',
    descripcion: 'Trabaja el cuerpo completo en una sola sesión — piernas, brazos, abdomen y espalda en equilibrio.',
    musculos: ['Piernas', 'Brazos', 'Abdomen', 'Espalda'],
  },
  {
    nombre: 'Tren Inferior Abs',
    descripcion: 'Combinación de fortalecimiento de piernas con trabajo profundo de abdomen y oblicuos.',
    musculos: ['Cuádriceps', 'Isquiotibiales', 'Abdomen', 'Oblicuos'],
  },
  {
    nombre: 'Control Postural',
    descripcion: 'Mejora tu alineación y estabilidad. Ideal para liberar tensión y corregir hábitos posturales.',
    musculos: ['Columna', 'Paravertebrales', 'Core profundo'],
  },
  {
    nombre: 'Core',
    descripcion: 'Activa y fortalece el centro del cuerpo. Base de toda práctica de pilates consciente.',
    musculos: ['Transverso', 'Suelo pélvico', 'Lumbar', 'Diafragma'],
  },
  {
    nombre: 'Tren Inferior Glúteo',
    descripcion: 'Enfocado en esculpir y fortalecer glúteos, caderas e isquiotibiales con trabajo específico.',
    musculos: ['Glúteos', 'Isquiotibiales', 'Caderas', 'Abductores'],
  },
  {
    nombre: 'Tren Superior',
    descripcion: 'Fortalece espalda alta, hombros, pecho y brazos para una postura equilibrada y fuerte.',
    musculos: ['Hombros', 'Espalda alta', 'Pecho', 'Bíceps/Tríceps'],
  },
  {
    nombre: 'Tren Inferior Femoral',
    descripcion: 'Trabajo profundo del frente y back de piernas. Especial para cuádriceps y femoral.',
    musculos: ['Cuádriceps', 'Femoral', 'Rodillas', 'Pantorrillas'],
  },
]

// Horario semanal: columnas = días, filas = franjas horarias
const HORARIO_SEMANAL = {
  manana: {
    franja: '6:00 AM – 11:00 AM',
    dias: {
      Lunes: 'Full Body',
      Martes: 'Tren Inferior Abs',
      Miércoles: 'Control Postural',
      Jueves: 'Core',
      Viernes: 'Full Body',
    },
  },
  cierre: '11:00 AM – 2:00 PM · Cerrado',
  tarde: {
    franja: '2:00 PM – 7:00 PM',
    dias: {
      Lunes: 'Tren Inferior Glúteo',
      Martes: 'Tren Superior',
      Miércoles: 'Tren Inferior Femoral',
      Jueves: 'Core',
      Viernes: 'Full Body',
    },
  },
  sabado: {
    franja: '7:00 AM – 12:00 PM',
    clase: 'Full Body',
  },
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const
const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ─── ICONS ──────────────────────────────────────────────────────────────────

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.79 1.52V6.76a4.85 4.85 0 0 1-1.02-.07z" />
  </svg>
)

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default async function MantraLandingPage() {
  const schedule: PublicSession[] = await getMantraSchedule()

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── ACCESO FLOTANTE ─────────────────────────────────────── */}
      <header className="fixed top-0 right-0 z-50 p-5">
        <Link
          href="/login"
          className="text-white/60 hover:text-white text-xs tracking-[0.2em] uppercase transition-colors"
        >
          Acceso →
        </Link>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative h-screen min-h-[640px] flex items-center justify-center overflow-hidden">
        <Image
          src="/mantra/galeria-1.jpg"
          alt="Mantra Pilates Studio"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto">
          <p className="text-white/40 text-xs tracking-[0.35em] uppercase mb-8">
            Tuluá, Valle del Cauca
          </p>

          <h1 className={`${cormorant.className} text-white leading-none mb-3`}
            style={{ fontSize: 'clamp(72px, 14vw, 160px)', fontWeight: 300, letterSpacing: '0.04em' }}>
            Mantra
          </h1>
          <p className="text-white/60 text-xs tracking-[0.45em] uppercase mb-10">
            Pilates Studio
          </p>

          <p className="text-white/65 text-sm font-light max-w-sm leading-relaxed mb-10">
            Somos un estudio de pilates, creado por 3 mujeres, enfocado en el movimiento
            consciente y el bienestar integral.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="#reservar"
              className="inline-block bg-white text-stone-900 px-8 py-3 text-xs font-medium tracking-[0.2em] uppercase hover:bg-stone-100 transition-colors"
            >
              Reserva tu clase
            </a>
            <a
              href="#clases"
              className="inline-block border border-white/40 text-white px-8 py-3 text-xs font-medium tracking-[0.2em] uppercase hover:bg-white/10 transition-colors"
            >
              Ver clases
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="h-12 w-px bg-white/25 mx-auto" />
        </div>
      </section>

      {/* ── NOSOTRAS ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-light text-stone-900 leading-snug">
              Movimiento consciente.<br />Bienestar integral.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { num: '01', title: 'Intención en cada clase', desc: 'Cada sesión está diseñada para conectar cuerpo y mente desde adentro hacia afuera.' },
              { num: '02', title: 'Grupos pequeños', desc: 'Atención personalizada. Máximo 12 personas por sesión para garantizar tu progreso.' },
              { num: '03', title: 'Hábitos sostenibles', desc: 'Construimos rutinas de movimiento que permanecen en el tiempo y transforman tu vida diaria.' },
            ].map(({ num, title, desc }) => (
              <div key={num}>
                <span className="text-stone-300 text-xs tracking-[0.3em] block mb-4">{num}</span>
                <h3 className="uppercase tracking-widest text-xs font-medium text-stone-900 mb-3">{title}</h3>
                <p className="text-stone-500 text-sm font-light leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTRUCTORES ─────────────────────────────────────────── */}
      <section className="py-20 bg-stone-50">
        <div className="px-6 md:px-16 max-w-5xl mx-auto">
          <div className="mb-14">
            <p className="uppercase tracking-[0.25em] text-xs text-stone-400 mb-2">Equipo</p>
            <h2 className="text-3xl font-light text-stone-900">Nuestro equipo</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {INSTRUCTORS.map(({ name, file, role }) => (
              <div key={name} className="group">
                <div className="relative aspect-[3/4] overflow-hidden bg-stone-200 mb-5">
                  <Image
                    src={`/mantra/${file}`}
                    alt={name}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <p className="uppercase tracking-[0.15em] text-sm font-medium text-stone-900 mb-1">{name}</p>
                <p className="text-stone-400 text-xs">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLASES ───────────────────────────────────────────────── */}
      <section id="clases" className="py-20 bg-white">
        <div className="px-6 md:px-16 max-w-5xl mx-auto">
          <div className="mb-14">
            <p className="uppercase tracking-[0.25em] text-xs text-stone-400 mb-2">Modalidades</p>
            <h2 className="text-3xl font-light text-stone-900">Nuestras clases</h2>
          </div>

          <ClassesCarousel clases={CLASES} />
        </div>
      </section>

      {/* ── HORARIO SEMANAL ──────────────────────────────────────── */}
      <section className="py-20 bg-stone-50">
        <div className="px-6 md:px-16 max-w-5xl mx-auto">
          <div className="mb-14">
            <p className="uppercase tracking-[0.25em] text-xs text-stone-400 mb-2">Cronograma</p>
            <h2 className="text-3xl font-light text-stone-900">Horario semanal</h2>
          </div>

          {/* Tabla Lunes–Viernes */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-3 pr-6 text-xs text-stone-400 font-medium tracking-widest uppercase w-36">
                    Franja
                  </th>
                  {DIAS.map((d) => (
                    <th key={d} className="py-3 px-4 text-xs text-stone-500 font-medium tracking-widest uppercase text-center">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Mañana */}
                <tr className="border-t border-stone-200">
                  <td className="py-5 pr-6 text-xs text-stone-400 font-light align-top">
                    {HORARIO_SEMANAL.manana.franja}
                  </td>
                  {DIAS.map((d) => (
                    <td key={d} className="py-5 px-4 text-center">
                      <span className="inline-block bg-stone-900 text-white text-xs px-3 py-1.5 font-light leading-snug">
                        {HORARIO_SEMANAL.manana.dias[d]}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Cierre mediodía */}
                <tr className="border-t border-stone-200">
                  <td colSpan={6} className="py-4 text-center">
                    <span className="text-xs text-stone-400 tracking-[0.2em] uppercase">
                      11:00 AM – 2:00 PM &nbsp;·&nbsp; Cerrado
                    </span>
                  </td>
                </tr>

                {/* Tarde */}
                <tr className="border-t border-stone-200">
                  <td className="py-5 pr-6 text-xs text-stone-400 font-light align-top">
                    {HORARIO_SEMANAL.tarde.franja}
                  </td>
                  {DIAS.map((d) => (
                    <td key={d} className="py-5 px-4 text-center">
                      <span className="inline-block bg-stone-100 text-stone-700 text-xs px-3 py-1.5 font-light leading-snug">
                        {HORARIO_SEMANAL.tarde.dias[d]}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sábado y domingos */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-px bg-stone-200">
            <div className="bg-stone-50 p-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-400 font-medium uppercase tracking-widest mb-1">Sábado</p>
                <p className="text-sm text-stone-900 font-light">{HORARIO_SEMANAL.sabado.franja}</p>
              </div>
              <span className="bg-stone-900 text-white text-xs px-4 py-2 font-light">
                {HORARIO_SEMANAL.sabado.clase}
              </span>
            </div>
            <div className="bg-stone-50 p-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-400 font-medium uppercase tracking-widest mb-1">Domingos y Festivos</p>
                <p className="text-sm text-stone-400 font-light">Sin actividad programada</p>
              </div>
              <span className="border border-stone-200 text-stone-400 text-xs px-4 py-2 font-light">
                Cerrado
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── GALERÍA ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="px-6 md:px-16 max-w-5xl mx-auto mb-14">
          <p className="uppercase tracking-[0.25em] text-xs text-stone-400 mb-2">Espacio</p>
          <h2 className="text-3xl font-light text-stone-900">El estudio</h2>
        </div>
        <div className="px-6 md:px-16 max-w-5xl mx-auto columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
          {GALLERY.map((file, i) => (
            <div key={file} className="break-inside-avoid overflow-hidden bg-stone-200">
              <Image
                src={`/mantra/${file}`}
                alt={`Mantra Pilates — foto ${i + 1}`}
                width={400}
                height={i % 3 === 0 ? 500 : 300}
                className="w-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── HORARIO RESERVAS (BD) ─────────────────────────────────── */}
      {schedule.length > 0 && (
        <section id="horario" className="py-20 bg-stone-50">
          <div className="px-6 md:px-16 max-w-5xl mx-auto">
            <div className="mb-14">
              <p className="uppercase tracking-[0.25em] text-xs text-stone-400 mb-2">Disponibilidad</p>
              <h2 className="text-3xl font-light text-stone-900">Clases esta semana</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-stone-200">
              {schedule.map((session) => {
                const date = new Date(session.start_datetime)
                const dayName = DAYS_SHORT[date.getDay() === 0 ? 6 : date.getDay() - 1]
                const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                const isFull = session.available_spots === 0
                return (
                  <div key={session.id} className="bg-white p-6 hover:bg-stone-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-medium text-stone-900 text-sm">{session.class_type.name}</p>
                        <p className="text-stone-400 text-xs mt-0.5">{dayName} · {time}</p>
                      </div>
                      <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: session.class_type.color }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-stone-400">
                        <Users className="w-3 h-3" />
                        {isFull ? <span className="font-medium">Lleno</span> : <span>{session.available_spots} disponibles</span>}
                      </span>
                      <span className="font-medium text-stone-900">{formatCOP(session.class_type.price)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── RESERVAR ─────────────────────────────────────────────── */}
      <section id="reservar" className="py-20 px-6 md:px-16 bg-white">
        <div className="max-w-lg mx-auto">
          <div className="mb-10">
            <p className="uppercase tracking-[0.25em] text-xs text-stone-400 mb-2">Reservas</p>
            <h2 className="text-3xl font-light text-stone-900">Reserva tu clase</h2>
            <p className="text-stone-500 text-sm mt-2 font-light">
              Escoge tu horario y asegura tu lugar en minutos.
            </p>
          </div>
          <BookingWidget slug="mantra" sessions={schedule} />
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="py-16 px-6 md:px-16 bg-stone-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <Image
                  src="/mantra/cover.jpg"
                  alt="Mantra logo"
                  width={48}
                  height={48}
                  className="object-contain opacity-60"
                />
                <h2 className="text-xl font-light tracking-wide">Mantra Pilates Studio</h2>
              </div>
              <a
                href="https://maps.google.com?q=Cra.+34+%2316-6+Tulu%C3%A1+Valle+del+Cauca"
                target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2.5 text-stone-400 text-sm hover:text-white transition-colors mb-3"
              >
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Cra. 34 #16-6, Tuluá, Valle del Cauca</span>
              </a>
              <a href="tel:+573113513135"
                className="flex items-center gap-2.5 text-stone-400 text-sm hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>+57 311 351 3135</span>
              </a>
            </div>

            <div className="flex flex-col gap-4">
              <p className="uppercase tracking-[0.25em] text-xs text-stone-500 font-medium mb-1">Redes sociales</p>
              <a href="https://wa.me/573113513135" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-stone-400 text-sm hover:text-white transition-colors">
                <MessageCircle className="w-4 h-4" /><span>WhatsApp</span>
              </a>
              <a href="https://www.instagram.com/mantrapilatesstudio/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-stone-400 text-sm hover:text-white transition-colors">
                <Instagram className="w-4 h-4" /><span>@mantrapilatesstudio</span>
              </a>
              <a href="https://www.tiktok.com/@mantrapilatesstudio" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-stone-400 text-sm hover:text-white transition-colors">
                <TikTokIcon /><span>@mantrapilatesstudio</span>
              </a>
              {/*   <a href="https://www.facebook.com/MantradePilatesEstudio" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-stone-400 text-sm hover:text-white transition-colors">
                <Facebook className="w-4 h-4" /><span>Mantra Pilates Estudio</span>
              </a> */}
            </div>
          </div>

          <div className="mt-14 pt-8 border-t border-stone-800 flex flex-col sm:flex-row justify-between gap-3">
            <p className="text-stone-600 text-xs">© {new Date().getFullYear()} Mantra Pilates Studio</p>
            <p className="text-stone-600 text-xs">Powered by <span className="text-stone-400 font-medium">Kalma</span></p>
          </div>
        </div>
      </footer>

    </div>
  )
}
