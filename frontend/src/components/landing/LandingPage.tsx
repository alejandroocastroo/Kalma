'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  CalendarDays, Users, CreditCard, BarChart3,
  RotateCcw, DollarSign, ArrowRight, Mail,
  Phone, Github, Linkedin, CheckCircle, Menu, X
} from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Agenda semanal',
    desc: 'Visualiza todas las clases, espacios y cupos en tiempo real. Arrastra, edita y gestiona con un clic.',
  },
  {
    icon: Users,
    title: 'Gestión de clientes',
    desc: 'Historial completo de asistencia, membresías activas y contacto centralizado por cliente.',
  },
  {
    icon: CreditCard,
    title: 'Membresías inteligentes',
    desc: 'Mensual o por sesiones. Kalma calcula la fecha de vencimiento automáticamente según los días pactados.',
  },
  {
    icon: BarChart3,
    title: 'Cobros y cartera',
    desc: 'Lista priorizada: quién debe, quién vence esta semana y quién está al día. Sin hojas de cálculo.',
  },
  {
    icon: DollarSign,
    title: 'Caja contable',
    desc: 'Ingresos, egresos y balance neto por espacio o categoría. Exporta a Excel con un clic.',
  },
  {
    icon: RotateCcw,
    title: 'Reposiciones',
    desc: 'Gestiona clases perdidas con aviso previo. Kalma extiende el plan automáticamente si aplica.',
  },
]

const SCREENSHOTS = [
  { key: 'dashboard', label: 'Dashboard', src: '/screenshots/dashboard.png' },
  { key: 'agenda', label: 'Agenda', src: '/screenshots/agenda.png' },
  { key: 'membresias', label: 'Membresías', src: '/screenshots/membresias.png' },
  { key: 'clientes', label: 'Clientes', src: '/screenshots/clientes.png' },
  { key: 'caja', label: 'Caja', src: '/screenshots/caja.png' },
]

