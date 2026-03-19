'use client'

import type { TokenResponse, User } from '@/types'

const TOKEN_KEY = 'kalma_access_token'
const REFRESH_KEY = 'kalma_refresh_token'
const USER_KEY = 'kalma_user'
const TENANT_KEY = 'kalma_tenant_slug'

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

export const saveAuthData = (data: TokenResponse) => {
  setToken(data.access_token)
  setRefreshToken(data.refresh_token)
  if (data.tenant_slug) setTenantSlug(data.tenant_slug)
  setStoredUser({
    id: data.user_id,
    email: data.user_email,
    full_name: data.user_name,
    role: data.user_role as User['role'],
    tenant_id: data.tenant_id,
  })
  // Cookie para que el middleware de Next.js pueda verificar auth en SSR
  document.cookie = `kalma_token=${data.access_token}; path=/; max-age=${60 * 60 * 24}`
}

export const clearAuthCookie = () => {
  document.cookie = 'kalma_token=; path=/; max-age=0'
}

export const logout = () => {
  removeToken()
  removeRefreshToken()
  removeTenantSlug()
  removeStoredUser()
  clearAuthCookie()
  window.location.href = '/login'
}
