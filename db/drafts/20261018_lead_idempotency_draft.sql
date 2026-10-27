-- 20261018_lead_idempotency_draft.sql
-- DRAFT ONLY. NOT APPLIED. Requires 20261018_lead_tracking_draft.sql first.
-- Double-submit protection for listing_leads (POST /api/leads/quote):
--  * idempotency_key: per-form-open UUID from the client; unique, so a resend of the
--    same submit can never insert twice.
--  * contact_hash: salted sha256 of email|phone (server-side; no raw contact in the key).
--  * dedupe_bucket: floor(epoch_ms / 600000). Unique (listing_id, contact_hash, dedupe_bucket)
--    closes the race for "same listing + same contact within 10 minutes" (the server also
--    checks created_at >= now()-10min before inserting, covering bucket edges).
-- The server catches unique violations (23505) and returns the original success.
-- Lockdown unchanged: no grants, no policies, no new functions.
begin;

alter table public.listing_leads
  add column if not exists idempotency_key uuid,
  add column if not exists contact_hash    text check (contact_hash is null or contact_hash ~ '^[0-9a-f]{32}$'),
  add column if not exists dedupe_bucket   bigint;

create unique index if not exists uq_listing_leads_idempotency_key
  on public.listing_leads (idempotency_key) where idempotency_key is not null;
create unique index if not exists uq_listing_leads_contact_bucket
  on public.listing_leads (listing_id, contact_hash, dedupe_bucket) where contact_hash is not null;
create index if not exists idx_listing_leads_dedupe_lookup
  on public.listing_leads (listing_id, contact_hash, created_at);

-- Re-assert lockdown (idempotent).
alter table public.listing_leads enable row level security;
revoke all on table public.listing_leads from public, anon, authenticated;

commit;
-- Rollback:
-- begin; drop index if exists public.idx_listing_leads_dedupe_lookup; drop index if exists public.uq_listing_leads_contact_bucket;
--   drop index if exists public.uq_listing_leads_idempotency_key;
--   alter table public.listing_leads drop column if exists dedupe_bucket, drop column if exists contact_hash, drop column if exists idempotency_key; commit;
