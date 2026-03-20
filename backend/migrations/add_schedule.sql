-- Migration: add_schedule
-- Creates studio_schedule and schedule_exceptions tables.
-- Seeds the default weekly schedule for the mantra tenant (Mon-Sat active, Sunday closed).

BEGIN;

-- 1. studio_schedule table
CREATE TABLE IF NOT EXISTS studio_schedule (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    open_hour   SMALLINT NOT NULL DEFAULT 6  CHECK (open_hour  BETWEEN 0 AND 23),
    close_hour  SMALLINT NOT NULL DEFAULT 21 CHECK (close_hour BETWEEN 1 AND 24),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_studio_schedule_tenant_id
    ON studio_schedule(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_schedule_tenant_day
    ON studio_schedule(tenant_id, day_of_week);

-- 2. schedule_exceptions table
CREATE TABLE IF NOT EXISTS schedule_exceptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    reason      VARCHAR(200),
    is_closed   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_schedule_exceptions_tenant_id
    ON schedule_exceptions(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_exceptions_tenant_date
    ON schedule_exceptions(tenant_id, date);

-- 3. Seed default schedule for the mantra tenant
--    Mon (0) through Sat (5) active 06:00–21:00; Sun (6) closed.
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'mantra' LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'Tenant mantra not found — skipping schedule seed';
        RETURN;
    END IF;

    INSERT INTO studio_schedule (tenant_id, day_of_week, is_active, open_hour, close_hour)
    VALUES
        (v_tenant_id, 0, TRUE,  6, 21),   -- Lunes
        (v_tenant_id, 1, TRUE,  6, 21),   -- Martes
        (v_tenant_id, 2, TRUE,  6, 21),   -- Miércoles
        (v_tenant_id, 3, TRUE,  6, 21),   -- Jueves
        (v_tenant_id, 4, TRUE,  6, 21),   -- Viernes
        (v_tenant_id, 5, TRUE,  6, 21),   -- Sábado
        (v_tenant_id, 6, FALSE, 6, 21)    -- Domingo (closed)
    ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

    RAISE NOTICE 'Schedule seeded for tenant %', v_tenant_id;
END $$;

COMMIT;
