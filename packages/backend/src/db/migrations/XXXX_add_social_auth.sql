-- Migration: Add google_id and apple_id columns for social login
-- Run: psql $DATABASE_URL -f src/db/migrations/XXXX_add_social_auth.sql

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS apple_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_merchants_google_id ON merchants (google_id);
CREATE INDEX IF NOT EXISTS idx_merchants_apple_id ON merchants (apple_id);

COMMENT ON COLUMN merchants.google_id IS 'Google OAuth user ID (sub from Google token)';
COMMENT ON COLUMN merchants.apple_id IS 'Apple Sign In user ID (sub from Apple identity token)';
