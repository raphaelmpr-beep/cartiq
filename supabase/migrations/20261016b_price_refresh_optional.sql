-- 20261016b_price_refresh_optional.sql  (OPTIONAL; not one of the approved 'blank' categories)
-- Live listing pages (JSON-LD offer price, re-fetched politely 2026-10-15 ~11:30 PM ET) differ from the stored price.
-- Most look like ordinary dealer price changes. Run only if you want them refreshed now rather than on the next sync.
-- Rows: 25. Backup first (same table as the main file); rollback at bottom.
begin;
create table if not exists public.listings_price_backup_20261016 (
  id bigint not null, action text not null, reason text, backed_up_at timestamptz not null default now(),
  asking_price numeric, sale_price numeric, regular_price numeric, price_confidence text,
  cartiq_estimated_value numeric, deal_rating text, deal_delta numeric, total_delivered_cost numeric,
  primary key (id, action));
revoke all on public.listings_price_backup_20261016 from anon, authenticated;

-- #126: 13974 -> 14274  https://www.jenkinsmotorsports.com/Golf-Carts-E-Z-GO-Express-6-Touring-S-13-5-hp-Gas-2027-Lakeland-FL-f397ca1f-106f-4841-a4aa-b40400989b55
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 14274',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=126
  on conflict (id, action) do nothing;
update public.listings set asking_price=14274, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=126 and asking_price is not distinct from 13974;
-- #139: 17099 -> 17399  https://www.shivercarts.com/Golf-Carts-E-Z-GO-Express-6-Touring-ST-13-5-hp-Gas-2027-Tifton-GA-8e9ea89c-a60c-4caf-b1cd-b40400aa17b9
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 17399',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=139
  on conflict (id, action) do nothing;
update public.listings set asking_price=17399, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=139 and asking_price is not distinct from 17099;
-- #194: 5295 -> 5495  https://www.discoverygolfcars.com/listing/refurbished-2020-lithium-e-z-go-freedom-rxv-elite-clearwater-florida-17787/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 5495',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=194
  on conflict (id, action) do nothing;
update public.listings set asking_price=5495, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=194 and asking_price is not distinct from 5295;
-- #444: 17774 -> 18074  https://www.shivercarts.com/Golf-Carts-E-Z-GO-Express-6-Touring-STL-13-5-hp-Gas-2027-Tifton-GA-2d70b347-da9d-481e-b308-b40400aa4f76
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 18074',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=444
  on conflict (id, action) do nothing;
update public.listings set asking_price=18074, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=444 and asking_price is not distinct from 17774;
-- #474: 18099 -> 18399  https://www.shivercarts.com/Golf-Carts-E-Z-GO-Express-6-Summit-XTL-13-5-hp-Gas-2027-Tifton-GA-55844b36-6d60-4c34-a8cb-b40400901264
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 18399',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=474
  on conflict (id, action) do nothing;
update public.listings set asking_price=18399, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=474 and asking_price is not distinct from 18099;
-- #490: 14124 -> 14424  https://www.shivercarts.com/Golf-Carts-E-Z-GO-Express-6-Touring-S-13-5-hp-Gas-2027-Tifton-GA-836b791b-9e18-43f1-a927-b40400989b55
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 14424',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=490
  on conflict (id, action) do nothing;
update public.listings set asking_price=14424, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=490 and asking_price is not distinct from 14124;
-- #1513: 12995 -> 12495  https://www.nextgencarts.com/products/new-6-seater-golf-carts/2026-verdi-malibu-53378851
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 12495',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1513
  on conflict (id, action) do nothing;
update public.listings set asking_price=12495, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1513 and asking_price is not distinct from 12995;
-- #1514: 12995 -> 12495  https://www.nextgencarts.com/products/new-6-seater-golf-carts/2026-verdi-malibu-53378849
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 12495',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1514
  on conflict (id, action) do nothing;
update public.listings set asking_price=12495, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1514 and asking_price is not distinct from 12995;
-- #1515: 12995 -> 12495  https://www.nextgencarts.com/products/new-6-seater-golf-carts/2026-verdi-malibu-53402936
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 12495',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1515
  on conflict (id, action) do nothing;
update public.listings set asking_price=12495, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1515 and asking_price is not distinct from 12995;
-- #1516: 12995 -> 12495  https://www.nextgencarts.com/products/new-6-seater-golf-carts/2026-verdi-malibu-53402968
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 12495',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1516
  on conflict (id, action) do nothing;
update public.listings set asking_price=12495, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1516 and asking_price is not distinct from 12995;
-- #1517: 12995 -> 12495  https://www.nextgencarts.com/products/new-6-seater-golf-carts/2026-verdi-aspen-6p-red-53451064
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 12495',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1517
  on conflict (id, action) do nothing;
update public.listings set asking_price=12495, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1517 and asking_price is not distinct from 12995;
-- #1524: 8900 -> 7000  https://www.nextgencarts.com/products/pre-owned-golf-carts/nextgen-ev-sky-blue-53270249
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 7000',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1524
  on conflict (id, action) do nothing;
