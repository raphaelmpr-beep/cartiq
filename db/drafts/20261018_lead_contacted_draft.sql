-- 20261018_lead_contacted_draft.sql
-- DRAFT ONLY. NOT APPLIED. Requires 20261018_lead_tracking_draft.sql first
-- (and 20261018_lead_idempotency_draft.sql if applied; independent of it).
-- Scope change (Raphael, Oct 18 5:35 PM ET): leads go to GolfCartIQ, not dealers.
-- Records that GolfCartIQ contacted the shopper, and makes "contacted before shared
-- with a dealer" enforceable (Database Engineer's r2 suggestion).
-- Written only via the server (service_role): POST /api/admin/leads/:id/contacted
-- (admin token). Lockdown unchanged: no grants, no policies, no functions.
begin;

alter table public.listing_leads
  add column if not exists contacted_at timestamptz,
  add column if not exists forwarded_at timestamptz;   -- already in the base draft; no-op there

-- Status now includes 'contacted'. The base draft's inline check is auto-named
-- listing_leads_status_check; replace it with a named one.
alter table public.listing_leads drop constraint if exists listing_leads_status_check;
alter table public.listing_leads add constraint listing_leads_status_check
  check (status in ('new', 'reviewed', 'contacted', 'forwarded', 'spam', 'closed'));

-- Can't be forwarded to a dealer before GolfCartIQ contacted the shopper.
alter table public.listing_leads drop constraint if exists listing_leads_forwarded_after_contacted;
alter table public.listing_leads add constraint listing_leads_forwarded_after_contacted
  check (forwarded_at is null or (contacted_at is not null and forwarded_at >= contacted_at));

-- SRE daily check: leads older than 24 h with no contacted_at (excluding spam/closed).
create index if not exists idx_listing_leads_uncontacted
  on public.listing_leads (created_at) where contacted_at is null;

-- Re-assert lockdown (idempotent).
alter table public.listing_leads enable row level security;
revoke all on table public.listing_leads from public, anon, authenticated;

commit;

-- SRE daily query (read-only, service_role):
-- select count(*) as overdue, min(created_at) as oldest
-- from public.listing_leads
-- where contacted_at is null and status not in ('spam', 'closed') and created_at < now() - interval '24 hours';

-- Rollback:
-- begin; drop index if exists public.idx_listing_leads_uncontacted;
--   alter table public.listing_leads drop constraint if exists listing_leads_forwarded_after_contacted;
--   alter table public.listing_leads drop constraint if exists listing_leads_status_check;
--   alter table public.listing_leads add constraint listing_leads_status_check check (status in ('new','reviewed','forwarded','spam','closed'));
--   alter table public.listing_leads drop column if exists contacted_at; commit;
