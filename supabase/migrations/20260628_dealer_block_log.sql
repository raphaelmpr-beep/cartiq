-- ─── CartIQ: Dealer Block Log ─────────────────────────────────────────────────
-- Tracks blocked/inaccessible dealer inventory sources.
-- Populated when a sync attempt results in 401/403/402/0 or robots.txt denial.

create table if not exists public.dealer_block_log (
  id                    bigserial primary key,
  dealer_slug           text        not null,
  dealer_name           text,
  inventory_url         text        not null,
  block_reason          text        not null,  -- 'http_403' | 'http_402' | 'dns_failure' | 'robots_txt' | 'captcha' | 'ssl_error' | 'timeout'
  http_status           integer,               -- raw HTTP status code, 0 = DNS/network failure
  error_message         text,
  screenshot_url        text,                  -- optional screenshot stored in Supabase storage
  robots_txt_disallows  boolean     not null default false,
  attempted_at          timestamptz not null default now(),
  -- Outreach / manual fallback tracking
  outreach_status       text        not null default 'not_started',  -- 'not_started' | 'contacted' | 'partner_feed' | 'permission_granted' | 'opted_out'
  outreach_notes        text,
  outreach_contacted_at timestamptz,
  outreach_contact_name text,
  outreach_contact_email text,
  -- Resolution
  resolved              boolean     not null default false,
  resolved_at           timestamptz,
  resolved_notes        text,
  -- Meta
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- One active block record per dealer (latest attempt wins via upsert on dealer_slug)
  unique (dealer_slug)
);

create index if not exists idx_dealer_block_log_slug
  on public.dealer_block_log (dealer_slug);

create index if not exists idx_dealer_block_log_outreach
  on public.dealer_block_log (outreach_status, resolved);

-- RLS
alter table public.dealer_block_log enable row level security;

create policy "Allow anon read block log"
  on public.dealer_block_log for select using (true);

create policy "Allow anon insert block log"
  on public.dealer_block_log for insert with check (true);

create policy "Allow anon update block log"
  on public.dealer_block_log for update using (true);
