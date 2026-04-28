import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/', '/_next/', '/favicon.ico', '/screenshots/']
const RESERVED_SUBDOMAINS = ['www', 'api', 'app']

function getTenantSlug(host: string): string | null {
  const parts = host.split('.')
  if (parts.length >= 3 && host.includes('usekalma.com')) {
    const sub = parts[0]
    if (!RESERVED_SUBDOMAINS.includes(sub)) return sub
  }
  return null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadB64] = token.split('.')
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''
  const tenantSlug = getTenantSlug(host)

  // ── Subdomain routing ──────────────────────────────────────
  if (tenantSlug) {
    // Raíz del subdominio → la landing del tenant
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/${tenantSlug}`, request.url))
    }
    // /login en subdominio → login normal con hint del tenant
    if (pathname === '/login') {
      const res = NextResponse.next()
      res.cookies.set('kalma_tenant_hint', tenantSlug, { path: '/', sameSite: 'lax' })
      return res
    }
    // Rutas protegidas en subdominio → verificar token igual que en dominio principal
  }

  // ── Rutas públicas ─────────────────────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ── Landing pages públicas ([slug]) ────────────────────────
  if (pathname.match(/^\/[a-z0-9-]+($|\/)/)) {
    const firstSegment = pathname.split('/')[1]
    if (!['admin', 'superadmin'].includes(firstSegment)) {
      return NextResponse.next()
    }
  }

  const token = request.cookies.get('kalma_token')?.value

  // ── Proteger /admin ────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // ── Proteger /superadmin ───────────────────────────────────
  if (pathname.startsWith('/superadmin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const payload = decodeJwtPayload(token)
    if (!payload || payload.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
