-- Hybrid membership support: multi-space plans with per-space quotas and usage tracking
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS space_quotas JSONB;

ALTER TABLE client_memberships
  ADD COLUMN IF NOT EXISTS space_quotas JSONB,
  ADD COLUMN IF NOT EXISTS space_usage JSONB;

-- Track which space a makeup session belongs to (for hybrid plans)
ALTER TABLE makeup_sessions
  ADD COLUMN IF NOT EXISTS space_id UUID
    REFERENCES spaces(id) ON DELETE SET NULL;
