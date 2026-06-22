-- CartIQ Dealer Registry Migration
-- Adds sync-relevant columns to dealers table and upserts all registry dealers

-- Step 1: Add new columns if not exist
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS dealer_group_slug TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS inventory_source_url TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS platform_type TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS fetch_strategy TEXT DEFAULT 'fetch_url_first';
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS browser_required BOOLEAN DEFAULT false;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS inventory_status TEXT DEFAULT 'pending';
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS source_priority TEXT DEFAULT 'tier2';
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS last_probed_at TIMESTAMPTZ;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS probe_result TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS probe_notes TEXT;

-- Step 2: Upsert Tier 1 FL dealers

-- Botero Carts (parent group) — 5 FL locations
INSERT INTO dealers (name, slug, dealer_group_slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Botero Carts — Clearwater', 'botero-carts-clearwater', 'botero', 'https://boterocarts.com', 'https://boterocarts.com/inventory/', 'Clearwater', 'FL', 'custom', 'fetch_url_first', false, 'active', 'tier1', 'Custom site with structured JSON inventory feed. High-quality listings.'),
  ('Botero Carts — Jacksonville', 'botero-carts-jacksonville', 'botero', 'https://boterocarts.com/location/jacksonville-fl/', 'https://boterocarts.com/inventory/?location=jacksonville', 'Jacksonville', 'FL', 'custom', 'fetch_url_first', false, 'active', 'tier1', 'Botero Jacksonville FL location.'),
  ('Botero Carts — Melbourne', 'botero-carts-melbourne', 'botero', 'https://boterocarts.com/location/melbourne-fl/', 'https://boterocarts.com/inventory/?location=melbourne', 'Melbourne', 'FL', 'custom', 'fetch_url_first', false, 'active', 'tier1', 'Botero Melbourne FL location.'),
  ('Botero Carts — Ocala', 'botero-carts-ocala', 'botero', 'https://boterocarts.com/location/ocala-fl/', 'https://boterocarts.com/inventory/?location=ocala', 'Ocala', 'FL', 'custom', 'fetch_url_first', false, 'active', 'tier1', 'Botero Ocala FL location.'),
  ('Botero Carts — Pensacola', 'botero-carts-pensacola', 'botero', 'https://boterocarts.com/location/pensacola-fl/', 'https://boterocarts.com/inventory/?location=pensacola', 'Pensacola', 'FL', 'custom', 'fetch_url_first', false, 'active', 'tier1', 'Botero Pensacola FL location.')
ON CONFLICT (slug) DO UPDATE SET
  dealer_group_slug = EXCLUDED.dealer_group_slug,
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Discovery Golf Cars — 2 FL locations (strong structured inventory)
INSERT INTO dealers (name, slug, dealer_group_slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Discovery Golf Cars — Clearwater', 'discovery-golf-cars-clearwater', 'discovery', 'https://discoverygolfcars.com', 'https://discoverygolfcars.com/inventory/', 'Clearwater', 'FL', 'custom', 'fetch_url_first', false, 'active', 'tier1', 'Strong structured inventory. fetch_url_first confirmed accessible.'),
  ('Discovery Golf Cars — Land O Lakes', 'discovery-golf-cars-land-o-lakes', 'discovery', 'https://discoverygolfcars.com/land-o-lakes/', 'https://discoverygolfcars.com/land-o-lakes/inventory/', 'Land O Lakes', 'FL', 'custom', 'fetch_url_first', false, 'active', 'tier1', 'Second Discovery location. Strong structured inventory.')
ON CONFLICT (slug) DO UPDATE SET
  dealer_group_slug = EXCLUDED.dealer_group_slug,
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Coastal Golf Carts — Port Orange
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Coastal Golf Carts — Port Orange', 'coastal-golf-carts-port-orange', 'https://coastalgolfcarts.com', 'https://coastalgolfcarts.com/inventory/', 'Port Orange', 'FL', 'wix_custom', 'fetch_url_first', false, 'pending', 'tier1', 'Wix/custom static site. Needs probe to confirm inventory URL.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- DealerSpike Tier 1 FL dealers (browser_required=true)
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Advantage Golf Cars — Miami', 'advantage-golf-cars-miami', 'https://www.advantagegolfcars.com', 'https://www.advantagegolfcars.com/inventory/', 'Miami', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier1', 'DealerSpike platform. Requires Playwright browser for inventory extraction.'),
  ('Golf Carts of St. Augustine', 'golf-carts-st-augustine', 'https://www.golfcartsofstaugustine.com', 'https://www.golfcartsofstaugustine.com/inventory/', 'St. Augustine', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier1', 'DealerSpike platform. Requires Playwright browser.'),
  ('Revel Golf Cars — Jacksonville', 'revel-golf-cars-jacksonville', 'https://www.revelgolfcars.com', 'https://www.revelgolfcars.com/inventory/', 'Jacksonville', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier1', 'DealerSpike platform. Requires Playwright browser.'),
  ('Golf Carts of Vero Beach', 'golf-carts-vero-beach', 'https://www.golfcartsofverobeach.com', 'https://www.golfcartsofverobeach.com/inventory/', 'Vero Beach', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier1', 'DealerSpike platform. Requires Playwright browser.'),
  ('Orlando Golf Cars', 'orlando-golf-cars', 'https://www.orlandogolfcars.com', 'https://www.orlandogolfcars.com/inventory/', 'Orlando', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier1', 'DealerSpike platform. Requires Playwright browser.'),
  ('The Golf Cart Company — Clermont', 'the-golf-cart-company-clermont', 'https://www.thegolfcartcompany.com', 'https://www.thegolfcartcompany.com/inventory/', 'Clermont', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier1', 'DealerSpike platform. Requires Playwright browser.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Step 3: Upsert Tier 2 FL dealers

-- Affordable Carts — DealerSpike
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Affordable Carts — Bonita Springs', 'affordable-carts-bonita-springs', 'https://www.affordablecarts.com', 'https://www.affordablecarts.com/inventory/', 'Bonita Springs', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.')
ON CONFLICT (slug) DO UPDATE SET
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Golf Cart Megastore group — discovery needed for sub-locations
INSERT INTO dealers (name, slug, dealer_group_slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Golf Cart Megastore — Sarasota (Custom Carts)', 'golf-cart-megastore-sarasota', 'golf-cart-megastore', 'https://golfcartmegastore.com', 'https://golfcartmegastore.com/inventory/', 'Sarasota', 'FL', 'custom', 'fetch_url_first', false, 'pending', 'tier2', 'Custom Carts brand. Authorized Club Car, Yamaha, Star EV, Evolution dealer.'),
  ('Golf Cart Megastore — Sun City (Sun City Carts)', 'golf-cart-megastore-sun-city', 'golf-cart-megastore', 'https://suncitycarts.com', 'https://suncitycarts.com/inventory/', 'Sun City Center', 'FL', 'custom', 'fetch_url_first', false, 'pending', 'tier2', 'Sun City Carts brand under Golf Cart Megastore group.'),
  ('Golf Cart Megastore — Capital Carts (St. Petersburg)', 'golf-cart-megastore-capital-carts', 'golf-cart-megastore', 'https://capitalcarts.com', 'https://capitalcarts.com/inventory/', 'St. Petersburg', 'FL', 'custom', 'fetch_url_first', false, 'pending', 'tier2', 'Capital Carts brand under Golf Cart Megastore group.')
ON CONFLICT (slug) DO UPDATE SET
  dealer_group_slug = EXCLUDED.dealer_group_slug,
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Wholesale Golf Carts (The Villages area) — fetch_url_first
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Wholesale Golf Carts — Summerfield', 'wholesale-golf-carts-summerfield', 'https://wholesalegolfcarts.com', 'https://wholesalegolfcarts.com/inventory/', 'Summerfield', 'FL', 'custom', 'fetch_url_first', false, 'pending', 'tier2', 'Serves The Villages market. fetch_url_first.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Jenkins Motorsports — update existing records with sync fields
UPDATE dealers SET
  dealer_group_slug = 'jenkins',
  platform_type = 'dealerspike',
  fetch_strategy = 'browser_required',
  browser_required = true,
  source_priority = 'tier2',
  inventory_status = 'active'
WHERE slug LIKE 'jenkins-motorsports-%';

-- DealerSpike Tier 2 FL dealers
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Golf Cart Center — Rockledge', 'golf-cart-center-rockledge', 'https://golfcartcenter.com', 'https://golfcartcenter.com/inventory/', 'Rockledge', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.'),
  ('Total Golf Cart — Vero Beach', 'total-golf-cart-vero-beach', 'https://totalgolfcart.com', 'https://totalgolfcart.com/inventory/', 'Vero Beach', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.'),
  ('Love ESports — Homosassa', 'love-esports-homosassa', 'https://loveesports.com', 'https://loveesports.com/inventory/', 'Homosassa', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.'),
  ('Paradise Powersports — New Smyrna Beach', 'paradise-powersports-nsb', 'https://paradisepowersports.com', 'https://paradisepowersports.com/inventory/', 'New Smyrna Beach', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.'),
  ('Golf Carts Unlimited — Melbourne', 'golf-carts-unlimited-melbourne', 'https://golfcartsunlimited.com', 'https://golfcartsunlimited.com/inventory/', 'Melbourne', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.'),
  ('G Five Motorsports — Plant City', 'g-five-motorsports-plant-city', 'https://gfivemotorsports.com', 'https://gfivemotorsports.com/inventory/', 'Plant City', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.'),
  ('Gator Golf Cars — Naples', 'gator-golf-cars-naples', 'https://gatorgolfcars.com', 'https://gatorgolfcars.com/inventory/', 'Naples', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.'),
  ('Hidden Creek Golf Carts — Brooksville', 'hidden-creek-golf-carts-brooksville', 'https://hiddencreekgolfcarts.com', 'https://hiddencreekgolfcarts.com/inventory/', 'Brooksville', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier2', 'DealerSpike platform.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- North Florida Golf Carts (Lake City) — fetch_url_first
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('North Florida Golf Carts — Lake City', 'north-florida-golf-carts-lake-city', 'https://northfloridagolfcarts.com', 'https://northfloridagolfcarts.com/inventory/', 'Lake City', 'FL', 'custom', 'fetch_url_first', false, 'pending', 'tier2', 'Custom static site. fetch_url_first.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  source_priority = EXCLUDED.source_priority,
  updated_at = now();

-- Sunshine Golf Car — fetch_url_first, inventory URL confirmed
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Sunshine Golf Car — FL', 'sunshine-golf-car', 'https://sunshinegolfcar.com', 'https://sunshinegolfcar.com/inventory/', 'FL', 'FL', 'custom', 'fetch_url_first', false, 'pending', 'tier2', 'Inventory URL confirmed accessible. fetch_url_first.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  source_priority = EXCLUDED.source_priority,
  updated_at = now();

-- Budget Golf Carts (Yulee) — custom static, fetch_url_first, exposes price/specs
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Budget Golf Carts — Yulee', 'budget-golf-carts-yulee', 'https://budgetgolfcarts.com', 'https://budgetgolfcarts.com/inventory/', 'Yulee', 'FL', 'custom', 'fetch_url_first', false, 'pending', 'tier2', 'Custom static. Exposes price/specs. fetch_url_first.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  source_priority = EXCLUDED.source_priority,
  updated_at = now();

-- Jeffrey Allen — update existing records
UPDATE dealers SET
  dealer_group_slug = 'jeffrey-allen',
  platform_type = 'custom',
  fetch_strategy = 'fetch_url_first',
  browser_required = false,
  source_priority = 'tier2',
  inventory_status = 'pending'
WHERE slug LIKE 'jeffrey-allen-%';

-- South Florida Golf Carts — discovery needed
INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('South Florida Golf Carts', 'south-florida-golf-carts', 'https://southfloridagolfcarts.com', NULL, 'FL', 'FL', 'unknown', 'fetch_url_first', false, 'discovery_needed', 'tier2', 'Discovery needed — inventory URL unknown.')
ON CONFLICT (slug) DO UPDATE SET
  source_priority = EXCLUDED.source_priority,
  inventory_status = EXCLUDED.inventory_status,
  updated_at = now();

-- Step 4: Upsert Tier 3 FL dealers

INSERT INTO dealers (name, slug, website_url, inventory_source_url, city, state, platform_type, fetch_strategy, browser_required, inventory_status, source_priority, notes)
VALUES
  ('Panama City Golf Carts', 'panama-city-golf-carts', 'https://panamacitygolfcarts.com', NULL, 'Panama City', 'FL', 'unknown', 'fetch_url_first', false, 'discovery_needed', 'tier3', 'Discovery needed.'),
  ('Electric Cart Company — Santa Rosa Beach', 'electric-cart-company-santa-rosa', 'https://www.electriccartcompany.com', 'https://www.electriccartcompany.com/inventory/', 'Santa Rosa Beach', 'FL', 'dealerspike', 'browser_required', true, 'pending', 'tier3', 'DealerSpike platform.'),
  ('Electric Cart Watersound — Inlet Beach', 'electric-cart-watersound-inlet-beach', 'https://electriccartwatersound.com', NULL, 'Inlet Beach', 'FL', 'unknown', 'fetch_url_first', false, 'discovery_needed', 'tier3', 'Discovery needed.'),
  ('Hole In One Golf Carts — Naples', 'hole-in-one-golf-carts-naples', 'https://holeinonegolfcarts.com', NULL, 'Naples', 'FL', 'unknown', 'fetch_url_first', false, 'discovery_needed', 'tier3', 'Discovery needed.')
ON CONFLICT (slug) DO UPDATE SET
  inventory_source_url = EXCLUDED.inventory_source_url,
  platform_type = EXCLUDED.platform_type,
  fetch_strategy = EXCLUDED.fetch_strategy,
  browser_required = EXCLUDED.browser_required,
  inventory_status = EXCLUDED.inventory_status,
  source_priority = EXCLUDED.source_priority,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Step 5: Update existing GA dealers in DB with sync fields
UPDATE dealers SET
  platform_type = 'custom',
  fetch_strategy = 'fetch_url_first',
  browser_required = false,
  source_priority = 'tier2',
  inventory_status = 'active'
WHERE slug IN ('botero-carts-peachtree-city', 'botero-carts-cumming')
  AND platform_type IS NULL;

UPDATE dealers SET
  platform_type = 'custom',
  fetch_strategy = 'fetch_url_first',
  browser_required = false,
  source_priority = 'tier2',
  inventory_status = 'active'
WHERE slug IN ('shiver-carts-tifton', 'shiver-carts-valdosta', 'fat-boys-golf-carts-covington', 'golf-rider-peachtree-city', 'golf-cars-of-woodstock', 'mikes-golf-carts-perry', 'mikes-golf-carts-douglas')
  AND platform_type IS NULL;
