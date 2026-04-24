import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/api/', '/_next/', '/favicon.ico', '/screenshots/']

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadB64] = token.split('.')
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
  } catch {
    return null
  }
}

const RESERVED_SUBDOMAINS = ['www', 'api', 'app']

function getTenantSlugFromHost(host: string): string | null {
  const parts = host.split('.')
  if (parts.length >= 3 && host.includes('usekalma.com')) {
    const sub = parts[0]
    if (!RESERVED_SUBDOMAINS.includes(sub)) return sub
  }
  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''
  const tenantSlug = getTenantSlugFromHost(host)

  // Subdomain rewrite: mantra.usekalma.com → /mantra
  if (tenantSlug) {
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/${tenantSlug}`, request.url))
    }
    // /login on subdomain → pass slug as cookie so login page can use it
    if (pathname === '/login') {
      const res = NextResponse.next()
      res.cookies.set('kalma_tenant_hint', tenantSlug, { path: '/', sameSite: 'lax' })
      return res
    }
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Landing pages are public
  if (pathname.match(/^\/[a-z0-9-]+($|\/)/)) {
    const firstSegment = pathname.split('/')[1]
    if (!['admin', 'login', 'superadmin'].includes(firstSegment)) {
      return NextResponse.next()
    }
  }

  const token = request.cookies.get('kalma_token')?.value

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protect /superadmin routes — require role claim
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
