-- GolfCartIQ: dealer_block_log (auto-pause registry for blocked/limited dealer sites)
-- Apply in the Supabase SQL editor. Idempotent. Service-role only (no anon/authenticated access).
-- Based on the June 28 design + Sep 23 service-role-only draft, plus host / paused_until / failure_count / source.

create table if not exists public.dealer_block_log (
  id                     bigserial primary key,
  dealer_slug            text        not null unique,
  dealer_name            text,
  inventory_url          text        not null,
  host                   text,
  block_reason           text        not null,  -- http_401|http_402|http_403|http_429|http_503|challenge|policy_crawl_delay|circuit_open|robots_txt|dns_failure|ssl_error|timeout
  http_status            integer,
  error_message          text,
  robots_txt_disallows   boolean     not null default false,
  failure_count          integer     not null default 1,
  paused_until           timestamptz,           -- null = paused until a human resolves; set = Retry-After window
  source                 text,                  -- recheck | sync | manual
  attempted_at           timestamptz not null default now(),
  outreach_status        text        not null default 'not_started', -- not_started|contacted|partner_feed|permission_granted|opted_out
  outreach_notes         text,
  outreach_contacted_at  timestamptz,
  outreach_contact_name  text,
  outreach_contact_email text,
  resolved               boolean     not null default false,
  resolved_at            timestamptz,
  resolved_notes         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
-- If an older copy exists, add the new columns.
alter table public.dealer_block_log add column if not exists host text;
alter table public.dealer_block_log add column if not exists failure_count integer not null default 1;
alter table public.dealer_block_log add column if not exists paused_until timestamptz;
alter table public.dealer_block_log add column if not exists source text;

create index if not exists idx_dealer_block_log_active on public.dealer_block_log (resolved, paused_until);
create index if not exists idx_dealer_block_log_outreach on public.dealer_block_log (outreach_status, resolved);

alter table public.dealer_block_log enable row level security;
drop policy if exists "Allow anon read block log" on public.dealer_block_log;
drop policy if exists "Allow anon insert block log" on public.dealer_block_log;
drop policy if exists "Allow anon update block log" on public.dealer_block_log;
revoke all on public.dealer_block_log from anon, authenticated;
grant all on public.dealer_block_log to service_role;
grant usage, select on sequence public.dealer_block_log_id_seq to service_role;

-- Rollback:
--   drop table if exists public.dealer_block_log;
