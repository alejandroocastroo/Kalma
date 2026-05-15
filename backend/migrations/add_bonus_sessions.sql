-- Migration: add_bonus_sessions
-- Adds bonus_sessions column to client_memberships for manual class additions.

ALTER TABLE client_memberships
    ADD COLUMN IF NOT EXISTS bonus_sessions INTEGER NOT NULL DEFAULT 0;
