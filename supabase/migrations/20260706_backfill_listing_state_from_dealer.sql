-- ============================================================
-- CartIQ: Backfill listings.state (and city) from dealers.state
-- Run once in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/sql/new
-- ============================================================
-- Context
--   Inventory Gap Audit shows 229 active+public listings with state=NULL.
--   Public search page filters by state = FL|GA, so these listings are live
--   on /api/listings but invisible to the search UI. Every affected listing
--   belongs to a dealer whose profile HAS a state; the adapter path just
--   wrote NULL into listings.state.
--
-- What this migration does
--   1. Preview: shows how many listings would be updated (by state).
--   2. Backfill state via dealer_id join.
--   3. Backfill state via sync_source → dealer.slug fallback.
--   4. Same two-step for city.
--   5. Post-check: any remaining active+public listings with NULL state.
--
-- Safety
--   - Only touches rows where the column is currently NULL.
--   - Idempotent — re-running produces zero updates once complete.
--   - Wrap in a transaction so preview + updates commit atomically.

BEGIN;

-- ── 1. Preview ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  by_dealer_id INT;
  by_sync_src  INT;
BEGIN
  SELECT COUNT(*) INTO by_dealer_id
  FROM listings l
  JOIN dealers d ON d.id = l.dealer_id
  WHERE l.state IS NULL AND d.state IS NOT NULL;

  SELECT COUNT(*) INTO by_sync_src
  FROM listings l
  JOIN dealers d ON d.slug = l.sync_source
  WHERE l.state IS NULL AND l.dealer_id IS NULL AND d.state IS NOT NULL;

  RAISE NOTICE 'Backfill preview: % rows via dealer_id, % rows via sync_source', by_dealer_id, by_sync_src;
END $$;

-- ── 2. Backfill listings.state via dealer_id ───────────────────────────────
UPDATE listings l
SET    state = d.state,
       updated_at = NOW()
FROM   dealers d
WHERE  l.dealer_id = d.id
  AND  l.state IS NULL
  AND  d.state IS NOT NULL;

-- ── 3. Backfill listings.state via sync_source → dealer.slug ───────────────
UPDATE listings l
SET    state = d.state,
       updated_at = NOW()
FROM   dealers d
WHERE  l.sync_source = d.slug
  AND  l.dealer_id IS NULL
  AND  l.state IS NULL
  AND  d.state IS NOT NULL;

-- ── 4. Same two-step for city (safe: only fills NULLs) ─────────────────────
UPDATE listings l
SET    city = d.city,
       updated_at = NOW()
FROM   dealers d
WHERE  l.dealer_id = d.id
  AND  l.city IS NULL
  AND  d.city IS NOT NULL;

UPDATE listings l
SET    city = d.city,
       updated_at = NOW()
FROM   dealers d
WHERE  l.sync_source = d.slug
  AND  l.dealer_id IS NULL
  AND  l.city IS NULL
  AND  d.city IS NOT NULL;

-- ── 5. Post-check ──────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM   listings
  WHERE  status = 'active'
    AND  public_listing = true
    AND  state IS NULL;
  RAISE NOTICE 'Post-check: % active+public listings still have NULL state', remaining;
END $$;

COMMIT;
