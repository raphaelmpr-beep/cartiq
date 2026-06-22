-- ============================================================
-- CartIQ: Approve Discovery Wave 1 — pending_imports 2164–2168
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/sql/new
-- ============================================================

BEGIN;

-- 1. Insert into listings
INSERT INTO listings (
  title, slug, brand, model, year, condition,
  asking_price, price_scraped, price_confidence,
  image_url, city, state,
  source_listing_url, sync_source,
  deal_rating, deal_delta,
  dealer_id, seller_type, source_type,
  status, public_listing,
  verified_at, last_checked_at
)
VALUES
  (
    '2020 E-Z-GO Freedom RXV Elite',
    'ezgo-freedom-rxv-elite-2020-refurbished-clearwater-17788',
    'E-Z-GO', 'Freedom RXV Elite', 2020, 'refurbished',
    5495, 5495, 'confirmed',
    'https://gcrdealers-cdn.com/discoverygolfcars/IMG_3206--att17772.jpeg',
    'Clearwater', 'FL',
    'https://www.discoverygolfcars.com/listing/refurbished-2020-lithium-e-z-go-freedom-rxv-elite-clearwater-florida-17788/',
    'discovery-golf-cars-clearwater',
    'great_deal', -3505,
    84, 'dealer', 'dealer_sync',
    'active', true,
    NOW(), NOW()
  ),
  (
    '2020 E-Z-GO Freedom RXV Elite — Burgundy',
    'ezgo-freedom-rxv-elite-2020-refurbished-clearwater-17787',
    'E-Z-GO', 'Freedom RXV Elite', 2020, 'refurbished',
    5295, 5295, 'confirmed',
    'https://gcrdealers-cdn.com/discoverygolfcars/IMG_3218--att17760.jpeg',
    'Clearwater', 'FL',
    'https://www.discoverygolfcars.com/listing/refurbished-2020-lithium-e-z-go-freedom-rxv-elite-clearwater-florida-17787/',
    'discovery-golf-cars-clearwater',
    'great_deal', -3705,
    84, 'dealer', 'dealer_sync',
    'active', true,
    NOW(), NOW()
  ),
  (
    '2018 E-Z-GO Freedom RXV Elite — Blue Cell Lithium',
    'ezgo-freedom-rxv-elite-2018-refurbished-clearwater-17786',
    'E-Z-GO', 'Freedom RXV Elite', 2018, 'refurbished',
    7495, 7495, 'confirmed',
    'https://gcrdealers-cdn.com/discoverygolfcars/IMG_3240--att17743.jpeg',
    'Clearwater', 'FL',
    'https://www.discoverygolfcars.com/listing/refurbished-2018-lithium-e-z-go-freedom-rxv-elite-clearwater-florida-17786/',
    'discovery-golf-cars-clearwater',
    'great_deal', -1505,
    84, 'dealer', 'dealer_sync',
    'active', true,
    NOW(), NOW()
  ),
  (
    '2019 E-Z-GO Freedom RXV Elite — Lithium',
    'ezgo-freedom-rxv-elite-2019-refurbished-clearwater-17785',
    'E-Z-GO', 'Freedom RXV Elite', 2019, 'refurbished',
    5595, 5595, 'confirmed',
    'https://gcrdealers-cdn.com/discoverygolfcars/IMG_3238--att17745.jpeg',
    'Clearwater', 'FL',
    'https://www.discoverygolfcars.com/listing/refurbished-2019-lithium-e-z-go-freedom-rxv-elite-clearwater-florida-17785/',
    'discovery-golf-cars-clearwater',
    'great_deal', -3405,
    84, 'dealer', 'dealer_sync',
    'active', true,
    NOW(), NOW()
  ),
  (
    '2020 E-Z-GO Freedom RXV Elite — Lithium Refurbished',
    'ezgo-freedom-rxv-elite-2020-refurbished-clearwater-17781',
    'E-Z-GO', 'Freedom RXV Elite', 2020, 'refurbished',
    6495, 6495, 'confirmed',
    'https://gcrdealers-cdn.com/discoverygolfcars/IMG_3233--att17749.jpeg',
    'Clearwater', 'FL',
    'https://www.discoverygolfcars.com/listing/refurbished-2020-lithium-e-z-go-freedom-rxv-elite-clearwater-florida-17781/',
    'discovery-golf-cars-clearwater',
    'great_deal', -2505,
    84, 'dealer', 'dealer_sync',
    'active', true,
    NOW(), NOW()
  )
ON CONFLICT (slug) DO NOTHING;

-- 2. Mark pending_imports as imported + link to new listings
UPDATE pending_imports
SET
  status = 'imported',
  reviewed_at = NOW(),
  imported_listing_id = (
    SELECT id FROM listings
    WHERE source_listing_url = pending_imports.source_url
    LIMIT 1
  )
WHERE id IN (2164, 2165, 2166, 2167, 2168);

-- 3. Update sync_log
UPDATE sync_log
SET
  status = 'ok',
  notes  = 'Wave 1 approved: 5 Discovery listings promoted to active'
WHERE id = 1;

-- 4. Verify
SELECT
  l.id, l.title, l.asking_price, l.deal_rating, l.status,
  pi.id AS pending_id, pi.status AS pending_status
FROM listings l
JOIN pending_imports pi ON pi.source_url = l.source_listing_url
WHERE pi.id IN (2164, 2165, 2166, 2167, 2168)
ORDER BY l.id;

COMMIT;
