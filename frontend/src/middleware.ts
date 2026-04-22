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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
