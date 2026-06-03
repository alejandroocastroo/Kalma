ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS custom_categories JSONB;
