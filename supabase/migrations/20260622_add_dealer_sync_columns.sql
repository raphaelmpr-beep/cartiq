-- ============================================================
-- CartIQ: Dealer Sync Columns Migration
-- Run once in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/sql/new
-- ============================================================

-- Step 1: Add sync columns to dealers table
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS dealer_group_slug   TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS inventory_source_url TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS platform_type        TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS fetch_strategy       TEXT DEFAULT 'fetch_url_first';
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS browser_required     BOOLEAN DEFAULT false;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS inventory_status     TEXT DEFAULT 'pending';
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS source_priority      TEXT DEFAULT 'tier2';
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS last_probed_at       TIMESTAMPTZ;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS probe_result         TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS probe_notes          TEXT;

-- Step 2: Migrate sync metadata from notes JSON → proper columns
-- (notes was used as temp storage since columns didn't exist yet)
UPDATE dealers
SET
  dealer_group_slug    = (notes::jsonb->>'group'),
  inventory_source_url = (notes::jsonb->>'inventory_source_url'),
  platform_type        = (notes::jsonb->>'platform'),
  fetch_strategy       = COALESCE(notes::jsonb->>'fetch_strategy', 'fetch_url_first'),
  browser_required     = COALESCE((notes::jsonb->>'browser_required')::boolean, false),
  inventory_status     = COALESCE(notes::jsonb->>'inventory_status', 'pending'),
  source_priority      = COALESCE(notes::jsonb->>'tier', 'tier2'),
  probe_result         = (notes::jsonb->>'probe_result'),
  probe_notes          = (notes::jsonb->>'probe_notes'),
  notes                = CASE
                           WHEN notes::jsonb->>'note' IS NOT NULL
                           THEN notes::jsonb->>'note'
                           ELSE NULL
                         END
WHERE notes IS NOT NULL
  AND notes LIKE '{%'
  AND (notes::jsonb ? 'tier' OR notes::jsonb ? 'platform');

-- Step 3: Apply known overrides

-- Discovery → gcr_wordpress / browser_required
UPDATE dealers SET
  platform_type    = 'gcr_wordpress',
  fetch_strategy   = 'browser_required',
  browser_required = true,
  inventory_status = 'active_source_found',
  inventory_source_url = 'https://discoverygolfcars.com/inventory/'
WHERE slug IN ('discovery-golf-cars-clearwater', 'discovery-golf-cars-land-o-lakes');

-- Botero (GA, already active)
UPDATE dealers SET
  dealer_group_slug    = 'botero',
  platform_type        = 'gcr_wordpress',
  fetch_strategy       = 'browser_required',
  browser_required     = true,
  inventory_status     = 'active',
  inventory_source_url = 'https://boterocarts.com/inventory/',
  source_priority      = 'tier1'
WHERE slug IN (
  'botero-carts-peachtree-city','botero-carts-cumming',
  'botero-carts-clearwater','botero-carts-jacksonville',
  'botero-carts-melbourne','botero-carts-ocala','botero-carts-pensacola'
);

-- Jenkins (DealerSpike, already active in DB)
UPDATE dealers SET
  dealer_group_slug = 'jenkins',
  platform_type     = 'dealerspike',
  fetch_strategy    = 'browser_required',
  browser_required  = true,
  inventory_status  = 'active',
  source_priority   = 'tier2'
WHERE slug LIKE 'jenkins-motorsports-%';

-- Shiver, Fat Boys, Golf Rider, Woodstock, Mike's (already have listings)
UPDATE dealers SET
  platform_type        = 'custom',
  fetch_strategy       = 'fetch_url_first',
  browser_required     = false,
  inventory_status     = 'active',
  source_priority      = 'tier2'
WHERE slug IN (
  'shiver-carts-tifton','shiver-carts-valdosta',
  'fat-boys-golf-carts-covington',
  'golf-rider-peachtree-city',
  'golf-cars-of-woodstock',
  'mikes-golf-carts-perry','mikes-golf-carts-douglas'
);

-- Step 4: Verify result
SELECT
  source_priority,
  platform_type,
  browser_required,
  COUNT(*) AS dealer_count,
  SUM(CASE WHEN inventory_status = 'active' THEN 1 ELSE 0 END) AS active,
  SUM(CASE WHEN inventory_status = 'active_source_found' THEN 1 ELSE 0 END) AS source_found,
  SUM(CASE WHEN inventory_status = 'pending' THEN 1 ELSE 0 END) AS pending
FROM dealers
GROUP BY source_priority, platform_type, browser_required
ORDER BY source_priority, platform_type;
