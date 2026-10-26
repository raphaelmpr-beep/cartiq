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

-- ─── Per-ZIP paid placement (AutoTrader/CarGurus style) ────────────────────
-- A dealer reserves ZIPs per product; billing is a Stripe subscription item per product
-- with quantity = number of ZIPs (graduated tiers configured in Stripe, not here).
-- ZIPs are an add-on to an active Featured/Insights base plan; no standalone ZIP purchase.
alter table public.dealer_subscriptions
  add column if not exists zip_featured_quantity integer not null default 0,
  add column if not exists zip_listings_quantity integer not null default 0;

create table if not exists public.dealer_zip_placements (
  id         bigserial primary key,
  dealer_id  integer not null references public.dealers(id),
  zip        text not null check (zip ~ '^[0-9]{5}$'),
  product    text not null check (product in ('featured_dealer','featured_listings')),
  -- pending  = reserved, not yet paid (holds a slot for 24h)
  -- active   = paid: within the subscription item's quantity, subscription active/trialing, claim approved
  -- inactive = subscription ended / unpaid / over quantity after a downgrade
  status     text not null default 'pending' check (status in ('pending','active','inactive')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (dealer_id, zip, product)
);
create index if not exists dzp_zip_product on public.dealer_zip_placements(zip, product, status);

create table if not exists public.dealer_zip_listings (     -- selected listings for featured_listings
  placement_id bigint not null references public.dealer_zip_placements(id) on delete cascade,
  listing_id   integer not null references public.listings(id) on delete cascade,
  primary key (placement_id, listing_id)
);

alter table public.dealer_zip_placements enable row level security;
alter table public.dealer_zip_listings   enable row level security;
revoke all on public.dealer_zip_placements, public.dealer_zip_listings from anon, authenticated;
revoke all on sequence public.dealer_zip_placements_id_seq from anon, authenticated;
grant select on public.dealer_zip_placements, public.dealer_zip_listings to authenticated;
-- Writes only via the RPCs below (capacity + ownership enforced there) or service role.
drop policy if exists dzp_select_own on public.dealer_zip_placements;
create policy dzp_select_own on public.dealer_zip_placements for select to authenticated
  using (dealer_id = public.my_approved_dealer_id());
drop policy if exists dzl_select_own on public.dealer_zip_listings;
create policy dzl_select_own on public.dealer_zip_listings for select to authenticated
  using (placement_id in (select id from public.dealer_zip_placements where dealer_id = public.my_approved_dealer_id()));

-- Capacity rule (single place to change it)
create or replace function public.zip_slot_capacity(p_product text)
returns integer language sql immutable set search_path = public, pg_temp as $$
  select case p_product when 'featured_dealer' then 3 when 'featured_listings' then 3 end;
$$;
create or replace function public.zip_listing_cap()
returns integer language sql immutable set search_path = public, pg_temp as $$ select 5 $$;

-- Slots taken = active rows + pending reservations younger than 24h.
create or replace function public._zip_slots_taken(p_zip text, p_product text, p_exclude_dealer integer default null)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.dealer_zip_placements
  where zip = p_zip and product = p_product
    and (p_exclude_dealer is null or dealer_id <> p_exclude_dealer)
    and (status = 'active' or (status = 'pending' and created_at > now() - interval '24 hours'));
$$;

-- Public availability (no dealer identities).
create or replace function public.get_zip_availability(p_zips text[])
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('zip', z, 'product', p,
           'capacity', public.zip_slot_capacity(p),
           'slots_left', greatest(0, public.zip_slot_capacity(p) - public._zip_slots_taken(z, p, public.my_approved_dealer_id())),
           'sold_out', public._zip_slots_taken(z, p, public.my_approved_dealer_id()) >= public.zip_slot_capacity(p))), '[]'::jsonb)
  from unnest(p_zips[1:50]) z, unnest(array['featured_dealer','featured_listings']) p
  where z ~ '^[0-9]{5}$';
$$;

-- First come, first served: serialized per zip+product with an advisory lock.
create or replace function public.reserve_zip_placement(p_zip text, p_product text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare d integer := public.my_approved_dealer_id(); cur text;
begin
  if d is null then raise exception 'approved claim required' using errcode = '42501'; end if;
  -- ZIPs are an add-on: an active/trialing Featured or Insights base plan is required.
  if public.my_plan() is null then raise exception 'base plan required' using errcode = '42501', hint = 'base_plan_required'; end if;
  if p_zip !~ '^[0-9]{5}$' or p_product not in ('featured_dealer','featured_listings') then
    raise exception 'bad zip or product' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('zip:'||p_zip||':'||p_product));
  select status into cur from dealer_zip_placements where dealer_id=d and zip=p_zip and product=p_product;
  if cur = 'active' then return 'active'; end if;
  if public._zip_slots_taken(p_zip, p_product, d) >= public.zip_slot_capacity(p_product) then
    raise exception 'sold out' using errcode = 'P0001', hint = 'sold_out'; end if;
  insert into dealer_zip_placements(dealer_id, zip, product, status) values (d, p_zip, p_product, 'pending')
  on conflict (dealer_id, zip, product) do update set status = 'pending', created_at = now(), activated_at = null;
  return 'pending';
end $$;

