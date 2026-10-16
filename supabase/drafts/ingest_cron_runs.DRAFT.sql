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
  alert_sent boolean not null default false,
  alert_message_id text, -- Resend message id of the owner alert; SRE flags alert_sent and alert_message_id is null
  constraint ingest_cron_runs_finished_after_started check (finished_at is null or finished_at >= started_at)
);
alter table public.ingest_cron_runs enable row level security; -- service role only; no public policies

-- Second layer on top of RLS: Supabase default grants give new tables/sequences to anon + authenticated.
revoke all on public.ingest_cron_runs from anon, authenticated;
revoke all on sequence public.ingest_cron_runs_id_seq from anon, authenticated;

-- Stall check and "last run failed" both read the newest run.
create index if not exists ingest_cron_runs_started_at_desc_idx on public.ingest_cron_runs (started_at desc);

-- Oldest-pending alert reads the oldest row awaiting review.
-- UNKNOWN: column name (found_at) and status value ('pending') are guesses until the Database Engineer
-- confirms GolfCartIQ's actual pending_imports schema. Do not apply until confirmed.
create index if not exists pending_imports_pending_found_at_idx on public.pending_imports (found_at) where status = 'pending';
