-- ─── Homepage CTR Telemetry ────────────────────────────────────────────────────
-- Tracks impressions and clicks for listings served in the homepage carousel.
-- Raw events are written per-listing. A daily aggregation view/table is derived
-- from these for the weekly email report.

-- 1. Raw event log — one row per impression or click
create table if not exists public.homepage_events (
  id             bigserial primary key,
  event_type     text        not null,   -- 'impression' | 'click'
  listing_id     integer     not null,
  dealer_id      integer,
  city           text,
  state          text,
  brand          text,
  is_featured    boolean     not null default false,
  position       integer,               -- 0-based index in carousel
  session_id     text,                  -- anonymous browser session token
  created_at     timestamptz not null default now()
);

-- Index for fast daily aggregation queries
create index if not exists idx_homepage_events_date
  on public.homepage_events (date_trunc('day', created_at), dealer_id, is_featured);

create index if not exists idx_homepage_events_listing
  on public.homepage_events (listing_id, event_type, created_at);

-- 2. Daily aggregation table — populated by a server-side job
--    Stores pre-computed CTR per dealer+city+featured combo per day.
create table if not exists public.homepage_ctr_daily (
  id             bigserial primary key,
  date           date        not null,
  dealer_id      integer,
  dealer_name    text,
  city           text,
  state          text,
  is_featured    boolean     not null default false,
  impressions    integer     not null default 0,
  clicks         integer     not null default 0,
  ctr_pct        numeric(5,2) generated always as (
    case when impressions > 0 then round(clicks::numeric / impressions * 100, 2) else 0 end
  ) stored,
  created_at     timestamptz not null default now(),
  unique (date, dealer_id, city, is_featured)
);

create index if not exists idx_homepage_ctr_daily_date
  on public.homepage_ctr_daily (date desc, ctr_pct desc);

-- Enable Row Level Security (allow anon inserts for event tracking)
alter table public.homepage_events    enable row level security;
alter table public.homepage_ctr_daily enable row level security;

-- Policy: anyone can insert events (fire-and-forget telemetry)
create policy "Allow anon insert events"
  on public.homepage_events for insert
  with check (true);

-- Policy: anyone can read events (admin uses same anon key)
create policy "Allow anon read events"
  on public.homepage_events for select
  using (true);

-- Policy: server can insert/update daily aggregations
create policy "Allow anon insert ctr_daily"
  on public.homepage_ctr_daily for insert
  with check (true);

create policy "Allow anon upsert ctr_daily"
  on public.homepage_ctr_daily for update
  using (true);

create policy "Allow anon read ctr_daily"
  on public.homepage_ctr_daily for select
  using (true);
