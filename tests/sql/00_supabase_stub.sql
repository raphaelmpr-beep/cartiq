-- Minimal stand-in for Supabase so the migration + RLS can be tested on plain Postgres.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean);
grant usage on schema public to anon, authenticated, service_role;
create table public.dealers (id integer primary key, name text, slug text, state text, city text, zip text, street_address text,
  hours_text text, phone text, email text, website_url text, adapter_key text, sync_enabled boolean, updated_at timestamptz);
create table public.listings (id integer primary key, dealer_id integer references dealers(id), brand text, state text);
create table public.homepage_events (id bigserial primary key, event_type text, listing_id int, dealer_id int, created_at timestamptz default now());
create table public.dealers_backup_20261016 (id int, phone text);
create table public.dealers_contact_backup_20261016 (id int);
create table public.listings_battery_backup_20261016 (id int);
create table public.listings_price_backup_20261016 (id int);
create table public.listings_warranty_backup_20261016 (id int);
-- mimic Supabase default privileges (anon/authenticated get table grants by default)
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- mirror CartIQ prod (read 2026-10-26): RLS on, no client grants on dealers/listings/homepage_events
alter table public.dealers enable row level security; alter table public.listings enable row level security;
alter table public.homepage_events enable row level security;
revoke all on public.dealers, public.listings, public.homepage_events from anon, authenticated;
