-- CartIQ Verification Pipeline — Schema Migration
-- Run in Supabase SQL Editor

-- 1. Add verification columns to listings table
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS source_listing_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_confidence TEXT DEFAULT 'estimated'
    CHECK (price_confidence IN ('confirmed', 'estimated', 'stale', 'unavailable')),
  ADD COLUMN IF NOT EXISTS price_scraped INTEGER,
  ADD COLUMN IF NOT EXISTS image_urls_json TEXT DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sync_source TEXT;  -- 'botero', 'jax', 'discovery', 'manual'

-- 2. Inventory sync log table — tracks every sync run per listing
CREATE TABLE IF NOT EXISTS sync_log (
  id            BIGSERIAL PRIMARY KEY,
  listing_id    INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  dealer_slug   TEXT NOT NULL,         -- 'botero', 'jax', 'discovery'
  source_url    TEXT NOT NULL,
  price_found   INTEGER,               -- price seen on site (cents or dollars)
  price_changed BOOLEAN DEFAULT FALSE,
  image_count   INTEGER DEFAULT 0,
  status        TEXT NOT NULL          -- 'ok', 'price_mismatch', 'not_found', 'error'
    CHECK (status IN ('ok', 'price_mismatch', 'not_found', 'error')),
  notes         TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pending imports table — new listings found on dealer sites not yet in CartIQ
CREATE TABLE IF NOT EXISTS pending_imports (
  id              BIGSERIAL PRIMARY KEY,
  dealer_slug     TEXT NOT NULL,
  source_url      TEXT NOT NULL UNIQUE,
  raw_title       TEXT,
  year            INTEGER,
  make            TEXT,
  model           TEXT,
  condition       TEXT,
  price           INTEGER,
  image_url       TEXT,
  image_urls_json TEXT DEFAULT '[]',
  location_city   TEXT,
  location_state  TEXT,
  specs_json      TEXT DEFAULT '{}',
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'imported', 'rejected', 'duplicate')),
  found_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  imported_listing_id INTEGER REFERENCES listings(id)
);

-- 4. RLS policies for new tables
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_sync_log" ON sync_log FOR ALL USING (true);
CREATE POLICY "admin_pending_imports" ON pending_imports FOR ALL USING (true);

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sync_log_listing_id ON sync_log(listing_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_synced_at ON sync_log(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_imports_status ON pending_imports(status);
CREATE INDEX IF NOT EXISTS idx_pending_imports_dealer ON pending_imports(dealer_slug);
