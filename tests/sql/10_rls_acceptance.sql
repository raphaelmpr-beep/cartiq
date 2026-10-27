-- RLS / RPC acceptance tests. Run as superuser after 00_supabase_stub.sql + the migration.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as
$$ begin if not coalesce(cond,false) then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, false); end $$;

insert into dealers(id,name,state,adapter_key,sync_enabled) values
 (1,'A Carts','FL','botero',true),(2,'B Carts','FL','jax',true),(3,'C Carts','FL',null,false),(4,'D Carts','FL',null,false);
insert into listings(id,dealer_id,brand,state) values (11,1,'Evolution','FL'),(12,2,'Evolution','FL'),(13,3,'Evolution','FL'),(14,4,'Icon','FL');
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','a@a.com'),
 ('00000000-0000-0000-0000-00000000000b','b@b.com'),('00000000-0000-0000-0000-00000000000c','c@c.com');
insert into dealer_accounts(user_id,dealer_id,status) values
 ('00000000-0000-0000-0000-00000000000a',1,'approved'),('00000000-0000-0000-0000-00000000000b',2,'approved'),
 ('00000000-0000-0000-0000-00000000000c',3,'pending');
insert into dealer_subscriptions(dealer_id,plan,status,stripe_customer_id) values
 (1,'insights','active','cus_A'),(2,'insights','active','cus_B'),(3,'insights','active','cus_C');

set role anon;
select pg_temp.ok((select count(*) from information_schema.role_table_grants where grantee='anon' and table_name='site_events')=0, 'anon has no grants on site_events');
do $$ begin perform 1 from site_events; raise exception 'FAIL: anon read site_events'; exception when insufficient_privilege then raise notice 'PASS: anon cannot read site_events'; end $$;
do $$ begin insert into site_events(event_type) values ('search'); raise exception 'FAIL: anon insert site_events'; exception when insufficient_privilege then raise notice 'PASS: anon cannot insert site_events'; end $$;
do $$ begin perform 1 from dealers_backup_20261016; raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: anon cannot read dealers_backup_20261016'; end $$;
do $$ begin perform public.get_dealer_metrics(30); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: anon cannot call metrics RPC'; end $$;
reset role;
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where relname like '%backup_20261016' and relnamespace='public'::regnamespace), 'all backup tables have RLS enabled');

-- Dealer A
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.ok((select count(*) from dealer_subscriptions where dealer_id<>1)=0, 'A sees 0 dealer_subscriptions rows of others');
select pg_temp.ok((select count(*) from dealer_subscriptions where dealer_id=1)=1, 'A sees own subscription');
select pg_temp.ok((select count(*) from dealer_accounts where dealer_id<>1)=0, 'A sees 0 dealer_accounts rows of others');
do $$ begin perform 1 from site_events; raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: authenticated cannot read site_events'; end $$;
do $$ begin update dealer_accounts set status='approved' where user_id=auth.uid(); if found then raise exception 'FAIL: self-approve'; end if; raise notice 'PASS: cannot self-approve (no rows)'; exception when insufficient_privilege then raise notice 'PASS: cannot self-approve'; end $$;
do $$ begin update dealer_subscriptions set status='active'; raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: client cannot write dealer_subscriptions'; end $$;
do $$ begin update dealers set adapter_key='x', sync_enabled=false where id=1;
  if found then raise exception 'FAIL: direct update dealers'; end if; raise notice 'PASS: no direct dealers update (0 rows)';
  exception when insufficient_privilege then raise notice 'PASS: no direct dealers update'; end $$;
select public.update_my_dealer_profile('{"name":"A Carts Renamed","adapter_key":"hacked","sync_enabled":false,"brands_carried":["Evolution"]}');
reset role;
select pg_temp.ok((select name='A Carts Renamed' and adapter_key='botero' and sync_enabled from dealers where id=1), 'profile RPC updates whitelisted cols only; sync fields untouched');
select pg_temp.ok((select name='B Carts' from dealers where id=2), 'A profile edit did not touch dealer B');

-- Honesty: no events yet => insufficient, no values
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select (m->'listing_views'->>'status')='insufficient' and not (m->'listing_views' ? 'value')
                   and (m->'lead_clicks'->>'status')='insufficient' from (select public.get_dealer_metrics(30) m) x), 'empty data => insufficient, no numbers');
reset role;

-- Seed events: tracking started 20 days ago
insert into site_events(event_type,dealer_id,listing_id,brand,state,created_at)
  select 'listing_view', d, d*10+1, 'Evolution','FL', now()-interval '20 days' + (g||' hours')::interval
  from generate_series(1,30) g, (values (1),(2),(3)) v(d);
