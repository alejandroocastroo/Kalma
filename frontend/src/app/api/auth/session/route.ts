import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'kalma_token'
const MAX_AGE = 60 * 60 * 24 // 24h — matches access token lifetime

export async function POST(request: NextRequest) {
  const { token } = await request.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
