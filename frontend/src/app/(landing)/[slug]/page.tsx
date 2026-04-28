/**
 * Fallback para estudios sin página propia.
 * Si el tenant existe en la BD → redirige al login.
 * Si no existe → 404.
 *
 * Estudios con página propia (ej. mantra) tienen su propia carpeta
 * y Next.js los resuelve antes de llegar aquí.
 */
import { notFound, redirect } from 'next/navigation'

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function studioExists(slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}/info`, {
      next: { revalidate: 60 },
    })
    return res.ok
  } catch {
    return false
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export default async function StudioFallback({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Descartar inmediatamente slugs inválidos sin tocar la API
  if (
    slug.includes('.')   ||   // favicon.ico, favicon.png, etc.
    UUID_RE.test(slug)   ||   // UUIDs de bots
    slug.length < 2      ||   // slugs de 1 carácter
    !SLUG_RE.test(slug)        // cualquier cosa que no sea un slug válido
  ) {
    notFound()
  }

  const exists = await studioExists(slug)
  if (!exists) notFound()

  redirect('/login')
}
