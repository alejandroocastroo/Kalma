-- Partial index: only unpaid debt appointments (keeps index tiny, fast for cobros query)
CREATE INDEX IF NOT EXISTS ix_appointments_debt_unpaid
    ON appointments (tenant_id, client_id)
    WHERE is_debt = TRUE AND paid = FALSE;

-- Composite index: covers every membership list + cobros query pattern
CREATE INDEX IF NOT EXISTS ix_client_memberships_tenant_status
    ON client_memberships (tenant_id, status);
