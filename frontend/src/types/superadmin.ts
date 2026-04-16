export interface SuperadminTenant {
  id: string
  name: string
  slug: string
  plan: string
  is_active: boolean
  email?: string
  phone?: string
  city: string
  created_at: string
}

export interface CreateTenantPayload {
  tenant_name: string
  tenant_slug: string
  plan: string
  admin_full_name: string
  admin_email: string
  admin_password: string
}

export interface TenantStats {
  tenant_id: string
  total_users: number
  total_clients: number
  total_sessions: number
}
