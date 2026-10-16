-- DRAFT ONLY. NOT APPLIED. Needs Database Engineer review and owner (Raphael) approval before apply.
-- Optional run log for /api/cron/ingest. The cron works without it: the stall rule reads
-- max(pending_imports.found_at, listings.created_at) (read-only). This table would let "last run failed"
-- survive across invocations instead of being per-run only.
create table if not exists public.ingest_cron_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  run_ok boolean,
  inserted_count integer,
  error_summary text,
  alert_sent boolean not null default false
);
alter table public.ingest_cron_runs enable row level security; -- service role only; no public policies
