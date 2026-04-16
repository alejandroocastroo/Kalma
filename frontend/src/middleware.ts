import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/', '/_next/', '/favicon.ico']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Landing pages are public
  if (pathname.match(/^\/[a-z0-9-]+($|\/)/)) {
    const firstSegment = pathname.split('/')[1]
    if (!['admin', 'login'].includes(firstSegment)) {
      return NextResponse.next()
    }
  }

  // Protect /admin and /superadmin routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/superadmin')) {
    const token = request.cookies.get('kalma_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
