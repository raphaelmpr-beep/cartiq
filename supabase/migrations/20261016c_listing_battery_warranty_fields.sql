-- PROPOSAL (not applied). Adds structured battery + warranty-provenance fields and dealer contact fields.
-- All columns nullable/additive; no existing column changes. Rollback at bottom.
alter table public.listings
  add column if not exists battery_voltage numeric,          -- 36 / 48 / 51.2 / 72
  add column if not exists battery_kwh numeric,              -- pack energy when published
  add column if not exists battery_brand text,               -- e.g. RoyPow, Eco Battery, Trojan
  add column if not exists battery_source text,              -- 'listing_page' | 'dealer_feed' | 'title'
  add column if not exists battery_warranty_months integer,
  add column if not exists warranty_source text,             -- 'listing_page' | 'dealer_warranty_page'
  add column if not exists warranty_source_url text,         -- page the wording was quoted from
  add column if not exists warranty_source_quote text,       -- verbatim dealer wording (never generated)
  add column if not exists warranty_verified_at timestamptz;
alter table public.listings drop constraint if exists listings_battery_voltage_chk;
alter table public.listings add constraint listings_battery_voltage_chk check (battery_voltage is null or battery_voltage between 12 and 120);
alter table public.dealers
  add column if not exists street_address text,
  add column if not exists hours_text text,
  add column if not exists warranty_page_url text,
  add column if not exists contact_verified_at timestamptz;
-- ROLLBACK:
-- alter table public.listings drop column if exists battery_voltage, drop column if exists battery_kwh, drop column if exists battery_brand,
--   drop column if exists battery_source, drop column if exists battery_warranty_months, drop column if exists warranty_source,
--   drop column if exists warranty_source_url, drop column if exists warranty_source_quote, drop column if exists warranty_verified_at;
-- alter table public.dealers drop column if exists street_address, drop column if exists hours_text,
--   drop column if exists warranty_page_url, drop column if exists contact_verified_at;
