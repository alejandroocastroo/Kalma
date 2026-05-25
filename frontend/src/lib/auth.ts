'use client'

import type { TokenResponse, User } from '@/types'

const TOKEN_KEY = 'kalma_access_token'
const REFRESH_KEY = 'kalma_refresh_token'
const USER_KEY = 'kalma_user'
const TENANT_KEY = 'kalma_tenant_slug'
const CURRENCY_KEY = 'kalma_tenant_currency'

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const removeToken = () => localStorage.removeItem(TOKEN_KEY)

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

export const setRefreshToken = (token: string) => localStorage.setItem(REFRESH_KEY, token)
export const removeRefreshToken = () => localStorage.removeItem(REFRESH_KEY)

export const getTenantSlug = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TENANT_KEY)
}

export const setTenantSlug = (slug: string) => localStorage.setItem(TENANT_KEY, slug)
export const removeTenantSlug = () => localStorage.removeItem(TENANT_KEY)

export const getTenantCurrency = (): string => {
  if (typeof window === 'undefined') return 'COP'
  return localStorage.getItem(CURRENCY_KEY) || 'COP'
}

export const setTenantCurrency = (currency: string) => localStorage.setItem(CURRENCY_KEY, currency)
export const removeTenantCurrency = () => localStorage.removeItem(CURRENCY_KEY)

export const getStoredUser = (): Partial<User> | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export const setStoredUser = (user: Partial<User>) =>
  localStorage.setItem(USER_KEY, JSON.stringify(user))

export const removeStoredUser = () => localStorage.removeItem(USER_KEY)

export const isAuthenticated = (): boolean => !!getToken()

// Sets an HttpOnly cookie via a Next.js API route (inaccessible to JS/XSS)
const setSessionCookie = async (token: string) => {
  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  } catch {
    // Non-blocking — localStorage is still used by apiClient
  }
}

const clearSessionCookie = async () => {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' })
  } catch {
    // Non-blocking
  }
}

export const saveAuthData = async (data: TokenResponse) => {
  setToken(data.access_token)
  setRefreshToken(data.refresh_token)
  if (data.tenant_slug) setTenantSlug(data.tenant_slug)
  if (data.tenant_currency) setTenantCurrency(data.tenant_currency)
  setStoredUser({
    id: data.user_id,
    email: data.user_email,
    full_name: data.user_name,
    role: data.user_role as User['role'],
    tenant_id: data.tenant_id,
  })
  // Await so the HttpOnly cookie exists before the middleware checks it on navigation
  await setSessionCookie(data.access_token)
}

export const logout = () => {
  const refreshToken = getRefreshToken()

  // Revoke refresh token server-side (fire-and-forget)
  if (refreshToken) {
    fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {})
  }

  removeToken()
  removeRefreshToken()
  removeTenantSlug()
  removeTenantCurrency()
  removeStoredUser()
  clearSessionCookie()
  window.location.href = '/login'
}
