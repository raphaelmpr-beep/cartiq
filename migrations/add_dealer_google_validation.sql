-- Migration: Add Google Business validation + site platform fields to dealers
-- Apply via Supabase SQL editor

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS google_place_id      TEXT,
  ADD COLUMN IF NOT EXISTS google_verified_name TEXT,
  ADD COLUMN IF NOT EXISTS google_address       TEXT,
  ADD COLUMN IF NOT EXISTS google_phone         TEXT,
  ADD COLUMN IF NOT EXISTS google_rating        NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS google_review_count  INTEGER,
  ADD COLUMN IF NOT EXISTS google_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_match_score   TEXT,
  ADD COLUMN IF NOT EXISTS site_platform        TEXT,
  ADD COLUMN IF NOT EXISTS site_platform_notes  TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate_of      TEXT;

CREATE INDEX IF NOT EXISTS idx_dealers_google_place_id ON dealers (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dealers_site_platform ON dealers (site_platform) WHERE site_platform IS NOT NULL;
