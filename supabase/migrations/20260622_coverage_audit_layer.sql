-- ============================================================
-- CartIQ: Coverage Audit Layer Migration
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/sql/new
-- ============================================================

-- ── Step 1: Add valuation_confidence to listings ────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS valuation_confidence TEXT DEFAULT 'low'
    CHECK (valuation_confidence IN ('low', 'medium', 'high'));

-- Set default for deal_rating on listings (already TEXT with no constraint — confirm default)
ALTER TABLE listings ALTER COLUMN deal_rating SET DEFAULT 'unknown';

-- ── Step 2: dealer_coverage_log table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS dealer_coverage_log (
  id                     BIGSERIAL PRIMARY KEY,

  -- Identity
  dealer_slug            TEXT NOT NULL,
  inventory_url          TEXT,

  -- Count metrics from last scan
  discovered_count       INTEGER DEFAULT 0,    -- total listings found on dealer site
  pending_imports_count  INTEGER DEFAULT 0,    -- how many were queued in pending_imports
  public_listings_count  INTEGER DEFAULT 0,    -- how many are live in listings table
  duplicate_count        INTEGER DEFAULT 0,    -- how many were skipped as duplicates
  skipped_count          INTEGER DEFAULT 0,    -- how many were skipped for other reasons

  -- Pagination / scroll behavior
  pagination_detected    BOOLEAN DEFAULT false,
  pages_visited          INTEGER DEFAULT 1,
  load_more_detected     BOOLEAN DEFAULT false,
  scroll_required        BOOLEAN DEFAULT false,
  detail_pages_visited   INTEGER DEFAULT 0,

  -- Source classification
  source_page_type       TEXT
    CHECK (source_page_type IN (
      'full_inventory',       -- dedicated /inventory/ page, all listings
      'model_page',           -- single model page (partial)
      'homepage_featured',    -- homepage shows a few featured only
      'category_page',        -- /used/ or /new/ category page
      'search_results',       -- search result page
      'sitemap'               -- discovered via XML sitemap (no page visit)
    )),

  -- Coverage status (single source of truth for admin view)
  coverage_status        TEXT NOT NULL DEFAULT 'needs_manual_review'
    CHECK (coverage_status IN (
      'verified_full_inventory',   -- pagination, load-more, scroll all tested
      'partial_inventory',         -- some listings found, but not confirmed complete
      'featured_only',             -- only homepage featured shown
      'pagination_incomplete',     -- pagination exists but not all pages visited
      'location_filter_needed',    -- site has multi-location — filter required
      'browser_required',          -- JS rendering required, no static parse possible
      'adapter_error',             -- last sync run encountered errors
      'needs_manual_review'        -- not yet classified
    )),

  -- Flags
  valuation_review_needed BOOLEAN DEFAULT false,  -- true if ALL listings from source = great_deal

  -- Notes and context
  adapter_notes          TEXT,

  -- Timestamps
  scanned_at             TIMESTAMPTZ DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- One log row per (dealer_slug, scanned_at) — multiple runs create new rows
CREATE INDEX IF NOT EXISTS idx_dcl_dealer_slug ON dealer_coverage_log(dealer_slug);
CREATE INDEX IF NOT EXISTS idx_dcl_scanned_at  ON dealer_coverage_log(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_dcl_status      ON dealer_coverage_log(coverage_status);

-- RLS (open for anon — admin token checked at API layer)
ALTER TABLE dealer_coverage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_coverage_log" ON dealer_coverage_log FOR ALL USING (true);

-- ── Step 3: Fix Discovery Wave 1 listings (IDs 193-197) ─────────────────────
-- Reset to unknown/low — comps not yet verified
UPDATE listings
SET
  deal_rating           = 'unknown',
  buyer_score           = NULL,
  valuation_confidence  = 'low'
WHERE id IN (193, 194, 195, 196, 197);

-- ── Step 4: Verify ──────────────────────────────────────────────────────────

-- 4a. Confirm valuation_confidence column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'listings'
  AND column_name = 'valuation_confidence';

-- 4b. Confirm dealer_coverage_log table was created
SELECT COUNT(*) AS coverage_log_rows FROM dealer_coverage_log;

-- 4c. Confirm Discovery Wave 1 reset
SELECT id, deal_rating, valuation_confidence, buyer_score
FROM listings
WHERE id IN (193, 194, 195, 196, 197)
ORDER BY id;
