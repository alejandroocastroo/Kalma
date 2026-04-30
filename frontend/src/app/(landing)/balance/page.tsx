import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import { Users, Phone, Instagram, MessageCircle } from 'lucide-react'
import { BookingWidget } from '@/components/landing/booking-widget'
import { ClassesCarousel } from '@/components/landing/classes-carousel'
import { formatCOP } from '@/lib/utils'
import type { PublicSession } from '@/types'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
})

// ─── API ────────────────────────────────────────────────────────────────────

const API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'

async function getBalanceSchedule(): Promise<PublicSession[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/balance/schedule`, {
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
  title: 'Balance Barre Studio — Reserva tu clase',
  description:
    'Estudio de Barré enfocado en el movimiento consciente y el bienestar integral. Fortalece tu cuerpo, equilibra tu mente.',
  openGraph: {
    title: 'Balance Barre Studio',
    description: 'Movimiento consciente. Bienestar integral.',
    images: ['/balance/galeria-1.jpg'],
  },
}

// ─── CONTENIDO ESTÁTICO ──────────────────────────────────────────────────────

const INSTRUCTORS = [
  { name: 'Isabella', file: 'isabella.jpg', role: 'Instructora certificada' },
  { name: 'Juan Manuel', file: 'juanmanuel.jpg', role: 'Instructor certificado' },
]

const GALLERY = [
  'galeria-1.jpg',
  'galeria-2.jpg',
  'galeria-3.jpg',
  'galeria-4.jpg',
  'galeria-5.jpg',
  'galeria-6.jpg',
]

const CLASES = [
  {
    nombre: 'Barre Dance',
    descripcion: 'Fusión de ballet, danza y fitness. Trabaja coordinación, flexibilidad y tono muscular al ritmo de la música.',
    musculos: ['Piernas', 'Glúteos', 'Core', 'Postura'],
  },
  {
    nombre: 'Tren Inferior',
    descripcion: 'Fortalecimiento profundo de piernas, caderas y glúteos con movimientos precisos inspirados en la barra de ballet.',
    musculos: ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Caderas'],
  },
  {
    nombre: 'Tren Superior',
    descripcion: 'Activa hombros, espalda alta y brazos para una postura equilibrada y una silueta fuerte y elegante.',
    musculos: ['Hombros', 'Espalda alta', 'Pecho', 'Bíceps/Tríceps'],
  },
  {
    nombre: 'Core',
    descripcion: 'Trabajo profundo del centro del cuerpo. Activa el transverso, lumbar y suelo pélvico desde adentro.',
    musculos: ['Transverso', 'Lumbar', 'Oblicuos', 'Diafragma'],
  },
  {
    nombre: 'Recto abd & Oblicuos',
    descripcion: 'Sesión dedicada al abdomen frontal y lateral. Definición y fuerza con técnica depurada.',
    musculos: ['Recto abdominal', 'Oblicuos', 'Core profundo'],
  },
  {
    nombre: 'Piso Pélvico',
    descripcion: 'Clase especializada para fortalecer y reconectar con el suelo pélvico. Ideal para todas las etapas de la vida.',
    musculos: ['Suelo pélvico', 'Transverso', 'Lumbar profundo'],
  },
  {
    nombre: 'Full Body',
    descripcion: 'Una sesión completa que recorre todo el cuerpo con fluidez. Balance entre fuerza, control y consciencia.',
    musculos: ['Cuerpo completo', 'Cardio suave', 'Flexibilidad'],
  },
]

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const
const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const HORARIO_MANANA = {
  franja: '6:00 AM – 10:00 AM',
  dias: {
    Lunes: 'Tren inferior',
    Martes: 'Tren superior',
    Miércoles: 'Tren inferior',
    Jueves: 'Core',
    Viernes: 'Barre dance',
  },
}

const HORARIO_TARDE = {
  franja: '3:00 PM – 7:00 PM',
  dias: {
    Lunes: 'Tren inferior',
    Martes: 'Tren superior',
    Miércoles: 'Recto abd & Oblicuos',
    Jueves: 'Piso pélvico',
    Viernes: 'Barre dance',
  },
}

// ─── COMPONENTE SEPARADOR ───────────────────────────────────────────────────

const Separator = () => (
  <div className="flex items-center justify-center gap-4 py-10">
    <div className="h-px w-16 bg-[#D4A5A0]" />
    <div className="w-1.5 h-1.5 rounded-full bg-[#D4A5A0]" />
    <div className="h-px w-16 bg-[#D4A5A0]" />
  </div>
)

// ─── ICON ───────────────────────────────────────────────────────────────────

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.79 1.52V6.76a4.85 4.85 0 0 1-1.02-.07z" />
  </svg>
)

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default async function BalanceLandingPage() {
  const schedule: PublicSession[] = await getBalanceSchedule()

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: '#F5EFE6' }}>

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
          src="/balance/galeria-1.jpg"
          alt="Balance Barre Studio"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[#2A2118]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F5EFE6]/20 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto">
          <p className="text-[#EDD5D2] text-xs tracking-[0.35em] uppercase mb-8">
            Tuluá, Valle del Cauca
          </p>

          <h1
            className={`${playfair.className} text-white leading-none mb-3`}
            style={{ fontSize: 'clamp(72px, 14vw, 160px)', fontWeight: 400, letterSpacing: '0.02em' }}
          >
            Balance
          </h1>
          <p className="text-[#EDD5D2]/80 text-xs tracking-[0.45em] uppercase mb-10">
            Barre Studio
          </p>

          <p className="text-white/70 text-sm font-light max-w-sm leading-relaxed mb-10">
            Movimiento consciente y bienestar integral. Espacios tranquilos para fortalecer
            tu cuerpo y equilibrar tu mente.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="#reservar"
              className="inline-block text-white px-8 py-3 text-xs font-medium tracking-[0.2em] uppercase transition-colors rounded-full"
              style={{ backgroundColor: '#D4A5A0' }}
            >
              Reserva tu clase
            </a>
            <a
              href="#clases"
              className="inline-block border border-white/40 text-white px-8 py-3 text-xs font-medium tracking-[0.2em] uppercase hover:bg-white/10 transition-colors rounded-full"
            >
              Ver clases
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="h-12 w-px bg-white/25 mx-auto" />
        </div>
      </section>

      {/* ── NOSOTROS ─────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ backgroundColor: '#FAF7F3' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className={`${playfair.className} text-4xl md:text-5xl leading-snug`}
              style={{ color: '#2A2118', fontStyle: 'italic', fontWeight: 400 }}
            >
              Movimiento consciente.<br />Bienestar integral.
            </h2>
          </div>

          <p className="text-center text-sm font-light leading-relaxed max-w-2xl mx-auto mb-16" style={{ color: '#8A7B72' }}>
            Somos un estudio de Barré, creado por una pareja, enfocado en el movimiento consciente
            y el bienestar integral. Creamos espacios tranquilos donde las personas pueden fortalecer
            su cuerpo, equilibrar su mente y desarrollar hábitos de ejercicio sostenibles y saludables.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { num: '01', title: 'Movimiento con propósito', desc: 'Cada clase está diseñada para conectar cuerpo y mente desde adentro hacia afuera, con técnica y consciencia.' },
              { num: '02', title: 'Grupos de 6 personas', desc: 'Atención personalizada. Máximo 6 personas por sesión para que cada clase sea tuya de verdad.' },
              { num: '03', title: 'Hábitos sostenibles', desc: 'Construimos rutinas de movimiento que permanecen en el tiempo y transforman tu bienestar diario.' },
            ].map(({ num, title, desc }) => (
              <div key={num}>
                <span className="text-xs tracking-[0.3em] block mb-4" style={{ color: '#D4A5A0' }}>{num}</span>
                <h3 className="uppercase tracking-widest text-xs font-medium mb-3" style={{ color: '#2A2118' }}>{title}</h3>
                <p className="text-sm font-light leading-relaxed" style={{ color: '#8A7B72' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── INSTRUCTORES ─────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#F5EFE6' }}>
        <div className="px-6 md:px-16 max-w-5xl mx-auto">
          <div className="mb-14">
            <p className="uppercase tracking-[0.25em] text-xs font-medium mb-2" style={{ color: '#B5A59C' }}>Equipo</p>
            <h2 className={`${playfair.className} text-3xl`} style={{ color: '#2A2118', fontWeight: 400 }}>
              Nuestro equipo
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl">
            {INSTRUCTORS.map(({ name, file, role }) => (
              <div key={name} className="group">
                <div className="relative aspect-[3/4] overflow-hidden mb-5 rounded-2xl" style={{ backgroundColor: '#EDD5D2' }}>
                  <Image
                    src={`/balance/${file}`}
                    alt={name}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <p className="uppercase tracking-[0.15em] text-sm font-medium mb-1" style={{ color: '#2A2118' }}>{name}</p>
                <p className="text-xs" style={{ color: '#B5A59C' }}>{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── CLASES ───────────────────────────────────────────────── */}
      <section id="clases" className="py-20" style={{ backgroundColor: '#F5EFE6' }}>
        <div className="px-6 md:px-16 max-w-5xl mx-auto">
          <div className="mb-14">
            <p className="uppercase tracking-[0.25em] text-xs font-medium mb-2" style={{ color: '#B5A59C' }}>Modalidades</p>
            <h2 className={`${playfair.className} text-3xl`} style={{ color: '#2A2118', fontWeight: 400 }}>
              Nuestras clases
            </h2>
          </div>
          <ClassesCarousel clases={CLASES} fadeColor="#F5EFE6" />
        </div>
      </section>

      <Separator />

      {/* ── HORARIO SEMANAL ──────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#FAF7F3' }}>
        <div className="px-6 md:px-16 max-w-5xl mx-auto">
          <div className="mb-14">
            <p className="uppercase tracking-[0.25em] text-xs font-medium mb-2" style={{ color: '#B5A59C' }}>Cronograma</p>
            <h2 className={`${playfair.className} text-3xl`} style={{ color: '#2A2118', fontWeight: 400 }}>
              Horario semanal
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-3 pr-6 text-xs font-medium tracking-widest uppercase w-36" style={{ color: '#B5A59C' }}>
                    Franja
                  </th>
                  {DIAS.map((d) => (
                    <th key={d} className="py-3 px-4 text-xs font-medium tracking-widest uppercase text-center" style={{ color: '#8A7B72' }}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Mañana */}
                <tr style={{ borderTop: '1px solid #E4D8D0' }}>
                  <td className="py-5 pr-6 text-xs font-light align-top" style={{ color: '#B5A59C' }}>
                    {HORARIO_MANANA.franja}
                  </td>
                  {DIAS.map((d) => (
                    <td key={d} className="py-5 px-4 text-center">
                      <span className="inline-block text-xs px-3 py-1.5 font-light leading-snug rounded-full" style={{ backgroundColor: '#EDD5D2', color: '#2A2118' }}>
                        {HORARIO_MANANA.dias[d]}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Cierre mediodía */}
                <tr style={{ borderTop: '1px solid #E4D8D0' }}>
                  <td colSpan={6} className="py-4 text-center">
                    <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#B5A59C' }}>
                      10:00 AM – 3:00 PM &nbsp;·&nbsp; Cerrado
                    </span>
                  </td>
                </tr>

                {/* Tarde */}
                <tr style={{ borderTop: '1px solid #E4D8D0' }}>
                  <td className="py-5 pr-6 text-xs font-light align-top" style={{ color: '#B5A59C' }}>
                    {HORARIO_TARDE.franja}
                  </td>
                  {DIAS.map((d) => (
                    <td key={d} className="py-5 px-4 text-center">
                      <span className="inline-block text-xs px-3 py-1.5 font-light leading-snug rounded-full border" style={{ backgroundColor: '#FAF7F3', color: '#8A7B72', borderColor: '#E4D8D0' }}>
                        {HORARIO_TARDE.dias[d]}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sábado y domingos */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-6 flex items-center justify-between rounded-2xl" style={{ backgroundColor: '#FDFAF7', border: '1px solid #E4D8D0' }}>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#B5A59C' }}>Sábado</p>
                <p className="text-sm font-light" style={{ color: '#2A2118' }}>7:00 AM – 12:00 PM</p>
              </div>
              <span className="text-xs px-4 py-2 font-light rounded-full" style={{ backgroundColor: '#D4A5A0', color: 'white' }}>
                Full body
              </span>
            </div>
            <div className="p-6 flex items-center justify-between rounded-2xl" style={{ backgroundColor: '#FDFAF7', border: '1px solid #E4D8D0' }}>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#B5A59C' }}>Domingos y Festivos</p>
                <p className="text-sm font-light" style={{ color: '#B5A59C' }}>Sin actividad programada</p>
              </div>
              <span className="text-xs px-4 py-2 font-light rounded-full border" style={{ color: '#B5A59C', borderColor: '#E4D8D0' }}>
                Cerrado
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLANES Y PRECIOS ─────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#F5EFE6' }}>
        <div className="px-6 md:px-16 max-w-5xl mx-auto">

          {/* Encabezado */}
          <div className="mb-14">
            <p className="uppercase tracking-[0.25em] text-xs font-medium mb-2" style={{ color: '#B5A59C' }}>
              Membresías
            </p>
            <h2
              className={`${playfair.className} text-4xl`}
              style={{ color: '#2A2118', fontWeight: 400 }}
            >
              Planes y precios
            </h2>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Plan Balance */}
            <div
              className="rounded-2xl p-8 flex flex-col"
              style={{ backgroundColor: '#FAF7F3', border: '1px solid #E4D8D0' }}
            >
              <p
                className="uppercase tracking-[0.2em] text-xs font-medium mb-1"
                style={{ color: '#B5A59C' }}
              >
                Plan
              </p>
              <p
                className={`${playfair.className} text-2xl mb-6`}
                style={{ color: '#2A2118', fontWeight: 400 }}
              >
                Balance
              </p>
              <p className="text-xs font-light mb-8" style={{ color: '#8A7B72' }}>
                2 clases / semana
              </p>
              <div className="mt-auto">
                <p
                  className="text-3xl font-light tabular-nums mb-1"
                  style={{ color: '#2A2118' }}
                >
                  $120.000
                </p>
                <p className="text-xs font-light mb-8" style={{ color: '#B5A59C' }}>
                  COP / mes
                </p>
                <a
                  href="#reservar"
                  className="block text-center text-xs font-medium tracking-[0.15em] uppercase py-3 rounded-full"
                  style={{ backgroundColor: '#EDD5D2', color: '#2A2118' }}
                >
                  Reservar ahora
                </a>
              </div>
            </div>

            {/* Plan Enfoque — destacado */}
            <div
              className="rounded-2xl p-8 flex flex-col relative"
              style={{ backgroundColor: '#D4A5A0' }}
            >
              <p
                className="uppercase tracking-[0.2em] text-xs font-medium mb-1"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                Plan
              </p>
              <p
                className={`${playfair.className} text-2xl mb-1`}
                style={{ color: 'white', fontWeight: 400 }}
              >
                Enfoque
              </p>
              <p
                className="text-xs tracking-[0.15em] uppercase mb-6"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                Mas popular
              </p>
              <p className="text-xs font-light mb-8" style={{ color: 'rgba(255,255,255,0.8)' }}>
                3 clases / semana
              </p>
              <div className="mt-auto">
                <p
                  className="text-3xl font-light tabular-nums mb-1"
                  style={{ color: 'white' }}
                >
                  $160.000
                </p>
                <p className="text-xs font-light mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  COP / mes
                </p>
                <a
                  href="#reservar"
                  className="block text-center text-xs font-medium tracking-[0.15em] uppercase py-3 rounded-full transition-colors"
                  style={{ backgroundColor: 'white', color: '#D4A5A0' }}
                >
                  Reservar ahora
                </a>
              </div>
            </div>

            {/* Plan Constancia */}
            <div
              className="rounded-2xl p-8 flex flex-col"
              style={{ backgroundColor: '#FAF7F3', border: '1px solid #E4D8D0' }}
            >
              <p
                className="uppercase tracking-[0.2em] text-xs font-medium mb-1"
                style={{ color: '#B5A59C' }}
              >
                Plan
              </p>
              <p
                className={`${playfair.className} text-2xl mb-6`}
                style={{ color: '#2A2118', fontWeight: 400 }}
              >
                Constancia
              </p>
              <p className="text-xs font-light mb-8" style={{ color: '#8A7B72' }}>
                5 clases / semana
              </p>
              <div className="mt-auto">
                <p
                  className="text-3xl font-light tabular-nums mb-1"
                  style={{ color: '#2A2118' }}
                >
                  $220.000
                </p>
                <p className="text-xs font-light mb-8" style={{ color: '#B5A59C' }}>
                  COP / mes
                </p>
                <a
                  href="#reservar"
                  className="block text-center text-xs font-medium tracking-[0.15em] uppercase py-3 rounded-full"
                  style={{ backgroundColor: '#EDD5D2', color: '#2A2118' }}
                >
                  Reservar ahora
                </a>
              </div>
            </div>

          </div>

          {/* Nota pie */}
          <p
            className="mt-8 text-xs font-light text-center"
            style={{ color: '#B5A59C' }}
          >
            Todos los planes incluyen acceso a todas las modalidades del horario semanal. Sin permanencia minima.
          </p>

        </div>
      </section>

      <Separator />

      {/* ── GALERÍA ──────────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#F5EFE6' }}>
        <div className="px-6 md:px-16 max-w-5xl mx-auto mb-14">
          <p className="uppercase tracking-[0.25em] text-xs font-medium mb-2" style={{ color: '#B5A59C' }}>Espacio</p>
          <h2 className={`${playfair.className} text-3xl`} style={{ color: '#2A2118', fontWeight: 400 }}>
            El estudio
          </h2>
        </div>
        <div className="px-6 md:px-16 max-w-5xl mx-auto">
          {/* Primera foto — siempre presente, ancha */}
          <div className="overflow-hidden rounded-2xl mb-3" style={{ backgroundColor: '#EDD5D2' }}>
            <Image
              src="/balance/galeria-1.jpg"
              alt="Balance Barre Studio"
              width={1200}
              height={600}
              className="w-full object-cover hover:scale-105 transition-transform duration-700"
              style={{ maxHeight: '520px' }}
            />
          </div>
          {/* Resto del grid — solo si hay más imágenes en la carpeta */}
          {GALLERY.length > 1 && (
            <div className="columns-2 md:columns-3 gap-3 space-y-3 mt-3">
              {GALLERY.slice(1).map((file, i) => (
                <div key={file} className="break-inside-avoid overflow-hidden rounded-2xl" style={{ backgroundColor: '#EDD5D2' }}>
                  <Image
                    src={`/balance/${file}`}
                    alt={`Balance Barre Studio — foto ${i + 2}`}
                    width={400}
                    height={i % 2 === 0 ? 500 : 300}
                    className="w-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── HORARIO RESERVAS (BD) ─────────────────────────────────── */}
      {schedule.length > 0 && (
        <section id="horario" className="py-20" style={{ backgroundColor: '#FAF7F3' }}>
          <div className="px-6 md:px-16 max-w-5xl mx-auto">
            <div className="mb-14">
              <p className="uppercase tracking-[0.25em] text-xs font-medium mb-2" style={{ color: '#B5A59C' }}>Disponibilidad</p>
              <h2 className={`${playfair.className} text-3xl`} style={{ color: '#2A2118', fontWeight: 400 }}>
                Clases esta semana
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {schedule.map((session) => {
                const date = new Date(session.start_datetime)
                const dayName = DAYS_SHORT[date.getDay() === 0 ? 6 : date.getDay() - 1]
                const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                const isFull = session.available_spots === 0
                return (
                  <div key={session.id} className="p-6 rounded-2xl transition-colors" style={{ backgroundColor: '#FDFAF7', border: '1px solid #E4D8D0' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-medium text-sm" style={{ color: '#2A2118' }}>{session.class_type.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#B5A59C' }}>{dayName} · {time}</p>
                      </div>
                      <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: session.class_type.color }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5" style={{ color: '#B5A59C' }}>
                        <Users className="w-3 h-3" />
                        {isFull ? <span className="font-medium">Lleno</span> : <span>{session.available_spots} disponibles</span>}
                      </span>
                      <span className="font-medium" style={{ color: '#2A2118' }}>{formatCOP(session.class_type.price)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── RESERVAR ─────────────────────────────────────────────── */}
      <section id="reservar" className="py-20 px-6 md:px-16" style={{ backgroundColor: '#F5EFE6' }}>
        <div className="max-w-lg mx-auto">
          <div className="mb-10">
            <p className="uppercase tracking-[0.25em] text-xs font-medium mb-2" style={{ color: '#B5A59C' }}>Reservas</p>
            <h2 className={`${playfair.className} text-3xl`} style={{ color: '#2A2118', fontWeight: 400 }}>
              Reserva tu clase
            </h2>
            <p className="text-sm mt-2 font-light" style={{ color: '#8A7B72' }}>
              Escoge tu horario y asegura tu lugar en minutos.
            </p>
          </div>
          <BookingWidget slug="balance" sessions={schedule} whatsappPhone="573234753748" studioName="Balance Barre Studio" />
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="py-16 px-6 md:px-16" style={{ backgroundColor: '#2A2118', color: 'white' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className={`${playfair.className} text-2xl font-light mb-6`} style={{ color: '#EDD5D2' }}>
                Balance Barre Studio
              </h2>
              <a
                href={`https://wa.me/573234753748`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm hover:text-white transition-colors mb-3"
                style={{ color: '#8A7B72' }}
              >
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>+57 323 475 3748</span>
              </a>
            </div>

            <div className="flex flex-col gap-4">
              <p className="uppercase tracking-[0.25em] text-xs font-medium mb-1" style={{ color: '#5A4A40' }}>
                Redes sociales
              </p>
              <a href="https://wa.me/573234753748" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm hover:text-white transition-colors" style={{ color: '#8A7B72' }}>
                <MessageCircle className="w-4 h-4" /><span>WhatsApp</span>
              </a>
              <a href="https://www.instagram.com/balancebarrestudioo/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm hover:text-white transition-colors" style={{ color: '#8A7B72' }}>
                <Instagram className="w-4 h-4" /><span>@balancebarrestudioo</span>
              </a>
              <a href="https://www.tiktok.com/@balancebarrestudioo" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm hover:text-white transition-colors" style={{ color: '#8A7B72' }}>
                <TikTokIcon /><span>@balancebarrestudioo</span>
              </a>
            </div>
          </div>

          <div className="mt-14 pt-8 flex flex-col sm:flex-row justify-between gap-3" style={{ borderTop: '1px solid #3D2E26' }}>
            <p className="text-xs" style={{ color: '#5A4A40' }}>© {new Date().getFullYear()} Balance Barre Studio</p>
            <p className="text-xs" style={{ color: '#5A4A40' }}>Powered by <span style={{ color: '#8A7B72' }} className="font-medium">Kalma</span></p>
          </div>
        </div>
      </footer>

    </div>
  )
}
