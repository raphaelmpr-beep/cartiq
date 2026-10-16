-- 20261016_dealer_cleanup.sql  (approved by Raphael 2026-10-15)
-- 1) Delete the stray test dealer row `__test_slug_delete_me__` (0 listings, 0 pending, 0 block rows).
-- 2) Merge Jeffrey Allen's 3 dealer rows onto ONE adapter run:
--    all three share jeffreyalleninc.com + the same product sitemap. Before this, adapter_key was NULL,
--    so dealer=all never synced them (0 active). Now: adapter_key='jeffrey_allen' on all three
--    (dedupe adapter|host => one fetch per run), syncing under jeffrey-allen-orlando (which already
--    owns the 22 archived listings). Tampa/Davie rows are KEPT (dealer pages/URLs unchanged) with
--    sync_enabled=false so they never double-queue. No listings are moved or deleted.
-- 3) Point 10 dealers at their real inventory sitemaps (code registry in browser-sync.ts does the
--    fetching; this keeps the dealers table consistent and gives the 7 Dealer Spike rows an
--    adapter_key so dealer=all actually runs them). advantage-golf-cars-fl untouched (stays paused).
-- Idempotent. Backup is taken first; rollback at bottom.
begin;

create table if not exists public.dealers_backup_20261016 as
  select now() as backed_up_at, d.* from public.dealers d where false;
insert into public.dealers_backup_20261016
  select now(), d.* from public.dealers d
  where d.slug in ('__test_slug_delete_me__','jeffrey-allen-orlando','jeffrey-allen-tampa','jeffrey-allen-davie',
                   'affordable-carts-bonita-springs','electric-cart-company-santa-rosa','golf-carts-st-augustine','love-esports-homosassa','revel-golf-cars-jacksonville','orlando-golf-cars','the-golf-cart-company-clermont','carts-and-clubs','coastal-golf-carts-port-orange','fast-eddies-golf-carts')
    and not exists (select 1 from public.dealers_backup_20261016 b where b.id = d.id);
revoke all on public.dealers_backup_20261016 from anon, authenticated;

delete from public.dealers
 where slug = '__test_slug_delete_me__'
   and not exists (select 1 from public.listings l where l.dealer_id = dealers.id);

update public.dealers
   set adapter_key = 'jeffrey_allen',
       dealer_group_slug = 'jeffrey-allen',
       sync_enabled = (slug = 'jeffrey-allen-orlando'),
       updated_at = now()
 where slug in ('jeffrey-allen-orlando','jeffrey-allen-tampa','jeffrey-allen-davie');

update public.dealers set adapter_key = coalesce(adapter_key,'dealerspike_xsitemap'), inventory_source_url = 'https://www.affordablecarts.com/default.asp?page=xsitemap&s=NewInventory', updated_at = now() where slug = 'affordable-carts-bonita-springs';
update public.dealers set adapter_key = coalesce(adapter_key,'dealerspike_xsitemap'), inventory_source_url = 'https://www.electriccartcompany.com/default.asp?page=xsitemap&s=NewInventory', updated_at = now() where slug = 'electric-cart-company-santa-rosa';
update public.dealers set adapter_key = coalesce(adapter_key,'dealerspike_xsitemap'), inventory_source_url = 'https://www.golfcartsofstaugustine.com/default.asp?page=xsitemap&s=NewInventory', updated_at = now() where slug = 'golf-carts-st-augustine';
update public.dealers set adapter_key = coalesce(adapter_key,'dealerspike_xsitemap'), inventory_source_url = 'https://www.loveesports.com/default.asp?page=xsitemap&s=NewInventory', updated_at = now() where slug = 'love-esports-homosassa';
update public.dealers set adapter_key = coalesce(adapter_key,'dealerspike_xsitemap'), inventory_source_url = 'https://www.revelgolfcars.com/default.asp?page=xsitemap&s=NewInventory', updated_at = now() where slug = 'revel-golf-cars-jacksonville';
update public.dealers set adapter_key = coalesce(adapter_key,'dealerspike_xsitemap'), inventory_source_url = 'https://www.orlandogolfcars.com/default.asp?page=xsitemap&s=NewInventory', updated_at = now() where slug = 'orlando-golf-cars';
update public.dealers set adapter_key = coalesce(adapter_key,'dealerspike_xsitemap'), inventory_source_url = 'https://www.thegolfcartcompany.com/default.asp?page=xsitemap&s=NewInventory', updated_at = now() where slug = 'the-golf-cart-company-clermont';
update public.dealers set inventory_source_url = 'https://cartsandclubs.com/glc_listing-sitemap.xml', updated_at = now() where slug = 'carts-and-clubs';
update public.dealers set inventory_source_url = 'https://www.coastalgolfcartsfl.com/glc_listing-sitemap.xml', updated_at = now() where slug = 'coastal-golf-carts-port-orange';
update public.dealers set inventory_source_url = 'https://fasteddiesgc.com/wp-sitemap-posts-products-1.xml', updated_at = now() where slug = 'fast-eddies-golf-carts';

commit;

-- Verify:
-- select slug, adapter_key, dealer_group_slug, sync_enabled from public.dealers where slug like 'jeffrey-allen%' or slug = '__test_slug_delete_me__';

-- ROLLBACK (run manually if needed):
-- begin;
--   update public.dealers d set adapter_key = b.adapter_key, dealer_group_slug = b.dealer_group_slug,
--          inventory_source_url = b.inventory_source_url,
--          sync_enabled = b.sync_enabled, updated_at = now()
--     from public.dealers_backup_20261016 b where b.id = d.id;
--   insert into public.dealers (id, name, slug, sync_enabled, created_at, updated_at)
--     select id, name, slug, sync_enabled, created_at, updated_at from public.dealers_backup_20261016
--      where slug = '__test_slug_delete_me__' on conflict (id) do nothing;
-- commit;
