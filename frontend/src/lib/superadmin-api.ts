/**
 * Cliente axios dedicado para el superadmin.
 * NO envía X-Tenant-Slug — el superadmin no tiene tenant.
 */
import axios from 'axios'
import { getToken, setToken, setRefreshToken, getRefreshToken, logout } from './auth'
import type { SuperadminTenant, CreateTenantPayload, TenantStats } from '@/types/superadmin'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => { original.headers.Authorization = `Bearer ${token}`; return client(original) })
          .catch((e) => Promise.reject(e))
      }
      original._retry = true
      isRefreshing = true
      const refreshToken = getRefreshToken()
      if (!refreshToken) { logout(); return Promise.reject(error) }
      try {
        const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken })
        setToken(data.access_token)
        setRefreshToken(data.refresh_token)
        failedQueue.forEach((p) => p.resolve(data.access_token))
        failedQueue = []
        original.headers.Authorization = `Bearer ${data.access_token}`
        return client(original)
      } catch (e) {
        failedQueue.forEach((p) => p.reject(e))
        failedQueue = []
        logout()
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export const superadminApi = {
  tenants: {
    list: () =>
      client.get<SuperadminTenant[]>('/superadmin/tenants').then((r) => r.data),
    create: (data: CreateTenantPayload) =>
      client.post('/superadmin/tenants', data).then((r) => r.data),
    toggle: (id: string) =>
      client.patch<SuperadminTenant>(`/superadmin/tenants/${id}/toggle`).then((r) => r.data),
    stats: (id: string) =>
      client.get<TenantStats>(`/superadmin/tenants/${id}/stats`).then((r) => r.data),
  },
}
