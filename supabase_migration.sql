-- CartIQ Production Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query → Paste → Run

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'buyer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dealers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website_url TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  service_area_miles INTEGER,
  delivery_available BOOLEAN DEFAULT FALSE,
  delivery_included BOOLEAN DEFAULT FALSE,
  delivery_base_fee DOUBLE PRECISION,
  delivery_per_mile_fee DOUBLE PRECISION,
  delivery_free_radius_miles INTEGER,
  default_warranty_included BOOLEAN DEFAULT FALSE,
  default_warranty_months INTEGER,
  default_warranty_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retail_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'retailer',
  authorized_mode TEXT NOT NULL DEFAULT 'manual',
  allowed_use_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'admin_manual',
  source_url TEXT,
  public_listing BOOLEAN NOT NULL DEFAULT TRUE,
  seller_type TEXT NOT NULL DEFAULT 'private',
  status TEXT NOT NULL DEFAULT 'active',
  dealer_id INTEGER REFERENCES dealers(id),
  retail_source_id INTEGER REFERENCES retail_sources(id),
  retailer_name TEXT,
  retailer_sku TEXT,
  retailer_product_url TEXT,
  retail_event_name TEXT,
  retail_event_dates TEXT,
  availability_status TEXT,
  ship_to_states TEXT,
  last_verified_at TIMESTAMPTZ,
  asking_price DOUBLE PRECISION,
  regular_price DOUBLE PRECISION,
  sale_price DOUBLE PRECISION,
  cartiq_estimated_value DOUBLE PRECISION,
  estimated_delivery_cost DOUBLE PRECISION,
  total_delivered_cost DOUBLE PRECISION,
  deal_delta DOUBLE PRECISION,
  deal_rating TEXT DEFAULT 'unknown',
  buyer_score INTEGER DEFAULT 70,
  year INTEGER,
  brand TEXT,
  model TEXT,
  condition TEXT,
  power_type TEXT DEFAULT 'unknown',
  battery_type TEXT DEFAULT 'unknown',
  battery_ah INTEGER,
  battery_age_months INTEGER,
  seating INTEGER,
  lifted BOOLEAN DEFAULT FALSE,
  street_legal_claimed BOOLEAN DEFAULT FALSE,
  street_legal_confidence TEXT DEFAULT 'unknown',
  charger_included TEXT DEFAULT 'unknown',
  warranty_included TEXT DEFAULT 'unknown',
  warranty_provider TEXT DEFAULT 'unknown',
  warranty_months INTEGER,
  battery_warranty_included TEXT DEFAULT 'unknown',
  warranty_notes TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  delivery_available BOOLEAN DEFAULT FALSE,
  delivery_included BOOLEAN DEFAULT FALSE,
  delivery_notes TEXT,
  image_url TEXT,
  image_urls TEXT,
  seller_name TEXT,
  seller_phone TEXT,
  seller_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_brand ON listings(brand);
CREATE INDEX IF NOT EXISTS idx_listings_state ON listings(state);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_seller_type ON listings(seller_type);
CREATE INDEX IF NOT EXISTS idx_listings_condition ON listings(condition);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

CREATE TABLE IF NOT EXISTS deal_checks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  source_platform TEXT NOT NULL DEFAULT 'other',
  source_url TEXT,
  extraction_method TEXT NOT NULL DEFAULT 'manual_user_entry',
  user_confirmed_disclosure BOOLEAN NOT NULL DEFAULT FALSE,
  asking_price DOUBLE PRECISION,
  regular_price DOUBLE PRECISION,
  sale_price DOUBLE PRECISION,
  year INTEGER,
  brand TEXT,
  model TEXT,
  city TEXT,
  state TEXT,
  seller_type TEXT,
  retailer_name TEXT,
  power_type TEXT DEFAULT 'unknown',
  battery_type TEXT DEFAULT 'unknown',
  battery_ah INTEGER,
  battery_age_months INTEGER,
  seating INTEGER,
  lifted TEXT DEFAULT 'unknown',
  street_legal_claimed TEXT DEFAULT 'unknown',
  charger_included TEXT DEFAULT 'unknown',
  warranty_included TEXT DEFAULT 'unknown',
  warranty_provider TEXT DEFAULT 'unknown',
  warranty_months INTEGER,
  battery_warranty_included TEXT DEFAULT 'unknown',
  warranty_notes TEXT,
  delivery_available TEXT DEFAULT 'unknown',
  delivery_cost DOUBLE PRECISION,
  last_verified_at TIMESTAMPTZ,
  cartiq_estimated_value DOUBLE PRECISION,
  total_delivered_cost DOUBLE PRECISION,
  deal_delta DOUBLE PRECISION,
  deal_rating TEXT DEFAULT 'unknown',
  buyer_score INTEGER DEFAULT 70,
  battery_risk TEXT DEFAULT 'unknown',
  charger_warning TEXT,
  warranty_signal TEXT,
  street_legal_confidence TEXT DEFAULT 'unknown',
  red_flags TEXT DEFAULT '[]',
  questions_to_ask TEXT DEFAULT '[]',
  negotiation_low DOUBLE PRECISION,
  negotiation_high DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_comps (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id),
  brand TEXT,
  model TEXT,
  year_min INTEGER,
  year_max INTEGER,
  state TEXT,
  city TEXT,
  radius_miles INTEGER,
  sample_size INTEGER,
  median_price DOUBLE PRECISION,
  adjusted_value DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active',
  base_url TEXT,
  api_provider TEXT,
  allowed_use_notes TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seo_articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  meta_description TEXT,
  canonical_path TEXT,
  primary_keyword TEXT,
  secondary_keywords TEXT DEFAULT '[]',
  h1 TEXT,
  short_answer TEXT,
  body TEXT,
  faq_json TEXT DEFAULT '[]',
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_watches (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  price_at_watch DOUBLE PRECISION NOT NULL,
  alerted_at TIMESTAMPTZ,
  alert_price DOUBLE PRECISION,
  alert_pct DOUBLE PRECISION,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_listings (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (permissive for now — lock down later)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_watches ENABLE ROW LEVEL SECURITY;

-- Public read access on listings and dealers
CREATE POLICY IF NOT EXISTS "listings_public_read" ON listings FOR SELECT USING (public_listing = TRUE AND status = 'active');
CREATE POLICY IF NOT EXISTS "dealers_public_read" ON dealers FOR SELECT USING (TRUE);

-- Allow inserts from anon (deal checker, sell my cart)
CREATE POLICY IF NOT EXISTS "deal_checks_insert" ON deal_checks FOR INSERT WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS "saved_listings_all" ON saved_listings FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS "listing_watches_all" ON listing_watches FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Allow anon to read back their own deal_check after insert (needed for RETURNING clause)
CREATE POLICY IF NOT EXISTS "deal_checks_select" ON deal_checks FOR SELECT USING (TRUE);

-- Dealers and listings write access (added after initial migration)
CREATE POLICY IF NOT EXISTS "dealers_insert" ON dealers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS "dealers_update" ON dealers FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS "listings_insert" ON listings FOR INSERT WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS "listings_update" ON listings FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- Admin listings read (bypasses public_listing=TRUE filter for admin panel)
CREATE POLICY IF NOT EXISTS "listings_admin_read" ON listings FOR SELECT USING (TRUE);

-- Admin full access (bypass RLS via service_role — handled server-side)
