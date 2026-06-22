/**
 * CartIQ — Supabase schema migration
 * Runs via the Supabase Management API /pg endpoint (SQL over HTTPS)
 * Uses the postgres password directly to execute DDL
 */
const https = require('https');

const PROJECT_ID = 'aagwrcdvhuuzwrglamrt';
const DB_PASSWORD = '4mmeXsTzVUIWIVuM';

// We'll use the Supabase SQL editor endpoint via Management API
// But since we don't have a management token, use pg over REST
// Instead: use the Supabase /rest/v1/rpc or direct fetch with service key

// Actually — use node-fetch to hit the Supabase SQL API endpoint
// The Supabase project exposes a /pg endpoint that accepts SQL via POST
// with the postgres password as basic auth

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

// Use the publishable key — enough for table creation via RPC if we set up correctly
// Actually for DDL we need service_role or direct pg connection
// Let's try the Supabase SQL endpoint which accepts postgres credentials

const migration = `
-- CartIQ Production Schema Migration
-- Convert from SQLite types to PostgreSQL

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
`;

async function runMigration() {
  // Use Supabase's SQL endpoint via the REST API
  // We need service_role for DDL — derive it or use the Management API
  // Since we have the postgres password, use the /pg/query endpoint
  
  const url = `https://${PROJECT_ID}.supabase.co/rest/v1/rpc/exec_sql`;
  
  // Actually use fetch to the Supabase SQL execution endpoint
  // The correct approach: POST to management API /v1/projects/{ref}/database/query
  // This requires an access token, not the db password
  
  // Alternative: use the supabase-js client with service_role key
  // We need to construct the service_role JWT from the JWT secret
  // But we don't have the JWT secret directly
  
  // Best approach: use the Supabase pg-meta REST endpoint
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  
  // Try the /pg endpoint that Supabase exposes
  const response = await fetch(`https://${PROJECT_ID}.supabase.co/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`postgres:${DB_PASSWORD}`).toString('base64')}`
    },
    body: JSON.stringify({ query: migration })
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text.substring(0, 500));
}

runMigration().catch(console.error);
