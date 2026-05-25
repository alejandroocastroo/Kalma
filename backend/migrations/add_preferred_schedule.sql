ALTER TABLE client_memberships
  ADD COLUMN IF NOT EXISTS preferred_schedule JSONB;
-- Estructura: [{"day": 0, "hour": 9}, {"day": 2, "hour": 16}]
-- day: 0=lunes … 6=domingo  |  hour: 0-23
