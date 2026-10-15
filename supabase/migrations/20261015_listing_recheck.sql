-- 20261015_listing_recheck.sql — recurring listing re-check + data-quality reports.
-- NOT YET APPLIED. Apply BEFORE enabling the cron (CRON_SECRET) — see PR rollout.
-- Additive only: new nullable columns + new tables. No existing data changes.

begin;

alter table public.listings
  add column if not exists recheck_fail_count   integer not null default 0,
  add column if not exists recheck_last_status  text,
  add column if not exists recheck_last_reason  text,
  add column if not exists recheck_last_at      timestamptz,
  add column if not exists recheck_archived_at  timestamptz;

create index if not exists listings_recheck_queue_idx
  on public.listings (last_checked_at nulls first)
  where status = 'active' and public_listing = true and source_listing_url is not null;

-- Background refresh jobs (admin "Refresh now" / "Refresh all stale").
create table if not exists public.recheck_jobs (
  id            bigserial primary key,
  scope         text not null check (scope in ('dealer','stale_dealers')),
  dealer_slugs  text[] not null default '{}',
  status        text not null default 'queued' check (status in ('queued','running','done','failed','cancelled')),
  dry_run       boolean not null default false,
  total         integer not null default 0,
  processed     integer not null default 0,
  alive         integer not null default 0,
  dead_pending  integer not null default 0,
  archived      integer not null default 0,
  errors        integer not null default 0,
  last_error    text,
  requested_by  text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  updated_at    timestamptz not null default now()
);
create index if not exists recheck_jobs_status_idx on public.recheck_jobs (status, created_at);

-- Nightly data-quality snapshots.
create table if not exists public.data_quality_reports (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  totals      jsonb not null,
  by_dealer   jsonb not null default '[]'::jsonb
);
create index if not exists data_quality_reports_created_idx on public.data_quality_reports (created_at desc);

-- Server-only tables (secret key). Match 20261015_lock_down_anon_rls.sql.
alter table public.recheck_jobs          enable row level security;
alter table public.data_quality_reports  enable row level security;
revoke all on public.recheck_jobs, public.data_quality_reports from anon, authenticated;
revoke all on sequence public.recheck_jobs_id_seq, public.data_quality_reports_id_seq from anon, authenticated;
grant all on public.recheck_jobs, public.data_quality_reports to service_role;
grant all on sequence public.recheck_jobs_id_seq, public.data_quality_reports_id_seq to service_role;

commit;

-- Rollback:
--   drop table if exists public.recheck_jobs, public.data_quality_reports;
--   alter table public.listings drop column if exists recheck_fail_count, drop column if exists recheck_last_status,
--     drop column if exists recheck_last_reason, drop column if exists recheck_last_at, drop column if exists recheck_archived_at;
