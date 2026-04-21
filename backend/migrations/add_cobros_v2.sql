-- Cobros v2: membresías tipadas + makeup sessions

-- 1. Extend client_memberships
ALTER TABLE client_memberships
  ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS billing_day SMALLINT,
  ADD COLUMN IF NOT EXISTS next_billing_date DATE,
  ADD COLUMN IF NOT EXISTS sessions_per_week SMALLINT,
  ADD COLUMN IF NOT EXISTS total_sessions SMALLINT,
  ADD COLUMN IF NOT EXISTS sessions_used SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_days JSONB,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS makeups_allowed SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS makeups_used SMALLINT NOT NULL DEFAULT 0;

-- 2. Update plan with membership_type support
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS sessions_per_week SMALLINT,
  ADD COLUMN IF NOT EXISTS total_sessions SMALLINT;

-- 3. Create makeup_sessions table
CREATE TABLE IF NOT EXISTS makeup_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    membership_id UUID NOT NULL REFERENCES client_memberships(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    original_date DATE NOT NULL,
    makeup_date DATE,
    class_session_id UUID REFERENCES class_sessions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_makeup_sessions_tenant_id ON makeup_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS ix_makeup_sessions_membership_id ON makeup_sessions(membership_id);
CREATE INDEX IF NOT EXISTS ix_makeup_sessions_client_id ON makeup_sessions(client_id);
