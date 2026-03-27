export type UserRole = 'superadmin' | 'admin' | 'staff' | 'instructor' | 'client'

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  role: UserRole
  is_active: boolean
  tenant_id?: string
  created_at: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  phone?: string
  email?: string
  address?: string
  city: string
  description?: string
  logo_url?: string
  cover_url?: string
  instagram_url?: string
  whatsapp_number?: string
  plan: string
  is_active: boolean
  created_at: string
}

export interface TenantPublic extends Omit<Tenant, 'plan' | 'is_active' | 'created_at'> {
  class_types: ClassType[]
}

export interface ClassType {
  id: string
  tenant_id: string
  name: string
  description?: string
  duration_minutes: number
  capacity: number
  price: number
  color: string
  is_active: boolean
  created_at: string
}

export type ClassSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export interface ClassSession {
  id: string
  tenant_id: string
  class_type_id: string
  instructor_id?: string
  start_datetime: string
  end_datetime: string
  capacity: number
  enrolled_count: number
  status: ClassSessionStatus
  notes?: string
  class_type_name?: string
  class_type_color?: string
  instructor_name?: string
  space_name?: string
  created_at: string
}

export interface Client {
  id: string
  tenant_id: string
  full_name: string
  email?: string
  phone?: string
  document_type: string
  document_number?: string
  birth_date?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  notes?: string
  total_sessions: number
  is_active: boolean
  created_at: string
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'attended' | 'no_show'

export interface Appointment {
  id: string
  tenant_id: string
  class_session_id: string
  client_id: string
  status: AppointmentStatus
  paid: boolean
  payment_amount?: number
  payment_method?: string
  whatsapp_confirmation_sent: boolean
  whatsapp_reminder_sent: boolean
  notes?: string
  client_name?: string
  client_phone?: string
  session_start?: string
  class_type_name?: string
  created_at: string
}

export type PaymentType = 'income' | 'expense'

export interface Payment {
  id: string
  tenant_id: string
  client_id?: string
  appointment_id?: string
  space_id?: string
  space_name?: string
  amount: number
  type: PaymentType
  category: string
  payment_method: string
  description?: string
  payment_date: string
  client_name?: string
  created_at: string
}

export interface SpaceSummary {
  income: number
  expenses: number
  net: number
}

export interface CashFlowSummary {
  total_income: number
  total_expenses: number
  net: number
  by_category: Record<string, number>
  by_method: Record<string, number>
  by_space: Record<string, SpaceSummary>
  income_count: number
  expense_count: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user_id: string
  user_email: string
  user_name: string
  user_role: string
  tenant_id?: string
  tenant_slug?: string
}

export interface LoginRequest {
  email: string
  password: string
  tenant_slug?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface PublicSession {
  id: string
  start_datetime: string
  end_datetime: string
  capacity: number
  available_spots: number
  enrolled_count: number
  class_type: {
    id: string
    name: string
    duration_minutes: number
    price: number
    color: string
  }
}

export interface Space {
  id: string
  tenant_id: string
  name: string
  description?: string
  capacity: number
  price: number
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SlotAvailability {
  hour: number
  booked: number
  available: number
  is_full: boolean
}

export interface RevenueReport {
  space_id: string
  space_name: string
  total_revenue: number
  session_count: number
  paid_appointments: number
}

export interface OccupancyReport {
  space_id: string
  space_name: string
  total_sessions: number
  avg_fill_rate: number
  fully_booked_count: number
}

export interface ScheduleDay {
  id?: string
  day_of_week: number
  day_name: string
  is_active: boolean
  open_hour: number
  close_hour: number
}

export interface ScheduleException {
  id: string
  date: string
  reason?: string
  is_closed: boolean
  created_at: string
}

export interface GenerateSessionsResult {
  created: number
  skipped: number
  dates_processed: number
}
