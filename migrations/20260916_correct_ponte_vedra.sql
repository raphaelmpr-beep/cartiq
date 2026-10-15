-- Source-verified data correction, 2026-09-16.
-- Unit evidence saved with this migration. Stable slugs, dealer slug and
-- old source URLs identify targets; no generated database IDs are assumed.
begin;
do $correction$
declare
  dealer_key bigint;
  gas_key bigint;
  lithium_key bigint;
  gas_url text := 'https://www.pvgolfcarts.com/inventory/30d68780-34aa-42c3-bc1a-bb674579461f';
  lithium_url text := 'https://www.pvgolfcarts.com/inventory/665b7b20-7aac-41b7-a490-6639b777fb63';
begin
  select id into strict dealer_key from public.dealers
    where slug='ponte-vedra-golf-carts' and city='Jacksonville Beach' and state='FL';
  select id into strict gas_key from public.listings
    where slug='2022-club-car-tempo-jacksonville-pv'
      and dealer_id=dealer_key and sync_source='ponte-vedra-golf-carts'
      and source_url='https://www.pvgolfcarts.com/Golf-Carts-Club-Car-Tempo-Gas-2022-Jacksonville-FL-b33baf61-a94c-48c9-b90e-b34f0110290e'
      and source_listing_url is null
      and year=2022 and brand='Club Car' and model='Tempo'
      and asking_price=6995 and condition='used' and seating=4
      and power_type='gas' and status='active' and public_listing=true
      and updated_at='2026-09-14T14:00:57.417+00:00'::timestamptz
      and warranty_notes is null and warranty_months is null
    for update;
  select id into strict lithium_key from public.listings
    where slug='2020-club-car-tempo-jacksonville-pv'
      and dealer_id=dealer_key and sync_source='ponte-vedra-golf-carts'
      and source_url='https://www.pvgolfcarts.com/Golf-Carts-Club-Car-Tempo-w-New-Lithium-2020-Jacksonville-FL-7f122e13-a00c-47d5-95ef-b459015d70e2'
      and source_listing_url is null
      and year=2020 and brand='Club Car' and model='Tempo'
      and asking_price=9799 and condition='used' and seating=4
      and power_type='electric' and battery_type='lithium'
      and status='active' and public_listing=true
      and updated_at='2026-09-14T14:01:02.434+00:00'::timestamptz
      and warranty_notes is null and warranty_months is null
    for update;
  if exists(select 1 from public.listings
      where id not in(gas_key,lithium_key)
        and (source_url in(gas_url,lithium_url) or source_listing_url in(gas_url,lithium_url))) then
    raise exception 'Canonical source is already mapped to another listing';
  end if;
  if exists(select 1 from public.comp_verifications where listing_id in(gas_key,lithium_key)) then
    raise exception 'Existing verification needs review before replacement';
  end if;

  update public.listings set
    title='2022 Club Car Tempo Gas',
    condition='refurbished', seating=null,
    source_url=gas_url, source_listing_url=gas_url,
    description='Cart built with Navy Tempo Body, Grey Standard Seats, Black Roof, 8 Inch Club Car Wheels, 5 Panel Mirror, 90 Day Warranty',
    image_url='https://zlxiiegmzerzxwkfwtei.supabase.co/storage/v1/object/public/cart-images/05df9bcb-b29b-43ae-888b-eb5e559f74b1.jpg',
    warranty_notes='Dealer listing states "90 Day Warranty". Coverage scope, provider, exclusions and transferability are not stated; do not infer vehicle or battery coverage. Source: ' || gas_url || ' (checked 2026-09-16).',
    price_confidence='confirmed', price_scraped=asking_price,
    last_checked_at=now(),
    cartiq_estimated_value=null, deal_delta=null, deal_rating=null,
    buyer_score=null, valuation_confidence=null,
    updated_at=now()
  where id=gas_key;

  update public.listings set
    title='2020 Club Car Tempo Lithium',
    condition='refurbished', seating=2,
    source_url=lithium_url, source_listing_url=lithium_url,
    description='Cart Built With White Body, Standard Beige Seats, Black Roof, Clear Windshield, 10'' Club Car Wheels, Black Bag Cover, Two Sand Buckets, New Lithium Battery, 5 Year Battery Warranty, 1 Year Cart Warranty',
    image_url='https://zlxiiegmzerzxwkfwtei.supabase.co/storage/v1/object/public/cart-images/1f2ced39-1bef-4fc4-af76-64382ac15a3d.jpeg',
    warranty_months=12,
    warranty_notes='Dealer advertises "5 Year Battery Warranty, 1 Year Cart Warranty" on this specific unit. Battery term: 60 months; cart term: 12 months. Provider, exclusions and transferability are not stated. Source: ' || lithium_url || ' (checked 2026-09-16).',
    price_confidence='confirmed', price_scraped=asking_price,
    last_checked_at=now(),
    cartiq_estimated_value=null, deal_delta=null, deal_rating=null,
    buyer_score=null, valuation_confidence=null,
    updated_at=now()
  where id=lithium_key;

  -- Warranty inclusion flags deliberately remain unchanged because the
  -- existing production text/boolean rendering bug has not been deployed fixed.
  -- No guessed gas seating, no branch merge, no dealer-default inheritance.
  insert into public.comp_verifications
    (listing_id,dealer_id,source_url,source_price,checked_at,
     valid_vehicle,branch_verified,in_stock,evidence_excerpt,verified_by)
    values(lithium_key,dealer_key,lithium_url,9799,now(),true,true,true,
      '2020 Club Car Tempo Lithium; serial BN2019-072353; Refurbished; Seats 2 passenger; Powertrain Lithium; Jacksonville Beach Showroom. Canonical unit HTML: price 9799, seats 2, powertrain lithium, status available, published true, sold false. Source refreshed 2026-09-16. Dealer asking price, not a completed sale. Existing record reconciled by unique year/model/power/color/price and dealer; legacy VIN was not available.',
      'Computer source review 2026-09-16');

  if (select count(*) from public.listings
      where id in(gas_key,lithium_key) and condition='refurbished'
        and cartiq_estimated_value is null and deal_rating is null) <> 2 then
    raise exception 'Correction postcondition failed';
  end if;
  if not exists(select 1 from public.listings where id=gas_key and seating is null and source_url=gas_url)
    or not exists(select 1 from public.listings where id=lithium_key and seating=2 and source_url=lithium_url) then
    raise exception 'Seating/source postcondition failed';
  end if;
end $correction$;
commit;
