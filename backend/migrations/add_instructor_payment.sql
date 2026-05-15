-- Migration: add_instructor_payment
-- Adds instructor_id FK to payments for payroll tracking.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_payments_instructor_id ON payments(instructor_id);
