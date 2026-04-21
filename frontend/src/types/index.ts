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
  custom_name?: string
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
  is_debt: boolean
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

export interface Plan {
  id: string
  tenant_id: string
  name: string
  description: string | null
  price_cop: number
  classes_per_week: number
  is_active: boolean
  membership_type: 'monthly' | 'session_based'
  sessions_per_week: number | null
  total_sessions: number | null
  space_id: string | null
  space_name: string | null
  created_at: string
}

export interface MembershipsListResponse {
  items: ClientMembership[]
  total: number
  page: number
  pages: number
}

export interface MakeupSessionRecord {
  id: string;
  membership_id: string;
  client_id: string;
  original_date: string; // ISO date
  makeup_date: string | null;
  class_session_id: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface ClientMembership {
  id: string;
  tenant_id: string;
  client_id: string;
  plan_id: string;
  membership_type: 'monthly' | 'session_based';
  start_date: string;
  end_date: string | null;
  status: 'active' | 'paused' | 'cancelled';
  billing_day: number | null;
  next_billing_date: string | null;
  sessions_per_week: number | null;
  total_sessions: number | null;
  sessions_used: number;
  sessions_remaining: number | null;
  scheduled_days: string[] | null; // ["monday", "tuesday"]
  expiry_date: string | null;
  makeups_allowed: number;
  makeups_used: number;
  makeup_credits: number;
  notes: string | null;
  preferred_days: number[] | null;
  preferred_hour: number | null;
  preferred_space_id: string | null;
  makeup_sessions: MakeupSessionRecord[];
  created_at: string;
  updated_at: string;
  // Legacy / joined fields kept for backward compatibility
  client_name?: string;
  plan_name?: string;
  plan_classes_per_week?: number;
  plan_price_cop?: number;
  preferred_space_name?: string;
}

export interface CobrosClient {
  client_id: string;
  client_name: string;
  plan_name: string | null;
  membership_type: 'monthly' | 'session_based' | null;
  priority: 1 | 2 | 3 | 4;
  status_label: string;
  next_billing_date: string | null;
  expiry_date: string | null;
  sessions_remaining: number | null;
  sessions_used: number | null;
  total_sessions: number | null;
  has_pending_makeup: boolean;
  membership_id: string | null;
  debt_count: number;
  appointment_ids_with_debt: string[];
}

export interface AutoBookResult {
  booked: number
  skipped: number
  sessions: string[]
}

export interface WeeklyStats {
  membership_id: string
  client_id: string
  client_name: string
  plan_name: string
  classes_per_week: number
  makeup_credits: number
  used_this_week: number
  pending_this_week: number
  total_committed_week: number
  week_start: string
  week_end: string
  classes_per_month: number
  used_this_month: number
  pending_this_month: number
  total_committed_month: number
  month_start: string
  month_end: string
}
