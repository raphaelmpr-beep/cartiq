-- 20261018_lead_tracking_paused_draft.sql
-- DRAFT ONLY. NOT APPLIED. Requires 20261018_lead_tracking_draft.sql first.
-- DB kill switch ("paused") for lead tracking. A Vercel env var can't be flipped from
-- code, so the volume monitor (run by POST /api/cron/lead-retention, same job as the
-- cleanup) sets paused = true on alert. The server treats tracking as OFF when
-- LEAD_TRACKING_ENABLED is off OR paused = true, and also when this row can't be read
-- (fail closed); lead routes then write nothing and the server logs an error.
-- Cleared only via POST /api/admin/leads/paused/clear (admin token).
-- Single row (id = 1). Server-only access via service_role; no functions added.
begin;

create table if not exists public.lead_tracking_paused (
  id         smallint    primary key default 1 check (id = 1),
  paused     boolean     not null default false,
  reason     text        check (reason is null or char_length(reason) <= 500),
  set_at     timestamptz,
  cleared_at timestamptz,
  updated_at timestamptz not null default now()
);
-- The row must exist: a missing row reads as "can't verify" and fails closed.
insert into public.lead_tracking_paused (id, paused) values (1, false) on conflict (id) do nothing;

alter table public.lead_tracking_paused enable row level security;   -- no policies on purpose
revoke all on table public.lead_tracking_paused from public, anon, authenticated;

commit;
-- Rollback: drop table if exists public.lead_tracking_paused;
