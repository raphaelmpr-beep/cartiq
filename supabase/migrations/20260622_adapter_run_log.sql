-- ============================================================
-- CartIQ: adapter_run_log table
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS adapter_run_log (
  id                           BIGSERIAL PRIMARY KEY,
  dealer_slug                  TEXT NOT NULL,
  inventory_url                TEXT,
  mode                         TEXT NOT NULL
    CHECK (mode IN ('discover', 'verify_existing', 'full_sync')),

  -- Discovery counts
  discovered_count             INTEGER DEFAULT 0,
  inserted_pending_count       INTEGER DEFAULT 0,
  duplicate_count              INTEGER DEFAULT 0,
  skipped_count                INTEGER DEFAULT 0,

  -- Before/after snapshots
  public_listing_count_before  INTEGER DEFAULT 0,
  public_listing_count_after   INTEGER DEFAULT 0,
  pending_import_count_before  INTEGER DEFAULT 0,
  pending_import_count_after   INTEGER DEFAULT 0,

  -- Pagination/scroll behavior
  pagination_detected          BOOLEAN DEFAULT FALSE,
  pages_visited                INTEGER DEFAULT 0,
  load_more_detected           BOOLEAN DEFAULT FALSE,
  scroll_required              BOOLEAN DEFAULT FALSE,
  detail_pages_visited         INTEGER DEFAULT 0,

  -- Source classification
  source_page_type             TEXT DEFAULT 'unknown'
    CHECK (source_page_type IN (
      'full_inventory', 'homepage_featured', 'model_page',
      'category_page', 'location_filtered', 'search_results', 'sitemap', 'unknown'
    )),

  -- Run outcome
  coverage_status              TEXT DEFAULT 'needs_manual_review'
    CHECK (coverage_status IN (
      'not_synced', 'verified_full_inventory', 'partial_inventory',
      'featured_only', 'pagination_incomplete', 'location_filter_needed',
      'browser_required', 'adapter_error', 'blocked', 'needs_manual_review'
    )),
  status                       TEXT DEFAULT 'ok'
    CHECK (status IN ('ok', 'partial', 'error')),
  notes                        TEXT,
  error_message                TEXT,

  -- Timestamps
  started_at                   TIMESTAMPTZ DEFAULT NOW(),
  finished_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adapter_run_log_dealer_slug
  ON adapter_run_log(dealer_slug);
CREATE INDEX IF NOT EXISTS idx_adapter_run_log_started_at
  ON adapter_run_log(started_at DESC);

ALTER TABLE adapter_run_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_adapter_run_log" ON adapter_run_log FOR ALL USING (true);

-- ── Also fix 3guys listings: these are parts/accessories, not golf carts ────
-- Mark them inactive so they don't pollute public search
UPDATE listings
SET status = 'inactive', public_listing = false
WHERE sync_source = '3guys'
  AND status = 'active';

-- ── Fix pending_review listings (12 rows, NULL sync_source) ─────────────────
-- These were manually entered but never approved — keep as-is
-- Just confirm: SELECT id, title, status FROM listings WHERE status = 'pending_review';

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS adapter_run_log_rows FROM adapter_run_log;

SELECT sync_source, status, COUNT(*) AS n
FROM listings
GROUP BY sync_source, status
ORDER BY sync_source, status;
