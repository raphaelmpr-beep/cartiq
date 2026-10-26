-- ============================================================================
-- 20261026_dealer_self_serve.sql
-- GolfCartIQ Dealer Self-Serve Checkout + Dealer Portal (MVP)
--
-- NOT YET APPLIED. Review before running on CartIQ production.
-- Safe to re-run (idempotent guards). Wrapped in a single transaction.
--
-- Creates: dealer_accounts, dealer_subscriptions, stripe_events, site_events
-- Alters:  dealers (+logo_url, brands_carried, profile_description)
-- RLS:     on all new tables; on the 5 *_backup_20261016 tables (no policies
--          => anon/authenticated get nothing; service role unaffected)
-- RPCs:    security definer, search_path pinned, dealer derived from auth.uid()
-- Storage: public-read bucket "dealer-logos" (writes via server/service role)
-- ============================================================================
begin;

-- ─── Tables (from brief) ────────────────────────────────────────────────────
create table if not exists public.dealer_accounts (            -- user ↔ dealer link (the "claim")
  user_id     uuid primary key references auth.users(id) on delete cascade,
  dealer_id   integer references public.dealers(id),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  -- Added vs brief: "submit a new dealer" needs somewhere to hold the submission
  -- until an admin creates the dealers row and sets dealer_id.
  submitted_dealer jsonb,
  claimant_email   text,
  created_at  timestamptz default now(),
  approved_at timestamptz,
  approved_by text,
  constraint dealer_accounts_target check (dealer_id is not null or submitted_dealer is not null)
);
-- One approved owner per dealer.
create unique index if not exists dealer_accounts_one_approved_owner
  on public.dealer_accounts(dealer_id) where status = 'approved';

create table if not exists public.dealer_subscriptions (
  dealer_id              integer primary key references public.dealers(id),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  plan                   text check (plan in ('featured','insights')),
  status                 text,   -- mirrors Stripe: active, trialing, past_due, canceled, ...
  cancel_at_period_end   boolean not null default false,  -- added: needed to show "cancels on {date}"
  current_period_end     timestamptz,
  updated_at             timestamptz default now()
);

create table if not exists public.stripe_events (
  id          text primary key,
  received_at timestamptz default now()
);

alter table public.dealers
  add column if not exists logo_url text,
  add column if not exists brands_carried text[],
  add column if not exists profile_description text;

create table if not exists public.site_events (
  id           bigserial primary key,
  event_type   text not null check (event_type in ('dealer_profile_view','listing_view','lead_click','search')),
  dealer_id    integer,
  listing_id   integer,
  brand        text,
  state        text,
  city         text,
  search_query text,
  lead_type    text check (lead_type is null or lead_type in ('phone','email','website','directions')), -- added: brief lists lead_click "type"
  session_id   text,
  created_at   timestamptz default now()
);
create index if not exists site_events_type_dealer_time on public.site_events(event_type, dealer_id, created_at);
create index if not exists site_events_type_state_time  on public.site_events(event_type, state, created_at);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.dealer_accounts      enable row level security;
alter table public.dealer_subscriptions enable row level security;
alter table public.stripe_events        enable row level security;
alter table public.site_events          enable row level security;

revoke all on public.dealer_accounts, public.dealer_subscriptions,
              public.stripe_events, public.site_events from anon, authenticated;
revoke all on sequence public.site_events_id_seq from anon, authenticated;

grant select on public.dealer_accounts to authenticated;
grant insert (user_id, dealer_id, submitted_dealer, claimant_email) on public.dealer_accounts to authenticated;
grant select on public.dealer_subscriptions to authenticated;
-- stripe_events / site_events: no client grants at all (server/service role only).

drop policy if exists dealer_accounts_select_own on public.dealer_accounts;
create policy dealer_accounts_select_own on public.dealer_accounts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists dealer_accounts_insert_pending on public.dealer_accounts;
create policy dealer_accounts_insert_pending on public.dealer_accounts
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending'
              and approved_at is null and approved_by is null);
-- No update/delete policy => only service role (admin) can approve/reject.

drop policy if exists dealer_subscriptions_select_approved on public.dealer_subscriptions;
create policy dealer_subscriptions_select_approved on public.dealer_subscriptions
  for select to authenticated using (
    dealer_id in (select da.dealer_id from public.dealer_accounts da
                  where da.user_id = auth.uid() and da.status = 'approved'));

-- Backup tables from 2026-10-16: RLS on, no policies, no client grants.
do $$
declare t text;
begin
  foreach t in array array['dealers_backup_20261016','dealers_contact_backup_20261016',
                           'listings_battery_backup_20261016','listings_price_backup_20261016',
                           'listings_warranty_backup_20261016'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ─── Helpers ─────────────────────────────────────────────────────────────────
-- Placement/badge check: approved claim AND active/trialing subscription. No separate flag.
create or replace function public.dealer_is_featured(p_dealer_id integer)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.dealer_subscriptions s
    join public.dealer_accounts a on a.dealer_id = s.dealer_id and a.status = 'approved'
    where s.dealer_id = p_dealer_id and s.status in ('active','trialing'));
