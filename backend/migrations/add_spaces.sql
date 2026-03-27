-- Migration: add_spaces
-- Creates the spaces table and adds space_id FK to class_sessions.
-- Seeds two spaces for the Mantra Pilates Studio tenant.

BEGIN;

-- 1. Create spaces table
CREATE TABLE IF NOT EXISTS spaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    capacity    INTEGER NOT NULL,
    price       NUMERIC(12, 2) NOT NULL,
    currency    VARCHAR(3) NOT NULL DEFAULT 'COP',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_spaces_tenant_id ON spaces(tenant_id);

-- 2. Add space_id FK to class_sessions (nullable, so existing rows are unaffected)
ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_class_sessions_space_id ON class_sessions(space_id);

-- 3. Seed spaces for Mantra Pilates Studio
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'mantra' LIMIT 1;
    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'Tenant mantra not found — skipping spaces seed';
        RETURN;
    END IF;
    INSERT INTO spaces (id, tenant_id, name, description, capacity, price, currency, is_active)
    VALUES
        (gen_random_uuid(), v_tenant_id, 'Pilates', 'Sala de Pilates', 3, 120000.00, 'COP', TRUE),
        (gen_random_uuid(), v_tenant_id, 'Barre',   'Sala de Barre',   5, 150000.00, 'COP', TRUE)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Spaces seeded for tenant %', v_tenant_id;
END $$;

COMMIT;
