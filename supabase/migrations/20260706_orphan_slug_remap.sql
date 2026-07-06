-- ============================================================
-- CartIQ: Orphan sync_source slug remap
-- Run once in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/sql/new
-- ============================================================
-- Context
--   Inventory Gap Audit found 21 sync_source slugs written by adapters that
--   don't match any row in dealers.slug. Three of them have LIVE public
--   listings and are therefore visible on the site with no dealer profile
--   attached (broken dealer page links, no city/state, no dealer branding):
--
--     orphan slug                         canonical action
--     ─────────────────────────────────  ────────────────────────────────────
--     golf-cart-world-ponte-vedra        → remap to golf-cart-world-ponte-vedra-beach
--     south-florida-golf-carts           → remap to south-florida-golf-carts-boca-raton
--     gator-golf-cars-naples             → create new dealer, then link
--
-- What this migration does
--   1. Insert missing dealer (Gator Golf Cars Naples) with verified NAP data.
--   2. Remap listings.sync_source and listings.dealer_id for the two
--      orphans that already have a canonical profile.
--   3. Attach dealer_id + state + city to any Gator Naples orphan listings.
--   4. Do the same for pending_imports.dealer_slug so future approvals land
--      on the correct dealer.
--
-- Safety
--   - Uses ON CONFLICT DO NOTHING for the insert (idempotent).
--   - Only rewrites rows whose slug matches the orphan value exactly.
--   - Wrap in a transaction.

BEGIN;

-- ── 1. Insert Gator Golf Cars — Naples (verified via gatorgolfcars.com) ────
INSERT INTO dealers (name, slug, website_url, phone, city, state, zip,
                     delivery_available, delivery_included,
                     default_warranty_included, notes)
VALUES ('Gator Golf Cars — Naples',
        'gator-golf-cars-naples',
        'https://www.gatorgolfcars.com',
        '(239) 331-4538',
        'Naples',
        'FL',
        '34109',
        true,   -- delivery available (per website)
        false,
        false,
        'Family-owned Club Car dealer serving SW Florida since 2005. Locations in Naples, Fort Myers, LaBelle. Orphan slug remap 2026-07-06.')
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Remap orphan slugs to canonical dealer slugs ────────────────────────
-- 2a. golf-cart-world-ponte-vedra → golf-cart-world-ponte-vedra-beach
UPDATE listings
SET    sync_source = 'golf-cart-world-ponte-vedra-beach',
       updated_at  = NOW()
WHERE  sync_source = 'golf-cart-world-ponte-vedra';

UPDATE pending_imports
SET    dealer_slug = 'golf-cart-world-ponte-vedra-beach'
WHERE  dealer_slug = 'golf-cart-world-ponte-vedra';

-- 2b. south-florida-golf-carts → south-florida-golf-carts-boca-raton
UPDATE listings
SET    sync_source = 'south-florida-golf-carts-boca-raton',
       updated_at  = NOW()
WHERE  sync_source = 'south-florida-golf-carts';

UPDATE pending_imports
SET    dealer_slug = 'south-florida-golf-carts-boca-raton'
WHERE  dealer_slug = 'south-florida-golf-carts';

-- ── 3. Backfill dealer_id + city + state on any listing whose sync_source ──
--     now matches an existing dealer.slug and is currently unlinked.
UPDATE listings l
SET    dealer_id  = d.id,
       state      = COALESCE(l.state, d.state),
       city       = COALESCE(l.city, d.city),
       updated_at = NOW()
FROM   dealers d
WHERE  l.sync_source = d.slug
  AND  l.dealer_id IS NULL;

-- ── 4. Post-check ──────────────────────────────────────────────────────────
DO $$
DECLARE
  orphan_listings INT;
BEGIN
  SELECT COUNT(*) INTO orphan_listings
  FROM   listings l
  LEFT JOIN dealers d ON d.slug = l.sync_source
  WHERE  l.sync_source IS NOT NULL
    AND  d.id IS NULL
    AND  l.status = 'active'
    AND  l.public_listing = true;
  RAISE NOTICE 'Post-check: % live public listings still reference an orphan sync_source', orphan_listings;
END $$;

COMMIT;