insert into site_events(event_type,dealer_id,state,created_at) select 'dealer_profile_view',1,'FL', now()-interval '2 days' from generate_series(1,5);
insert into site_events(event_type,dealer_id,state,created_at) select 'dealer_profile_view',2,'FL', now()-interval '19 days' from generate_series(1,25);
insert into site_events(event_type,brand,state,created_at) select 'search','Evolution','FL', now()-interval '15 days' from generate_series(1,22);
insert into site_events(event_type,brand,state,created_at) select 'search','Icon','FL', now()-interval '15 days' from generate_series(1,40);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select (m->'listing_views'->>'value')::int = 30 from (select public.get_dealer_metrics(30) m) x), 'A listing_views=30 (own only, not B/C)');
select pg_temp.ok((select (m->'profile_views'->>'status')='insufficient' from (select public.get_dealer_metrics(30) m) x), 'A profile views 5 (<20) => insufficient');
-- k-anon excludes the caller: A + 2 competitors (only 2 OTHER dealers) => suppressed
select pg_temp.ok((select jsonb_array_length(coalesce(m->'listing_views_by_brand'->'buckets','[]'))=0
                   and not (m->'share_of_area_listing_views' ? 'area_total')
                   and (select count(*) from jsonb_array_elements(coalesce(m->'searches_by_brand'->'buckets','[]')) b where b->>'brand'='evolution')=0
                   from (select public.get_area_metrics(30) m) x), 'k-anon: caller + 2 others (2 competitors) => buckets and share suppressed');
reset role;
insert into site_events(event_type,dealer_id,listing_id,brand,state,created_at)
  select 'listing_view', 4, 41, 'Evolution','FL', now()-interval '20 days' + (g||' hours')::interval from generate_series(1,30) g;
insert into listings(id,dealer_id,brand,state) values (17,4,'Evolution','FL');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select m::text not like '%B Carts%' and m::text not like '%"dealer_id"%' from (select public.get_area_metrics(30) m) x), 'area metrics expose no dealer names/ids');
select pg_temp.ok((select jsonb_array_length(m->'listing_views_by_brand'->'buckets')=1 and (m->'share_of_area_listing_views'->>'mine')::int=30 and (m->'share_of_area_listing_views'->>'area_total')::int=120 from (select public.get_area_metrics(30) m) x), 'area listing views bucket (caller + 3 others, 120 ev) shown; share 30/120');
select pg_temp.ok((select (select count(*) from jsonb_array_elements(m->'searches_by_brand'->'buckets') b where b->>'brand'='icon')=0
                      and (select count(*) from jsonb_array_elements(m->'searches_by_brand'->'buckets') b where b->>'brand'='evolution')=1
                   from (select public.get_area_metrics(30) m) x), 'k-anon: Icon (1 dealer) suppressed, Evolution (3 other dealers) shown');
reset role;
-- spot-check 3 numbers vs hand count
select pg_temp.ok((select count(*) from site_events where event_type='listing_view' and dealer_id=1 and created_at>=now()-interval '30 days')=30, 'spot-check A listing_view count(*)=30');
select pg_temp.ok((select count(*) from site_events where event_type='listing_view' and state='FL' and created_at>=now()-interval '30 days')=120, 'spot-check area listing_view count(*)=120');
select pg_temp.ok((select count(*) from site_events where event_type='search' and brand='Evolution' and state='FL')=22, 'spot-check Evolution search count(*)=22');

-- Dealer C (pending claim, paid): no metrics, no profile edit, not featured
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated;
do $$ begin perform public.get_dealer_metrics(30); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: pending claim cannot read metrics'; end $$;
do $$ begin perform public.update_my_dealer_profile('{"name":"x"}'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: pending claim cannot edit profile'; end $$;
select pg_temp.ok((select count(*) from dealer_subscriptions)=0, 'pending claim sees no subscription rows');
do $$ begin insert into dealer_accounts(user_id,dealer_id,status) values (auth.uid(),4,'approved'); raise exception 'FAIL'; exception when unique_violation or insufficient_privilege or check_violation then raise notice 'PASS: cannot insert approved claim'; end $$;
reset role;
select pg_temp.ok(not public.dealer_is_featured(3), 'pending claim with active sub is NOT featured');
select pg_temp.ok(public.dealer_is_featured(1), 'approved + active => featured');
update dealer_subscriptions set status='canceled' where dealer_id=1;
select pg_temp.ok(not public.dealer_is_featured(1), 'canceled => not featured');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin perform public.get_dealer_metrics(30); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: canceled => dashboard off'; end $$;
reset role;
update dealer_subscriptions set status='active', plan='featured' where dealer_id=1;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select m->>'plan'='featured' and not (m ? 'lead_clicks') from (select public.get_dealer_metrics(30) m) x), 'featured => teaser only (2 numbers)');
do $$ begin perform public.get_area_metrics(30); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS: featured cannot read area metrics'; end $$;
reset role;
update dealer_subscriptions set plan='insights' where dealer_id=1;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select m->>'plan'='insights' from (select public.get_dealer_metrics(30) m) x), 'featured->insights upgrade unlocks dashboard');
reset role;
\echo ALL_SQL_TESTS_PASSED
