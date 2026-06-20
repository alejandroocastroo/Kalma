-- Migration: add_client_address
-- Adds an optional address (dirección) field to clients.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS address VARCHAR(500);
