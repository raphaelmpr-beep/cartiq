-- 20261015_lock_down_anon_rls.sql
-- Lock down anon/publishable access. NOT YET APPLIED.
--
-- ROLLOUT ORDER (do not reverse):
--   1. Deploy the code that moves all server-side access to SUPABASE_SERVICE_ROLE_KEY
--      (sb_secret_...) and verify production (pages, /api/listings, admin, sync).
--   2. Apply this migration.
--   3. Re-verify city/brand pages (the only browser-side Supabase reads) and admin.
--
-- After this migration the anon role (publishable key) can only SELECT the
-- listings columns the public city/brand pages fetch, and only rows that are
-- status='active' AND public_listing=true. No anon/authenticated
-- INSERT/UPDATE/DELETE anywhere. service_role bypasses RLS and is unaffected.

begin;

-- 1. RLS on for every public table, and drop every existing policy
--    (several were "USING (true)" for INSERT/UPDATE/ALL).
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2. Strip table/sequence/function privileges from anon and authenticated.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- Functions: only those we own (skip extension-owned ones such as pg_trgm).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- Keep service_role fully privileged (it bypasses RLS but still needs grants).
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- 3. The one public read path: client/src/pages/seo/{CityPage,BrandPage}.tsx
grant select (
  id, title, slug, brand, model, year, condition, asking_price, deal_rating,
  buyer_score, image_url, city, state, battery_type, seating, source_listing_url,
  status, public_listing
) on public.listings to anon;

create policy listings_anon_public_read on public.listings
  for select to anon
  using (status = 'active' and public_listing = true);

-- 4. Replacement for /api/admin/fix-sequence (previously used the API key as a
--    Postgres password, which never worked).
create or replace function public.admin_reset_listings_id_seq()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v bigint;
begin
  select setval(pg_get_serial_sequence('public.listings', 'id'),
                coalesce((select max(id) from public.listings), 0) + 1, false)
    into v;
  return v;
end $$;
revoke all on function public.admin_reset_listings_id_seq() from public, anon, authenticated;
grant execute on function public.admin_reset_listings_id_seq() to service_role;

commit;

-- Verify after applying (as anon / publishable key):
--   GET /rest/v1/listings?select=id,title&status=eq.active&public_listing=eq.true&limit=1 -> 200, 1 row
--   GET /rest/v1/listings?select=*&limit=1                                         -> 401/permission denied
--   GET /rest/v1/pending_imports?limit=1                                           -> permission denied
--   POST/PATCH/DELETE on any table                                                  -> permission denied
--
-- Rollback (emergency only, restores broad anon read on listings/dealers):
--   grant select on public.listings, public.dealers to anon;
--   create policy listings_public_read on public.listings for select using (public_listing and status='active');
--   create policy dealers_public_read  on public.dealers  for select using (true);
