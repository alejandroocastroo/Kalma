'use client'

import { useRef, useEffect } from 'react'

interface Clase {
  nombre: string
  descripcion: string
  musculos: string[]
}

interface Props {
  clases: Clase[]
}

const SPEED = 0.6 // px por frame

export function ClassesCarousel({ clases }: Props) {
  const items = [...clases, ...clases] // duplicado para loop infinito

  const trackRef  = useRef<HTMLDivElement>(null)
  const posRef    = useRef(0)
  const rafRef    = useRef<number>(0)
  const dragging  = useRef(false)
  const lastX     = useRef(0)
  const velocity  = useRef(0)

  // ── Auto-scroll loop ────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const track = trackRef.current
      if (track && !dragging.current) {
        const half = track.scrollWidth / 2
        posRef.current += SPEED
        if (posRef.current >= half) posRef.current -= half
        track.style.transform = `translateX(${-posRef.current}px)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Helpers compartidos mouse / touch ───────────────────────
  const onDragStart = (x: number) => {
    dragging.current = true
    lastX.current = x
    velocity.current = 0
  }

  const onDragMove = (x: number) => {
    if (!dragging.current) return
    const track = trackRef.current
    if (!track) return
    const delta = lastX.current - x
    velocity.current = delta
    const half = track.scrollWidth / 2
    posRef.current = ((posRef.current + delta) % half + half) % half
    track.style.transform = `translateX(${-posRef.current}px)`
    lastX.current = x
  }

  const onDragEnd = () => {
    dragging.current = false
  }

  // ── Mouse events ────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => onDragStart(e.clientX)
  const onMouseMove = (e: React.MouseEvent) => { if (dragging.current) onDragMove(e.clientX) }
  const onMouseUp   = () => onDragEnd()

  // ── Touch events ────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => onDragStart(e.touches[0].clientX)
  const onTouchMove  = (e: React.TouchEvent) => onDragMove(e.touches[0].clientX)
  const onTouchEnd   = () => onDragEnd()

  return (
    <div
      className="relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Fades laterales */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, white, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, white, transparent)' }} />

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-5 w-max py-6"
        style={{ willChange: 'transform' }}
      >
        {items.map((c, i) => (
          <div
            key={`${c.nombre}-${i}`}
            className="flex-shrink-0 flex flex-col bg-white p-7 pointer-events-none"
            style={{
              width: '280px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
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
                <span key={m} className="text-xs text-stone-400 border border-stone-200 px-2 py-0.5">
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
