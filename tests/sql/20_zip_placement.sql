-- Per-ZIP placement tests. Runs after 10_rls_acceptance.sql (reuses dealers 1-4, users a/b/c).
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as
$$ begin if not coalesce(cond,false) then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, false); end $$;

-- 4 approved dealers to test the 3-per-zip cap
insert into auth.users values ('00000000-0000-0000-0000-00000000000d','d@d.com');
insert into dealer_accounts(user_id,dealer_id,status) values ('00000000-0000-0000-0000-00000000000d',4,'approved');
update dealer_accounts set status='approved' where dealer_id=3;
update dealer_subscriptions set status='active', plan='featured', zip_featured_quantity=0, zip_listings_quantity=0;
insert into dealer_subscriptions(dealer_id,status,plan) values (4,'active','featured');
insert into listings(id,dealer_id,brand,state,title) values (15,1,'Evolution','FL','A cart 2'),(16,1,'Icon','FL','A cart 3');

-- Capacity: first three dealers get 32162, the fourth is sold out
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok(public.reserve_zip_placement('32162','featured_dealer')='pending', 'A reserves 32162');
select public.reserve_zip_placement('32163','featured_dealer');
select public.reserve_zip_placement('32162','featured_listings');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated; select public.reserve_zip_placement('32162','featured_dealer'); reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated; select public.reserve_zip_placement('32162','featured_dealer'); reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); set role authenticated;
do $$ begin perform public.reserve_zip_placement('32162','featured_dealer'); raise exception 'FAIL: 4th dealer got slot';
  exception when raise_exception then raise notice 'PASS: 4th dealer in 32162 is sold out'; end $$;
select pg_temp.ok((select (e->>'sold_out')::boolean and (e->>'slots_left')::int=0 from jsonb_array_elements(public.get_zip_availability(array['32162'])) e where e->>'product'='featured_dealer'), 'availability shows 32162 sold out to D');
select pg_temp.ok((select not (e->>'sold_out')::boolean from jsonb_array_elements(public.get_zip_availability(array['32162'])) e where e->>'product'='featured_listings'), 'featured_listings in 32162 still open');
select pg_temp.ok(public.get_zip_availability(array['32162'])::text not like '%Carts%', 'availability leaks no dealer names');
-- RLS isolation: D sees none of A/B/C placements; cannot write directly
select pg_temp.ok((select count(*) from dealer_zip_placements)=0, 'D sees 0 placement rows of others');
do $$ begin insert into dealer_zip_placements(dealer_id,zip,product,status) values (4,'32162','featured_dealer','active'); raise exception 'FAIL';
  exception when insufficient_privilege then raise notice 'PASS: no direct insert into placements'; end $$;
do $$ begin update dealer_zip_placements set status='active'; raise exception 'FAIL';
  exception when insufficient_privilege then raise notice 'PASS: no direct update of placements'; end $$;
reset role;

-- Listing selection: own listings only, cap 5
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select public.set_zip_listings('32162', array[11,15]);
select pg_temp.ok((select count(*) from dealer_zip_listings)=2, 'A selected 2 own listings');
do $$ begin perform public.set_zip_listings('32162', array[12]); raise exception 'FAIL';
  exception when insufficient_privilege then raise notice 'PASS: cannot feature another dealer''s listing'; end $$;
do $$ begin perform public.set_zip_listings('32162', array[11,15,16,11,15,16]); raise exception 'FAIL';
  exception when invalid_parameter_value then raise notice 'PASS: more than 5 listings rejected'; end $$;
reset role;

-- Not paid yet => nothing placed
select pg_temp.ok(jsonb_array_length(public.get_featured_for_zip('32162')->'dealers')=0, 'pending (unpaid) reservations are not placed');

