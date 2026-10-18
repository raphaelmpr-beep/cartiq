-- 20261018_lead_tracking_draft.sql
-- DRAFT ONLY. NOT APPLIED to any environment. Do not run without Raphael's
-- explicit approval routed through the Portfolio Director.
--
-- Purpose: listing-page events + quote-form leads (feat/lead-tracking-draft,
-- behind LEAD_TRACKING_ENABLED, default off).
-- Access model: writes come ONLY through the app's server routes using the
-- server-side service_role client (supabaseAdmin), which bypasses RLS.
-- RLS is ON with NO policies, and every privilege is revoked from anon,
-- authenticated and public: the publishable key can neither insert nor read.
-- (Matches 20261015_lock_down_anon_rls.sql; no anon grants are needed.)
--
-- Why not reuse public.homepage_events: its columns are carousel-specific
-- (position, is_featured, city/brand), it is aggregated by the homepage CTR
-- job (/api/admin/aggregate-ctr), and its original migration granted anon
-- insert+read policies. A separate table keeps listing traffic out of the
-- carousel CTR numbers and starts locked down.

begin;

-- 1. Events: no PII. session_id is a random client token (rotates per tab session),
--    never an IP, email or user id.
create table if not exists public.listing_events (
  id          bigint generated always as identity primary key,
  event_type  text        not null check (event_type in ('listing_view', 'contact_click', 'outbound_click')),
  listing_id  integer     not null references public.listings(id) on delete cascade,
  dealer_id   integer     references public.dealers(id) on delete set null,
  session_id  text        not null check (session_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  created_at  timestamptz not null default now()
);
create index if not exists idx_listing_events_dealer_month on public.listing_events (dealer_id, created_at);
create index if not exists idx_listing_events_listing      on public.listing_events (listing_id, event_type, created_at);

-- 2. Leads: PII (name + email/phone + zip). Locked down; admin access via server only.
create table if not exists public.listing_leads (
  id          bigint generated always as identity primary key,
  listing_id  integer     not null references public.listings(id) on delete restrict,
  dealer_id   integer     references public.dealers(id) on delete set null,
  name        text        not null check (char_length(name) between 2 and 80),
  email       text        check (email is null or char_length(email) <= 254),
  phone       text        check (phone is null or phone ~ '^\d{10}$'),
  zip         text        not null check (zip ~ '^\d{5}(-\d{4})?$'),
  message     text        check (message is null or char_length(message) <= 1000),
  consent_text text       not null,
  ip_hash     text,        -- sha256(salt||ip), for abuse review only; never the raw IP
  status      text        not null default 'new' check (status in ('new', 'reviewed', 'forwarded', 'spam', 'closed')),
  forwarded_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint listing_leads_contact_required check (email is not null or phone is not null)
);
create index if not exists idx_listing_leads_dealer_month on public.listing_leads (dealer_id, created_at);
create index if not exists idx_listing_leads_status       on public.listing_leads (status, created_at);

alter table public.listing_events enable row level security;
alter table public.listing_leads  enable row level security;
-- No policies on purpose.

revoke all on table public.listing_events from public, anon, authenticated;
revoke all on table public.listing_leads  from public, anon, authenticated;

commit;

-- Rollback (also draft):
-- begin; drop table if exists public.listing_leads; drop table if exists public.listing_events; commit;
