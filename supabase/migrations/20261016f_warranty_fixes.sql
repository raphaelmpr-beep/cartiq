-- 20261016f: warranty fixes. (a) 6 unsupported 'yes' + their term conflicts -> unknown (pages state no warranty);
-- (b) 46 listings: page-stated unit warranty with quote + source. Dealer-level wording is NOT written here.
begin;
create table if not exists public.listings_warranty_backup_20261016 as
  select now() as backed_up_at, id, warranty_included, warranty_months, warranty_notes, battery_warranty_months,
         warranty_source, warranty_source_url, warranty_source_quote, warranty_verified_at from public.listings where false;
revoke all on public.listings_warranty_backup_20261016 from anon, authenticated;
create temp table g(ids bigint[], months int, batt_months int, quote text) on commit drop;
insert into g values
('{2076,2077,2078}',24,null,'Warranty 2 Year Manufacturer .'),
('{5746,5762,5763}',null,96,'Peace of mind comes standard: a lifetime chassis warranty and an 8-year lithium battery warranty from Denago.'),
('{1457}',12,60,'5 Year Battery Warranty, 1 Year Cart Warranty'),
('{5764,5766}',null,96,'It''s covered by Denago''s lifetime chassis warranty and 8-year warranty on the LiFePO4 battery.'),
('{1478,1479,1481}',120,null,'10 year warranty included'),
('{1482,1483,1484,1485,1487}',96,null,'8 year warranty included'),
('{5761}',12,null,'Warranty 1-Year Limited Warranty .'),
('{2099,2100,2109,2110,2111,2112,2114,2115,2119,2120,2121,2122,2123,2124,2125,2127,2138,2140,2141,2142,2143,2148,2149}',24,96,'Warranty 2 Year Manufacturer . Battery comes with a 8 year manufacturer, full price of the battery warranty.'),
('{2144,2145,2146,2147}',36,96,'Warranty 3 Year Manufacturer . Battery comes with a 8 year manufacturer, full price of the battery warranty.'),
('{1614}',12,null,'1 year in House Powertrain Warranty.');
create temp table w on commit drop as select unnest(ids) as id, months, batt_months, quote from g;
insert into public.listings_warranty_backup_20261016
  select now(), id, warranty_included, warranty_months, warranty_notes, battery_warranty_months, warranty_source, warranty_source_url, warranty_source_quote, warranty_verified_at
  from public.listings where id in (1525,1528,1529,1530,1531,1532) or id in (select id from w);
update public.listings set warranty_included='unknown', warranty_months=null,
  warranty_notes=null, warranty_source=null, warranty_source_url=null, warranty_source_quote=null, warranty_verified_at=now()
  where id in (1525,1528,1529,1530,1531,1532) and warranty_included='yes';
update public.listings l set warranty_included='yes', warranty_months=w.months,
  battery_warranty_months=coalesce(w.batt_months,l.battery_warranty_months), warranty_source='listing_page',
  warranty_source_url=l.source_listing_url, warranty_source_quote=w.quote, warranty_verified_at=now()
from w where w.id=l.id;
select warranty_source, warranty_included, count(*) from public.listings
  where id in (select id from public.listings_warranty_backup_20261016) group by 1,2;  -- expect listing_page/yes 46, null/unknown 6
commit;
-- ROLLBACK:
-- update public.listings l set warranty_included=b.warranty_included, warranty_months=b.warranty_months, warranty_notes=b.warranty_notes,
--   battery_warranty_months=b.battery_warranty_months, warranty_source=b.warranty_source, warranty_source_url=b.warranty_source_url,
--   warranty_source_quote=b.warranty_source_quote, warranty_verified_at=b.warranty_verified_at
--   from public.listings_warranty_backup_20261016 b where b.id=l.id;
