-- Apply only after deployment approval. No historical events are fabricated.
begin;
create table if not exists public.comp_verifications (
  listing_id bigint primary key references public.listings(id) on delete cascade,
  dealer_id bigint not null references public.dealers(id),
  source_url text not null check (source_url ~ '^https?://'),
  source_price numeric not null check (source_price between 500 and 100000),
  checked_at timestamptz not null check (checked_at <= now()),
  valid_vehicle boolean not null default false,
  branch_verified boolean not null default false,
  in_stock boolean not null default false,
  evidence_excerpt text not null check (length(evidence_excerpt) >= 20),
  verified_by text not null
);
create table if not exists public.growth_events (
  event_id uuid primary key,
  session_id uuid not null,
  event_type text not null check (event_type in ('estimator_view','estimator_complete','comps_view','comp_click','listing_view','dealer_contact_click')),
  listing_id bigint,
  channel text check (channel in ('phone','email','website')),
  created_at timestamptz not null default now()
);
create index if not exists growth_events_date_idx on public.growth_events(created_at);
create table if not exists public.search_performance_snapshots (
  start_date date not null, end_date date not null,
  impressions bigint not null check(impressions >= 0),
  clicks bigint not null check(clicks >= 0 and clicks <= impressions),
  imported_at timestamptz not null default now(),
  primary key(start_date,end_date), check(end_date >= start_date)
);
alter table public.comp_verifications enable row level security;
alter table public.growth_events enable row level security;
alter table public.search_performance_snapshots enable row level security;
revoke all on public.comp_verifications, public.growth_events, public.search_performance_snapshots from anon, authenticated;
grant all on public.comp_verifications, public.growth_events, public.search_performance_snapshots to service_role;
create or replace function public.growth_scorecard(start_at timestamptz, end_at timestamptz)
returns table(event_type text, events bigint, sessions bigint)
language sql stable security invoker set search_path=public as $$
 select event_type, count(*), count(distinct session_id) from public.growth_events
 where created_at >= start_at and created_at < end_at group by event_type;
$$;
revoke all on function public.growth_scorecard(timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.growth_scorecard(timestamptz,timestamptz) to service_role;
commit;