const CLIENTS = [
  { name: 'Mantra Estudio', location: 'Tuluá, Colombia', initials: 'ME', color: 'bg-violet-100 text-violet-700' },
  { name: 'Balance Barre Estudio', location: 'Tuluá, Colombia', initials: 'BB', color: 'bg-indigo-100 text-indigo-700' },
]

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">Kalma</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
          <a href="#funcionalidades" className="hover:text-gray-900 transition-colors">Funcionalidades</a>
          <a href="#capturas" className="hover:text-gray-900 transition-colors">Capturas</a>
          <a href="#clientes" className="hover:text-gray-900 transition-colors">Clientes</a>
          <a href="#contacto" className="hover:text-gray-900 transition-colors">Contacto</a>
        </nav>

        <a
          href="https://wa.me/573154578347?text=Hola%20Alejandro%2C%20me%20interesa%20Kalma%20para%20mi%20estudio"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Solicitar demo
        </a>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-4 text-sm">
          <a href="#funcionalidades" onClick={() => setOpen(false)} className="text-gray-600">Funcionalidades</a>
          <a href="#capturas" onClick={() => setOpen(false)} className="text-gray-600">Capturas</a>
          <a href="#clientes" onClick={() => setOpen(false)} className="text-gray-600">Clientes</a>
          <a href="#contacto" onClick={() => setOpen(false)} className="text-gray-600">Contacto</a>
          <a
            href="https://wa.me/573154578347?text=Hola%20Alejandro%2C%20me%20interesa%20Kalma"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-600 text-white text-center font-medium px-4 py-2 rounded-lg"
          >
            Solicitar demo
          </a>
        </div>
      )}
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            Software SaaS para estudios fitness — Colombia
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
            Gestión completa<br />
            <span className="text-indigo-600">para tu estudio.</span>
          </h1>

          <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-2xl">
            Kalma centraliza clientes, membresías, agenda y cobros en una sola plataforma.
            Diseñado para gimnasios, estudios de Pilates, Barre y centros de acondicionamiento físico.
          </p>

          <div className="flex flex-wrap gap-4 mb-16">
            <a
              href="https://wa.me/573154578347?text=Hola%20Alejandro%2C%20me%20interesa%20Kalma%20para%20mi%20estudio"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Solicitar demo <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#capturas"
              className="flex items-center gap-2 bg-white text-gray-700 font-semibold px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Ver capturas
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-8">
            {[
              { value: '2', label: 'Estudios activos' },
              { value: '100%', label: 'Web, sin instalación' },
              { value: 'Multi-sede', label: 'Varios espacios' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Hero screenshot */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 to-transparent rounded-2xl -z-10 transform scale-[1.02] blur-sm" />
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-gray-200/80 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-xs mx-auto text-center">
                app.usekalma.com/admin/dashboard
              </div>
            </div>
            <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
              <Image
                src="/screenshots/dashboard.png"
                alt="Dashboard de Kalma"
                fill
                className="object-cover object-top"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section id="funcionalidades" className="py-24 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Todo lo que tu estudio necesita
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Cada módulo fue diseñado para resolver los problemas reales del día a día en un estudio fitness.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Screenshots ──────────────────────────────────────────────────────────────

function Screenshots() {
  const [active, setActive] = useState('dashboard')
  const current = SCREENSHOTS.find((s) => s.key === active)!

  return (
    <section id="capturas" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            La plataforma en acción
          </h2>
          <p className="text-lg text-gray-500">
            Cada vista construida para ser rápida, clara y sin ruido visual.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {SCREENSHOTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active === s.key
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Screenshot display */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-100 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-sm mx-auto text-center">
              app.usekalma.com/admin/{active}
            </div>
          </div>
          <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
            <Image
              key={current.key}
              src={current.src}
              alt={`Kalma — ${current.label}`}
              fill
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── For whom ─────────────────────────────────────────────────────────────────

function ForWhom() {
  const items = [
    'Estudios de Pilates Reformer y Mat',
    'Estudios de Barre y danza fitness',
    'Gimnasios con clases personalizadas',
    'Centros de acondicionamiento físico',
    'Entrenadores con clases por sesión',
    'Estudios multi-sede o multi-espacio',
  ]

  return (
    <section className="py-24 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            ¿Para quién es Kalma?
          </h2>
          <p className="text-lg text-gray-500 mb-8 leading-relaxed">
            Si manejas clases, clientes recurrentes y quieres dejar de perder tiempo
            con hojas de cálculo o WhatsApp para llevar el control, Kalma es para ti.
          </p>
          <a
            href="https://wa.me/573154578347?text=Hola%20Alejandro%2C%20me%20interesa%20Kalma"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Conversemos <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-xl border border-gray-100 shadow-sm">
              <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-sm font-medium text-gray-700">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Social proof ─────────────────────────────────────────────────────────────

function SocialProof() {
  return (
    <section id="clientes" className="py-24 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-10">
          Confían en Kalma
        </p>
        <div className="flex flex-wrap justify-center gap-6">
          {CLIENTS.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-8 py-5 shadow-sm"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${c.color}`}>
                {c.initials}
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-500">{c.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function Contact() {
  return (
    <section id="contacto" className="py-24 px-6 bg-gray-900">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Interesado en Kalma<br />para tu estudio?
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-8">
            No hay formularios ni demos automatizadas. Hablamos directamente,
            entiendo tu negocio y adaptamos Kalma a lo que necesitas.
          </p>
          <a
            href="https://wa.me/573154578347?text=Hola%20Alejandro%2C%20me%20interesa%20Kalma%20para%20mi%20estudio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-500 transition-colors"
          >
            Escribir por WhatsApp <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 space-y-6">
          <div>
            <p className="text-white font-bold text-xl mb-0.5">Alejandro Castro</p>
            <p className="text-gray-400 text-sm">Desarrollador & fundador de Kalma</p>
          </div>

          <div className="space-y-4">
            <a
              href="tel:+573154578347"
              className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
            >
              <div className="w-9 h-9 bg-gray-700 group-hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-sm">+57 315 457 8347</span>
            </a>

            <a
              href="mailto:acpm.444@gmail.com"
              className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
            >
              <div className="w-9 h-9 bg-gray-700 group-hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors">
                <Mail className="w-4 h-4" />
              </div>
              <span className="text-sm">acpm.444@gmail.com</span>
            </a>

            <a
              href="https://github.com/alejandroocastroo/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
            >
              <div className="w-9 h-9 bg-gray-700 group-hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors">
                <Github className="w-4 h-4" />
              </div>
              <span className="text-sm">github.com/alejandroocastroo</span>
            </a>

            <a
              href="https://www.linkedin.com/in/alejandro-castro-b47654285/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
            >
              <div className="w-9 h-9 bg-gray-700 group-hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors">
                <Linkedin className="w-4 h-4" />
              </div>
              <span className="text-sm">linkedin.com/in/alejandro-castro</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 px-6 py-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">K</span>
          </div>
          <span className="text-gray-400 text-sm font-medium">Kalma</span>
        </div>
        <p className="text-gray-600 text-sm">
          © {new Date().getFullYear()} Kalma · usekalma.com · Hecho en Colombia
        </p>
        <a
          href="/login"
          className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          Acceso clientes →
        </a>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Screenshots />
        <ForWhom />
        <SocialProof />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
