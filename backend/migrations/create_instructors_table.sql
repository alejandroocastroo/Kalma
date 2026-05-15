-- Create standalone instructors table (not tied to users)
CREATE TABLE IF NOT EXISTS instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_instructors_tenant_id ON instructors(tenant_id);

-- Migrate existing instructor User records into the new table, preserving UUIDs
-- so all existing class_sessions.instructor_id references remain valid.
INSERT INTO instructors (id, tenant_id, full_name, email, phone, is_active, created_at)
SELECT id, tenant_id, full_name, email, phone, is_active, created_at
FROM users
WHERE role = 'instructor'
  AND tenant_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Re-point class_sessions.instructor_id FK from users → instructors
ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_instructor_id_fkey;
ALTER TABLE class_sessions
    ADD CONSTRAINT class_sessions_instructor_id_fkey
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;

-- Ensure payments.instructor_id column exists (idempotent)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS instructor_id UUID;

-- Re-point payments.instructor_id FK from users → instructors
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_instructor_id_fkey;
ALTER TABLE payments
    ADD CONSTRAINT payments_instructor_id_fkey
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_payments_instructor_id ON payments(instructor_id);
