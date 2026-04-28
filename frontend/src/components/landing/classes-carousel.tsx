'use client'

interface Clase {
  nombre: string
  descripcion: string
  musculos: string[]
}

interface Props {
  clases: Clase[]
}

export function ClassesCarousel({ clases }: Props) {
  // Duplicamos para el loop infinito del marquee
  const items = [...clases, ...clases]

  return (
    <div className="relative overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, white, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, white, transparent)' }} />

      {/* Track */}
      <div className="marquee-track flex gap-5 w-max py-6">
        {items.map((c, i) => (
          <div
            key={`${c.nombre}-${i}`}
            className="flex-shrink-0 flex flex-col bg-white p-7 cursor-default"
            style={{
              width: '280px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
              transition: 'box-shadow 0.3s ease, transform 0.3s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.boxShadow = '0 12px 40px rgba(0,0,0,0.13)'
              el.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.boxShadow = '0 2px 16px rgba(0,0,0,0.06)'
              el.style.transform = 'translateY(0)'
            }}
          >
            <div className="w-6 h-px bg-stone-300 mb-5" />
            <h3 className="font-medium text-stone-900 text-sm tracking-wide mb-3 leading-snug">
              {c.nombre}
            </h3>
            <p className="text-stone-500 text-sm font-light leading-relaxed mb-5 flex-1">
              {c.descripcion}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {c.musculos.map((m) => (
                <span
                  key={m}
                  className="text-xs text-stone-400 border border-stone-200 px-2 py-0.5"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