$$;

-- The caller's approved dealer id (null if none). Never takes a dealer id.
create or replace function public.my_approved_dealer_id()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select dealer_id from public.dealer_accounts
  where user_id = auth.uid() and status = 'approved' limit 1;
$$;

create or replace function public.my_plan()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select s.plan from public.dealer_subscriptions s
  where s.dealer_id = public.my_approved_dealer_id() and s.status in ('active','trialing');
$$;

-- Honesty gate: a metric is shown only with >= 14 days of tracking and >= 20 events.
create or replace function public._metric(p_value bigint, p_tracking_since timestamptz)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select case
    when p_tracking_since is null then jsonb_build_object('status','insufficient','tracking_since',null)
    when p_tracking_since > now() - interval '14 days' or p_value < 20
      then jsonb_build_object('status','insufficient','tracking_since',p_tracking_since)
    else jsonb_build_object('status','ok','value',p_value,'tracking_since',p_tracking_since)
  end;
$$;

create or replace function public._tracking_since(p_event_type text)
returns timestamptz language sql stable security definer set search_path = public, pg_temp as $$
  select min(created_at) from public.site_events where event_type = p_event_type;
$$;

-- ─── Profile edit (whitelisted columns only) ────────────────────────────────
create or replace function public.update_my_dealer_profile(p jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare d integer := public.my_approved_dealer_id();
begin
  if d is null then raise exception 'no approved dealer claim' using errcode = '42501'; end if;
  update public.dealers set
    name                = case when p ? 'name'                then nullif(left(p->>'name',120),'') else name end,
    street_address      = case when p ? 'street_address'      then left(p->>'street_address',200) else street_address end,
    city                = case when p ? 'city'                then left(p->>'city',80) else city end,
    state               = case when p ? 'state'               then upper(left(p->>'state',2)) else state end,
    zip                 = case when p ? 'zip'                 then left(p->>'zip',10) else zip end,
    hours_text          = case when p ? 'hours_text'          then left(p->>'hours_text',500) else hours_text end,
    phone               = case when p ? 'phone'               then left(p->>'phone',40) else phone end,
    email               = case when p ? 'email'               then left(p->>'email',200) else email end,
    website_url         = case when p ? 'website_url'         then left(p->>'website_url',300) else website_url end,
    profile_description = case when p ? 'profile_description' then left(p->>'profile_description',2000) else profile_description end,
    brands_carried      = case when p ? 'brands_carried'
                               then (select array_agg(left(x,60)) from jsonb_array_elements_text(p->'brands_carried') x)
                               else brands_carried end,
    logo_url            = case when p ? 'logo_url'            then left(p->>'logo_url',500) else logo_url end,
    updated_at          = now()
  where id = d;
end $$;

-- ─── Metrics RPCs ────────────────────────────────────────────────────────────
-- Own-dealer metrics. Insights plan → full; Featured → teaser (2 numbers).
create or replace function public.get_dealer_metrics(days int)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  d integer := public.my_approved_dealer_id();
  pl text := public.my_plan();
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(days,30), 90)));
  pv bigint; lv bigint; lc bigint;
begin
  if d is null or pl is null then raise exception 'not authorized' using errcode = '42501'; end if;
  select count(*) into pv from site_events where event_type='dealer_profile_view' and dealer_id=d and created_at>=since;
  select count(*) into lv from site_events where event_type='listing_view'        and dealer_id=d and created_at>=since;
  select count(*) into lc from site_events where event_type='lead_click'          and dealer_id=d and created_at>=since;
  if pl = 'featured' then
    return jsonb_build_object('plan','featured','days',days,
      'profile_views', public._metric(pv, public._tracking_since('dealer_profile_view')),
      'listing_views', public._metric(lv, public._tracking_since('listing_view')));
  end if;
  return jsonb_build_object('plan','insights','days',days,
    'profile_views', public._metric(pv, public._tracking_since('dealer_profile_view')),
    'listing_views', public._metric(lv, public._tracking_since('listing_view')),
    'lead_clicks',   public._metric(lc, public._tracking_since('lead_click')),
    'lead_clicks_by_type', (
      select coalesce(jsonb_object_agg(t, public._metric(n, public._tracking_since('lead_click'))), '{}'::jsonb)
      from (select lead_type t, count(*) n from site_events
            where event_type='lead_click' and dealer_id=d and created_at>=since and lead_type is not null
            group by 1) x));
end $$;

