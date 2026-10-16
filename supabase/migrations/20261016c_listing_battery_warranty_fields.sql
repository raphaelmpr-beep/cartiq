-- 20261016c: battery + warranty provenance fields (additive, nullable). Rollback at bottom.
alter table public.listings
  add column if not exists battery_chemistry text,
  add column if not exists battery_voltage numeric,
  add column if not exists battery_kwh numeric,
  add column if not exists battery_brand text,
  add column if not exists battery_source text,
  add column if not exists battery_warranty_months integer,
  add column if not exists warranty_source text,
  add column if not exists warranty_source_url text,
  add column if not exists warranty_source_quote text,
  add column if not exists warranty_verified_at timestamptz;
alter table public.listings drop constraint if exists listings_battery_chemistry_chk;
alter table public.listings add constraint listings_battery_chemistry_chk
  check (battery_chemistry is null or battery_chemistry in ('lithium','lead_acid','agm'));
alter table public.listings drop constraint if exists listings_battery_voltage_chk;
alter table public.listings add constraint listings_battery_voltage_chk
  check (battery_voltage is null or battery_voltage between 12 and 120);
alter table public.dealers
  add column if not exists street_address text,
  add column if not exists hours_text text,
  add column if not exists warranty_page_url text,
  add column if not exists warranty_program_quote text,
  add column if not exists contact_verified_at timestamptz;
-- ROLLBACK:
-- alter table public.listings drop constraint if exists listings_battery_chemistry_chk, drop constraint if exists listings_battery_voltage_chk,
--   drop column if exists battery_chemistry, drop column if exists battery_voltage, drop column if exists battery_kwh,
--   drop column if exists battery_brand, drop column if exists battery_source, drop column if exists battery_warranty_months,
--   drop column if exists warranty_source, drop column if exists warranty_source_url, drop column if exists warranty_source_quote,
--   drop column if exists warranty_verified_at;
-- alter table public.dealers drop column if exists street_address, drop column if exists hours_text,
--   drop column if exists warranty_page_url, drop column if exists warranty_program_quote, drop column if exists contact_verified_at;