update public.listings set asking_price=7000, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1524 and asking_price is not distinct from 8900;
-- #1533: 28460 -> 22995  https://www.thevillagesgolfcars.com/product/2023-yamaha-concierge-4-50/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 22995',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1533
  on conflict (id, action) do nothing;
update public.listings set asking_price=22995, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1533 and asking_price is not distinct from 28460;
-- #1539: 25224 -> 25576  https://www.thevillagesgolfcars.com/product/2026-star-sirius-2-12/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 25576',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1539
  on conflict (id, action) do nothing;
update public.listings set asking_price=25576, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1539 and asking_price is not distinct from 25224;
-- #1575: 27046 -> 26399  https://www.thevillagesgolfcars.com/product/2026-star-sirius-2-9/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 26399',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1575
  on conflict (id, action) do nothing;
update public.listings set asking_price=26399, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=1575 and asking_price is not distinct from 27046;
-- #2045: 15795 -> 21942  https://www.onestop-fl.com/Golf-Carts-Epic-EV-FX40-2026-Wildwood-FL-9652287c-62d8-4bb8-9a74-b43d014071b3
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 21942',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2045
  on conflict (id, action) do nothing;
update public.listings set asking_price=21942, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2045 and asking_price is not distinct from 15795;
-- #2046: 16595 -> 20595  https://www.onestop-fl.com/Golf-Carts-Epic-EV-FX40-2026-Wildwood-FL-8228e0bc-b9c4-4084-8b9f-b41e00dd2aa6
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 20595',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2046
  on conflict (id, action) do nothing;
update public.listings set asking_price=20595, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2046 and asking_price is not distinct from 16595;
-- #2048: 15795 -> 20845  https://www.onestop-fl.com/Golf-Carts-Epic-EV-FX40-2026-Wildwood-FL-147e3426-3ce2-4f5e-96cc-b43d0140bd29
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 20845',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2048
  on conflict (id, action) do nothing;
update public.listings set asking_price=20845, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2048 and asking_price is not distinct from 15795;
-- #2054: 16995 -> 18795  https://www.onestop-fl.com/Golf-Carts-Epic-EV-FX20-2026-Wildwood-FL-83e0c50e-20d4-495f-96ae-b41a010c1ca8
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 18795',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2054
  on conflict (id, action) do nothing;
update public.listings set asking_price=18795, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2054 and asking_price is not distinct from 16995;
-- #2058: 11795 -> 15195  https://www.onestop-fl.com/Golf-Carts-ICON-Electric-Vehicles-ICON-i20X-2026-Wildwood-FL-03dcd7bc-dc70-46a9-ad44-b46e010db4bc
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 15195',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2058
  on conflict (id, action) do nothing;
update public.listings set asking_price=15195, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2058 and asking_price is not distinct from 11795;
-- #2059: 12795 -> 15495  https://www.onestop-fl.com/Golf-Carts-ICON-Electric-Vehicles-ICON-i20X-2026-Wildwood-FL-7b4729a5-65b7-4240-bf33-b46e010f29b2
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 15495',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2059
  on conflict (id, action) do nothing;
update public.listings set asking_price=15495, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2059 and asking_price is not distinct from 12795;
-- #2099: 8495 -> 6995  https://jbgolfcarts.webbreservations.com/inventory/69821bf40bd1dd81256ee3d9/2026-black-denago-ev-scout-2-48v-105ah-lithium-2-seater-golf-cart/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 6995',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2099
  on conflict (id, action) do nothing;
update public.listings set asking_price=6995, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2099 and asking_price is not distinct from 8495;
-- #2100: 8495 -> 6995  https://jbgolfcarts.webbreservations.com/inventory/698226860bd1dd8125707ece/2026-black-denago-ev-scout-2-48v-105ah-lithium-2-seater-golf-cart/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 6995',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2100
  on conflict (id, action) do nothing;
update public.listings set asking_price=6995, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2100 and asking_price is not distinct from 8495;
-- #2132: 11995 -> 12995  https://jbgolfcarts.webbreservations.com/inventory/698e167a95376648b6db351a/2026-black-denago-ev-oxen-utility-cart-205ah-lithium/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 12995',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2132
  on conflict (id, action) do nothing;
update public.listings set asking_price=12995, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2132 and asking_price is not distinct from 11995;
-- #2133: 11995 -> 12995  https://jbgolfcarts.webbreservations.com/inventory/698e16be95376648b6db3bef/2026-black-denago-ev-oxen-utility-cart-205ah-lithium/
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'refresh','page JSON-LD 12995',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2133
  on conflict (id, action) do nothing;
update public.listings set asking_price=12995, sale_price=null, price_confidence='confirmed', updated_at=now()
  where id=2133 and asking_price is not distinct from 11995;
commit;
-- Deal ratings for these rows refresh on the next admin 'reprice all'.

-- ROLLBACK:
-- update public.listings l set asking_price=b.asking_price, sale_price=b.sale_price, price_confidence=b.price_confidence, updated_at=now()
--   from public.listings_price_backup_20261016 b where b.id=l.id and b.action='refresh';
