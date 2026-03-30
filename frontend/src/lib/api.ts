import axios from 'axios'
import { getToken, getTenantSlug, logout, setToken, setRefreshToken, getRefreshToken } from './auth'
import type {
  LoginRequest, TokenResponse, ClassType, ClassSession, Client,
  Appointment, Payment, CashFlowSummary, PaginatedResponse, TenantPublic, PublicSession,
  Space, SlotAvailability, RevenueReport, OccupancyReport,
  Plan, ClientMembership, WeeklyStats
} from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor
apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const slug = getTenantSlug()
  if (slug) config.headers['X-Tenant-Slug'] = slug
  return config
})

// Response interceptor - handle 401 with refresh
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`
            return apiClient(original)
          })
          .catch((e) => Promise.reject(e))
      }
      original._retry = true
      isRefreshing = true
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        logout()
        return Promise.reject(error)
      }
      try {
        const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        })
        setToken(data.access_token)
        setRefreshToken(data.refresh_token)
        failedQueue.forEach((p) => p.resolve(data.access_token))
        failedQueue = []
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
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

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data),
  refresh: (refresh_token: string) =>
    apiClient.post<TokenResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),
}

// ── Class Types ───────────────────────────────────────────────
export const classTypes = {
  list: () => apiClient.get<ClassType[]>('/class-types').then((r) => r.data),
  create: (data: Partial<ClassType>) =>
    apiClient.post<ClassType>('/class-types', data).then((r) => r.data),
  update: (id: string, data: Partial<ClassType>) =>
    apiClient.put<ClassType>(`/class-types/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/class-types/${id}`).then((r) => r.data),
}

// ── Class Sessions ────────────────────────────────────────────
export const classSessions = {
  list: (params?: { start?: string; end?: string }) =>
    apiClient.get<ClassSession[]>('/class-sessions', { params }).then((r) => r.data),
  week: () => apiClient.get<ClassSession[]>('/class-sessions/week').then((r) => r.data),
  create: (data: Partial<ClassSession>) =>
    apiClient.post<ClassSession>('/class-sessions', data).then((r) => r.data),
  update: (id: string, data: Partial<ClassSession>) =>
    apiClient.put<ClassSession>(`/class-sessions/${id}`, data).then((r) => r.data),
  cancel: (id: string) =>
    apiClient.post(`/class-sessions/${id}/cancel`).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete(`/class-sessions/${id}`).then((r) => r.data),
}

// ── Clients ───────────────────────────────────────────────────
export const clients = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Client>>('/clients', { params }).then((r) => r.data),
  get: (id: string) => apiClient.get<Client>(`/clients/${id}`).then((r) => r.data),
  create: (data: Partial<Client>) =>
    apiClient.post<Client>('/clients', data).then((r) => r.data),
  update: (id: string, data: Partial<Client>) =>
    apiClient.put<Client>(`/clients/${id}`, data).then((r) => r.data),
  appointments: (id: string) =>
    apiClient.get(`/clients/${id}/appointments`).then((r) => r.data),
}

// ── Appointments ──────────────────────────────────────────────
export const appointments = {
  list: (params?: { session_id?: string; date?: string }) =>
    apiClient.get<Appointment[]>('/appointments', { params }).then((r) => r.data),
  create: (data: Partial<Appointment>) =>
    apiClient.post<Appointment>('/appointments', data).then((r) => r.data),
  update: (id: string, data: Partial<Appointment>) =>
    apiClient.put<Appointment>(`/appointments/${id}`, data).then((r) => r.data),
  attend: (id: string) =>
    apiClient.post(`/appointments/${id}/attend`).then((r) => r.data),
  cancel: (id: string) =>
    apiClient.post(`/appointments/${id}/cancel`).then((r) => r.data),
  remove: (id: string) =>
    apiClient.delete(`/appointments/${id}`).then((r) => r.data),
  confirmWhatsapp: (id: string) =>
    apiClient.post(`/appointments/${id}/confirm-whatsapp`).then((r) => r.data),
}

// ── Payments ──────────────────────────────────────────────────
export const payments = {
  list: (params?: { start?: string; end?: string; type?: string; space_id?: string }) =>
    apiClient.get<Payment[]>('/payments', { params }).then((r) => r.data),
  create: (data: Partial<Payment>) =>
    apiClient.post<Payment>('/payments', data).then((r) => r.data),
  update: (id: string, data: Partial<Payment>) =>
    apiClient.put<Payment>(`/payments/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/payments/${id}`).then((r) => r.data),
  summary: (params?: { start?: string; end?: string; space_id?: string }) =>
    apiClient.get<CashFlowSummary>('/payments/summary', { params }).then((r) => r.data),
}

// ── Spaces ────────────────────────────────────────────────────
export const spaces = {
  list: () => apiClient.get<Space[]>('/spaces').then((r) => r.data),
  create: (data: Partial<Space>) =>
    apiClient.post<Space>('/spaces', data).then((r) => r.data),
  update: (id: string, data: Partial<Space>) =>
    apiClient.put<Space>(`/spaces/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/spaces/${id}`).then((r) => r.data),
  availability: (id: string, date: string) =>
    apiClient.get<SlotAvailability[]>(`/spaces/${id}/availability`, { params: { date } }).then((r) => r.data),
}

// ── Reports ───────────────────────────────────────────────────
export const reports = {
  revenue: (params?: { space_id?: string; from?: string; to?: string }) =>
    apiClient.get<RevenueReport[]>('/reports/revenue', { params }).then((r) => r.data),
  occupancy: (params?: { space_id?: string; from?: string; to?: string }) =>
    apiClient.get<OccupancyReport[]>('/reports/occupancy', { params }).then((r) => r.data),
}

// ── Schedule ──────────────────────────────────────────────────
export const schedule = {
  get: () => apiClient.get('/schedule').then((r) => r.data),
  updateDay: (
    dayOfWeek: number,
    data: { is_active: boolean; open_hour: number; close_hour: number }
  ) => apiClient.put(`/schedule/${dayOfWeek}`, data).then((r) => r.data),
  exceptions: (params?: { from?: string; to?: string }) =>
    apiClient.get('/schedule/exceptions', { params }).then((r) => r.data),
  addException: (data: { date: string; reason?: string; is_closed: boolean }) =>
    apiClient.post('/schedule/exceptions', data).then((r) => r.data),
  removeException: (id: string) =>
    apiClient.delete(`/schedule/exceptions/${id}`).then((r) => r.data),
  generate: (data: {
    from_date: string
    to_date: string
    class_type_id?: string
    space_id: string
    skip_existing: boolean
  }) => apiClient.post('/schedule/generate', data).then((r) => r.data),
}

// ── Plans ─────────────────────────────────────────────────────
export const plans = {
  list: () => apiClient.get<Plan[]>('/plans').then(r => r.data),
  create: (data: Partial<Plan>) => apiClient.post<Plan>('/plans', data).then(r => r.data),
  update: (id: string, data: Partial<Plan>) => apiClient.put<Plan>(`/plans/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/plans/${id}`).then(r => r.data),
}

// ── Memberships ───────────────────────────────────────────────
export const memberships = {
  list: (params?: { client_id?: string; status?: string }) =>
    apiClient.get<ClientMembership[]>('/memberships', { params }).then(r => r.data),
  create: (data: { client_id: string; plan_id: string; start_date: string; end_date?: string; notes?: string }) =>
    apiClient.post<ClientMembership>('/memberships', data).then(r => r.data),
  update: (id: string, data: Partial<ClientMembership>) =>
    apiClient.put<ClientMembership>(`/memberships/${id}`, data).then(r => r.data),
  autoDeduct: () => apiClient.post<{ updated: number }>('/memberships/auto-deduct').then(r => r.data),
  addMakeup: (id: string, credits: number) =>
    apiClient.post<ClientMembership>(`/memberships/${id}/add-makeup`, { credits }).then(r => r.data),
  weeklyStats: (id: string) =>
    apiClient.get<WeeklyStats>(`/memberships/${id}/weekly-stats`).then(r => r.data),
}

// ── Public (no auth) ──────────────────────────────────────────
const publicApi = axios.create({ baseURL: `${API_URL}/api/v1` })

export const publicRoutes = {
  studioInfo: (slug: string) =>
    publicApi.get<TenantPublic>(`/public/${slug}/info`).then((r) => r.data),
  schedule: (slug: string, params?: { start?: string; end?: string }) =>
    publicApi.get<PublicSession[]>(`/public/${slug}/schedule`, { params }).then((r) => r.data),
  book: (slug: string, data: { class_session_id: string; full_name: string; phone: string; email?: string }) =>
    publicApi.post(`/public/${slug}/book`, data).then((r) => r.data),
}
