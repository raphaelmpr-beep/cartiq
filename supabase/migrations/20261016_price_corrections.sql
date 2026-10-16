-- 20261016_price_corrections.sql  (approved by Raphael 2026-10-15: down payment/monthly, MSRP, invented prices -> blank)
-- Backs up every affected row to public.listings_price_backup_20261016 FIRST, then blanks the price.
-- Each UPDATE only fires if the price is still the old wrong value (won't clobber a newer sync).
-- MSRP-as-price: 0 found among the 253 listing pages re-verified with the new extractor (Botero/JAX not re-fetched: paused/challenge).
-- Rows blanked: 17. Rollback at bottom.
begin;
create table if not exists public.listings_price_backup_20261016 (
  id bigint not null, action text not null, reason text, backed_up_at timestamptz not null default now(),
  asking_price numeric, sale_price numeric, regular_price numeric, price_confidence text,
  cartiq_estimated_value numeric, deal_rating text, deal_delta numeric, total_delivered_cost numeric,
  primary key (id, action));
revoke all on public.listings_price_backup_20261016 from anon, authenticated;

-- #1: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=1 and asking_price is not distinct from 14995;
-- #2: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=2
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=2 and asking_price is not distinct from 13499;
-- #3: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=3
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=3 and asking_price is not distinct from 5995;
-- #4: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=4
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=4 and asking_price is not distinct from 7499;
-- #5: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=5
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=5 and asking_price is not distinct from 6799;
-- #6: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=6
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=6 and asking_price is not distinct from 16500;
-- #7: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=7
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=7 and asking_price is not distinct from 9950;
-- #8: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=8
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=8 and asking_price is not distinct from 15200;
-- #10: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=10
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=10 and asking_price is not distinct from 17500;
-- #11: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=11
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=11 and asking_price is not distinct from 2800;
-- #12: invented: seed/demo row, no listing page (source is a dealer homepage or none)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','invented: seed/demo row, no listing page (source is a dealer homepage or none)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=12
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=12 and asking_price is not distinct from 11200;
-- #105: down payment stored as price ($1,000); page price is $11,995 (fixture)
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','down payment stored as price ($1,000); page price is $11,995 (fixture)',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=105
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=105 and asking_price is not distinct from 1000;
-- #110: down payment stored as price ($1,000), same Dach Falcon Ultra unit pattern as #105
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','down payment stored as price ($1,000), same Dach Falcon Ultra unit pattern as #105',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=110
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=110 and asking_price is not distinct from 1000;
-- #1926: below $1,500 plausible floor ($845) - monthly/down-payment amount; page now 404
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','below $1,500 plausible floor ($845) - monthly/down-payment amount; page now 404',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1926
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=1926 and asking_price is not distinct from 845;
-- #1951: below $1,500 plausible floor ($950) - monthly/down-payment amount; page now 404
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','below $1,500 plausible floor ($950) - monthly/down-payment amount; page now 404',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1951
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=1951 and asking_price is not distinct from 950;
-- #1970: below $1,500 plausible floor ($945) - monthly/down-payment amount; page now 404
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','below $1,500 plausible floor ($945) - monthly/down-payment amount; page now 404',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1970
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=1970 and asking_price is not distinct from 945;
-- #1971: below $1,500 plausible floor ($972) - monthly/down-payment amount; page now 404
insert into public.listings_price_backup_20261016 (id,action,reason,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost)
  select id,'blank','below $1,500 plausible floor ($972) - monthly/down-payment amount; page now 404',asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,deal_rating,deal_delta,total_delivered_cost from public.listings where id=1971
  on conflict (id, action) do nothing;
update public.listings set asking_price=null, sale_price=null, regular_price=null, price_confidence='unavailable', deal_rating='unknown', deal_delta=null, total_delivered_cost=null, updated_at=now()
  where id=1971 and asking_price is not distinct from 972;
commit;

-- Verify: select id, asking_price, price_confidence, deal_rating from public.listings where id in (1,2,3,4,5,6,7,8,10,11,12,105,110,1926,1951,1970,1971);

-- ROLLBACK:
-- update public.listings l set asking_price=b.asking_price, sale_price=b.sale_price, regular_price=b.regular_price, price_confidence=b.price_confidence,
--   deal_rating=b.deal_rating, deal_delta=b.deal_delta, total_delivered_cost=b.total_delivered_cost, updated_at=now()
--   from public.listings_price_backup_20261016 b where b.id=l.id and b.action='blank';