create or replace function public.release_zip_placement(p_zip text, p_product text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare d integer := public.my_approved_dealer_id();
begin
  if d is null then raise exception 'approved claim required' using errcode = '42501'; end if;
  delete from dealer_zip_placements where dealer_id=d and zip=p_zip and product=p_product;
end $$;

create or replace function public.set_zip_listings(p_zip text, p_listing_ids integer[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare d integer := public.my_approved_dealer_id(); pid bigint;
begin
  if d is null then raise exception 'approved claim required' using errcode = '42501'; end if;
  if coalesce(array_length(p_listing_ids,1),0) > public.zip_listing_cap() then
    raise exception 'at most % listings per zip', public.zip_listing_cap() using errcode = '22023'; end if;
  select id into pid from dealer_zip_placements where dealer_id=d and zip=p_zip and product='featured_listings';
  if pid is null then raise exception 'reserve this zip for featured listings first' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_listing_ids) x where not exists
             (select 1 from listings l where l.id = x and l.dealer_id = d)) then
    raise exception 'listing not yours' using errcode = '42501'; end if;
  delete from dealer_zip_listings where placement_id = pid;
  insert into dealer_zip_listings(placement_id, listing_id) select distinct pid, x from unnest(p_listing_ids) x;
end $$;

-- Called by the webhook (service role) after dealer_subscriptions is upserted.
-- Oldest reservations win up to the paid quantity; everything else pending/inactive.
create or replace function public.sync_zip_placements(p_dealer_id integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare live boolean; qf int; ql int;
begin
  select s.status in ('active','trialing') and s.plan in ('featured','insights') and exists (select 1 from dealer_accounts a where a.dealer_id = s.dealer_id and a.status='approved'),
         s.zip_featured_quantity, s.zip_listings_quantity
    into live, qf, ql from dealer_subscriptions s where s.dealer_id = p_dealer_id;
  live := coalesce(live, false);
  with ranked as (
    select id, product, status, row_number() over (partition by product order by
             (status='active') desc, created_at, id) rn
    from dealer_zip_placements where dealer_id = p_dealer_id)
  update dealer_zip_placements z set
    status = case
      when live and r.rn <= case r.product when 'featured_dealer' then coalesce(qf,0) else coalesce(ql,0) end then 'active'
      when r.status = 'pending' and z.created_at > now() - interval '24 hours' then 'pending'
      else 'inactive' end,
    activated_at = case when live and r.rn <= case r.product when 'featured_dealer' then coalesce(qf,0) else coalesce(ql,0) end
                        then coalesce(z.activated_at, now()) else null end
  from ranked r where r.id = z.id;
end $$;

-- Placement: what to show a searcher in a zip. Public. Labelled 'Featured'.
-- Live only if placement active AND subscription active/trialing WITH a base plan AND claim approved (checked at read time too).
create or replace function public.get_featured_for_zip(p_zip text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with live as (
    select z.* from dealer_zip_placements z
    join dealer_subscriptions s on s.dealer_id = z.dealer_id and s.status in ('active','trialing')
                               and s.plan in ('featured','insights')   -- base plan required
    join dealer_accounts a on a.dealer_id = z.dealer_id and a.status = 'approved'
    where z.zip = p_zip and z.status = 'active')
  select jsonb_build_object('zip', p_zip, 'label', 'Featured',
    'dealers', coalesce((select jsonb_agg(jsonb_build_object('label','Featured','dealer_id',d.id,'name',d.name,'slug',d.slug,
                 'city',d.city,'state',d.state,'phone',d.phone,'logo_url',d.logo_url) order by l.activated_at, l.id)
               from live l join dealers d on d.id = l.dealer_id where l.product = 'featured_dealer'), '[]'::jsonb),
    'listings', coalesce((select jsonb_agg(jsonb_build_object('label','Featured','listing_id',li.id,'dealer_id',li.dealer_id,
                 'title',li.title,'brand',li.brand,'model',li.model,'year',li.year,'price',coalesce(li.sale_price,li.asking_price),
                 'city',li.city,'state',li.state,'image_url',li.image_url) order by l.activated_at, li.id)
               from live l join dealer_zip_listings x on x.placement_id = l.id
               join listings li on li.id = x.listing_id and li.dealer_id = l.dealer_id
                 and coalesce(li.public_listing, true) and coalesce(li.status,'active') = 'active'
               where l.product = 'featured_listings'), '[]'::jsonb))
  where p_zip ~ '^[0-9]{5}$';
$$;

revoke all on function public.zip_slot_capacity(text), public.zip_listing_cap(), public._zip_slots_taken(text,text,integer),
  public.get_zip_availability(text[]), public.reserve_zip_placement(text,text), public.release_zip_placement(text,text),
  public.set_zip_listings(text,integer[]), public.sync_zip_placements(integer), public.get_featured_for_zip(text)
  from public, anon, authenticated;
grant execute on function public.get_zip_availability(text[]), public.reserve_zip_placement(text,text),
  public.release_zip_placement(text,text), public.set_zip_listings(text,integer[]) to authenticated;
grant execute on function public.get_featured_for_zip(text), public.sync_zip_placements(integer),
  public.get_zip_availability(text[]), public._zip_slots_taken(text,text,integer), public.zip_slot_capacity(text),
  public.zip_listing_cap() to service_role;
-- get_featured_for_zip is served via the server endpoint /api/featured?zip= (service role), not called by clients directly.

-- ─── Storage bucket for logos (public read; uploads go through the server) ──
insert into storage.buckets (id, name, public) values ('dealer-logos','dealer-logos', true)
on conflict (id) do nothing;

commit;