-- Quantity sync (webhook writes quantity, then sync): A pays for 1 featured zip + 1 listings zip
update dealer_subscriptions set zip_featured_quantity=1, zip_listings_quantity=1 where dealer_id=1;
select public.sync_zip_placements(1);
select pg_temp.ok((select status from dealer_zip_placements where dealer_id=1 and zip='32162' and product='featured_dealer')='active', 'qty 1: oldest zip 32162 active');
select pg_temp.ok((select status from dealer_zip_placements where dealer_id=1 and zip='32163')='pending', 'qty 1: second zip stays pending (unpaid)');
update dealer_subscriptions set zip_featured_quantity=2 where dealer_id=1; select public.sync_zip_placements(1);
select pg_temp.ok((select count(*) from dealer_zip_placements where dealer_id=1 and product='featured_dealer' and status='active')=2, 'qty 2: both zips active');
update dealer_subscriptions set zip_featured_quantity=1 where dealer_id=1; select public.sync_zip_placements(1);
select pg_temp.ok((select count(*) from dealer_zip_placements where dealer_id=1 and product='featured_dealer' and status='active')=1
  and (select status from dealer_zip_placements where dealer_id=1 and zip='32162' and product='featured_dealer')='active', 'downgrade to qty 1 keeps the older active zip');

select pg_temp.ok((select f->'dealers'->0->>'label'='Featured' and f->'dealers'->0->>'name'='A Carts Renamed'
  and jsonb_array_length(f->'listings')=2 and f->'listings'->0->>'label'='Featured' from (select public.get_featured_for_zip('32162') f) x), 'placement returns A (Featured) + 2 featured listings');
select pg_temp.ok(jsonb_array_length(public.get_featured_for_zip('99999')->'dealers')=0, 'other zip returns nothing');

-- Claim revoked => off immediately even before sync
update dealer_accounts set status='rejected' where dealer_id=1;
select pg_temp.ok(jsonb_array_length(public.get_featured_for_zip('32162')->'dealers')=0, 'unapproved claim removes placement');
update dealer_accounts set status='approved' where dealer_id=1;

-- Expired subscription removes placement and frees the slot
update dealer_subscriptions set status='canceled' where dealer_id=1;
select pg_temp.ok(jsonb_array_length(public.get_featured_for_zip('32162')->'dealers')=0 and jsonb_array_length(public.get_featured_for_zip('32162')->'listings')=0, 'canceled subscription => no placement (read-time check)');
select public.sync_zip_placements(1);
select pg_temp.ok((select bool_and(status<>'active') from dealer_zip_placements where dealer_id=1), 'sync after cancel => no active placements');
update dealer_zip_placements set created_at = now() - interval '2 days' where dealer_id in (1,2,3) and status <> 'active';
select public.sync_zip_placements(1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select pg_temp.ok(public.reserve_zip_placement('32162','featured_dealer')='pending', 'expired/stale holds free the slot; D can now reserve 32162');
reset role;
select pg_temp.ok(not has_function_privilege('anon','public.get_featured_for_zip(text)','execute'), 'anon cannot call placement RPC directly (server endpoint only)');

-- Base plan required (no standalone ZIP purchase)
update dealer_subscriptions set status='active', plan='insights' where dealer_id=1; select public.sync_zip_placements(1);
select pg_temp.ok(jsonb_array_length(public.get_featured_for_zip('32162')->'dealers')=1, 'base plan active => A placed again');
update dealer_subscriptions set plan=null where dealer_id=1;   -- ZIP-only subscription (base item removed)
select pg_temp.ok(jsonb_array_length(public.get_featured_for_zip('32162')->'dealers')=0, 'no base plan => placement refused at read time');
select public.sync_zip_placements(1);
select pg_temp.ok((select bool_and(status<>'active') from dealer_zip_placements where dealer_id=1), 'no base plan => sync turns ZIPs off');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin perform public.reserve_zip_placement('32170','featured_dealer'); raise exception 'FAIL';
  exception when insufficient_privilege then raise notice 'PASS: no base plan => cannot reserve a ZIP'; end $$;
reset role;
update dealer_subscriptions set plan='featured', status='canceled' where dealer_id=1;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin perform public.reserve_zip_placement('32170','featured_dealer'); raise exception 'FAIL';
  exception when insufficient_privilege then raise notice 'PASS: canceled base plan => cannot reserve a ZIP'; end $$;
reset role;
select public.sync_zip_placements(1);
select pg_temp.ok(jsonb_array_length(public.get_featured_for_zip('32162')->'dealers')=0 and (select bool_and(status<>'active') from dealer_zip_placements where dealer_id=1), 'canceled base plan => ZIPs come off');
select pg_temp.ok(public.zip_slot_capacity('featured_dealer')=3 and public.zip_slot_capacity('featured_listings')=3, 'capacity 3 per ZIP for both products');
\echo ALL_ZIP_TESTS_PASSED