-- Area = same state (v1). Insights only. Aggregates only; k-anonymity:
-- a brand bucket is returned only if it has >= 3 distinct dealers and >= 20 events.
-- Never returns other dealers' ids or names.
create or replace function public.get_area_metrics(days int)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  d integer := public.my_approved_dealer_id();
  st text;
  mine text[];
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(days,30), 90)));
  my_lv bigint; area_lv bigint; area_dealers bigint;
  lv_tracking timestamptz := public._tracking_since('listing_view');
  s_tracking  timestamptz := public._tracking_since('search');
  result jsonb;
begin
  if d is null or public.my_plan() is distinct from 'insights' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select state into st from dealers where id = d;
  select coalesce(array_agg(distinct lower(b)), '{}') into mine from (
    select unnest(brands_carried) b from dealers where id = d
    union select brand from listings where dealer_id = d and brand is not null) z;

  select count(*) filter (where dealer_id = d), count(*), count(distinct dealer_id)
    into my_lv, area_lv, area_dealers
    from site_events where event_type='listing_view' and state=st and created_at>=since;

  with lv as (
    select lower(brand) b, count(*) n, count(distinct dealer_id) nd from site_events
    where event_type='listing_view' and state=st and created_at>=since and brand is not null group by 1),
  -- searches carry no dealer; bucket's dealer count = distinct dealers in-state with public listings of that brand
  sr0 as (
    select lower(e.brand) b, count(*) n from site_events e
    where e.event_type='search' and e.state=st and e.created_at>=since and e.brand is not null group by 1),
  sr as (
    select sr0.b, sr0.n,
      (select count(distinct l.dealer_id) from listings l
        where l.state = st and lower(l.brand) = sr0.b and l.dealer_id is not null) nd
    from sr0)
  select jsonb_build_object(
    'area', jsonb_build_object('type','state','state',st),
    'days', days,
    'listing_views_by_brand', case when lv_tracking is null or lv_tracking > now()-interval '14 days'
        then jsonb_build_object('status','insufficient','tracking_since',lv_tracking)
        else jsonb_build_object('status','ok','tracking_since',lv_tracking,'buckets',
          coalesce((select jsonb_agg(jsonb_build_object('brand',b,'views',n,'you_stock', b = any(mine)) order by n desc)
                    from lv where nd >= 3 and n >= 20), '[]'::jsonb)) end,
    'searches_by_brand', case when s_tracking is null or s_tracking > now()-interval '14 days'
        then jsonb_build_object('status','insufficient','tracking_since',s_tracking)
        else jsonb_build_object('status','ok','tracking_since',s_tracking,'buckets',
          coalesce((select jsonb_agg(jsonb_build_object('brand',b,'searches',n,'you_stock', b = any(mine)) order by n desc)
                    from sr where nd >= 3 and n >= 20), '[]'::jsonb)) end,
    'share_of_area_listing_views', case
        when lv_tracking is null or lv_tracking > now()-interval '14 days' or area_lv < 20 or area_dealers < 3
          then jsonb_build_object('status','insufficient','tracking_since',lv_tracking)
        else jsonb_build_object('status','ok','tracking_since',lv_tracking,
               'mine', my_lv, 'area_total', area_lv, 'share', round(my_lv::numeric / area_lv, 4)) end
  ) into result;
  return result;
end $$;

-- Homepage-only metrics computable today from homepage_events (labelled as homepage-only in UI).
create or replace function public.get_homepage_metrics(days int)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  d integer := public.my_approved_dealer_id();
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(days,30), 90)));
  tracking timestamptz;
  imp bigint; clk bigint;
begin
  if d is null or public.my_plan() is distinct from 'insights' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select min(created_at) into tracking from homepage_events;
  select count(*) filter (where event_type='impression'), count(*) filter (where event_type='click')
    into imp, clk from homepage_events where dealer_id = d and created_at >= since;
  return jsonb_build_object('scope','homepage_only','days',days,
    'impressions', public._metric(imp, tracking), 'clicks', public._metric(clk, tracking));
end $$;

revoke all on function public.dealer_is_featured(integer), public.my_approved_dealer_id(), public.my_plan(),
  public._metric(bigint, timestamptz), public._tracking_since(text), public.update_my_dealer_profile(jsonb),
  public.get_dealer_metrics(int), public.get_area_metrics(int), public.get_homepage_metrics(int)
  from public, anon, authenticated;
grant execute on function public.update_my_dealer_profile(jsonb), public.get_dealer_metrics(int),
  public.get_area_metrics(int), public.get_homepage_metrics(int), public.my_approved_dealer_id(), public.my_plan()
  to authenticated;
-- dealer_is_featured: server (service role) only.
grant execute on function public.dealer_is_featured(integer), public.my_approved_dealer_id(), public.my_plan(),
  public._metric(bigint, timestamptz), public._tracking_since(text)
  to service_role;

-- ─── Storage bucket for logos (public read; uploads go through the server) ──
insert into storage.buckets (id, name, public) values ('dealer-logos','dealer-logos', true)
on conflict (id) do nothing;

commit;
