-- 20261016d: 13 site-verified dealer contact fixes + 4 dealer warranty-program quotes. Run AFTER 20261016c.
begin;
create table if not exists public.dealers_contact_backup_20261016 as
  select now() as backed_up_at, id, slug, city, zip, phone, warranty_page_url, warranty_program_quote, contact_verified_at from public.dealers where false;
revoke all on public.dealers_contact_backup_20261016 from anon, authenticated;
create temp table v(slug text, old_city text, old_zip text, old_phone text, city text, zip text, phone text) on commit drop;
insert into v values
('love-esports-homosassa','Homosassa',null,'(352) 794-1884','Homosassa','34448','(352) 794-1884'),
('cshell-carts-naples','Naples',null,'(239) 567-9137','Naples','34109','(239) 567-9137'),
('golf-carts-st-augustine','St. Augustine',null,'(904) 810-1006','St. Augustine','32095','(904) 810-1006'),
('the-golf-cart-company-clermont','Clermont',null,'(407) 557-2775','Clermont','34711','(407) 557-2775'),
('orlando-golf-cars','Orlando',null,'(407) 426-9727','Orlando','32807','(407) 426-9727'),
('hole-in-one-golf-carts-naples','Naples',null,'(239) 598-3130','Naples','34110','(239) 598-3130'),
('hidden-creek-golf-carts-brooksville','Brooksville',null,'(813) 780-1000','Brooksville','34601','(813) 780-1000'),
('coastal-golf-carts-port-orange','Port Orange',null,'(386) 405-2808','Port Orange','32127','(386) 405-2808'),
('agc-carts-augusta','Augusta','30901','7066270057','Augusta','30906','7066270057'),
('golf-carts-unlimited-melbourne','Melbourne',null,'(321) 610-7011','Melbourne','32940','(321) 610-7011'),
('electric-cart-watersound-inlet-beach','Inlet Beach',null,'(850) 233-0020','Panama City Beach','32413','(850) 233-0020'),
('ponte-vedra-golf-carts','Jacksonville Beach','32250','(904) 241-4388','Jacksonville Beach','32250','(904) 285-9901'),
('revel-golf-cars-jacksonville','Jacksonville','32218','9043796818','Jacksonville','32258','9043796818');
create temp table w(slug text, url text, quote text) on commit drop;
insert into w values
('ge-vehicles-jacksonville','https://gevehicles.com/warranty/','Golf & Electric Vehicles is honored to provide a golf cart warranty program for our customers. … We will handle the warranty process for you.'),
('ge-vehicles-orlando','https://gevehicles.com/warranty/','Golf & Electric Vehicles is honored to provide a golf cart warranty program for our customers. … We will handle the warranty process for you.'),
('ge-vehicles-fort-myers','https://gevehicles.com/warranty/','Golf & Electric Vehicles is honored to provide a golf cart warranty program for our customers. … We will handle the warranty process for you.'),
('performance-golf-carts-auburndale','https://www.performancegolfcarts.com/cart-guard-warranty/','Cart Guard delivers limited warranty programs to the golf cart, LSV and electric vehicle marketplace enabling our nationwide authorized dealer network to add value to their product line and offer peace of mind to their clients.');
insert into public.dealers_contact_backup_20261016
  select now(), d.id, d.slug, d.city, d.zip, d.phone, d.warranty_page_url, d.warranty_program_quote, d.contact_verified_at
  from public.dealers d where d.slug in (select slug from v union select slug from w);
update public.dealers d set city=v.city, zip=v.zip, phone=v.phone, contact_verified_at=now()
  from v where d.slug=v.slug and d.city is not distinct from v.old_city and d.zip is not distinct from v.old_zip and d.phone is not distinct from v.old_phone;
update public.dealers d set warranty_page_url=w.url, warranty_program_quote=w.quote from w where d.slug=w.slug;
select slug, city, zip, phone, contact_verified_at is not null as verified, warranty_page_url is not null as program
  from public.dealers where slug in (select slug from v union select slug from w) order by slug;  -- expect 13 verified, 4 program
commit;
-- ROLLBACK:
-- update public.dealers d set city=b.city, zip=b.zip, phone=b.phone, warranty_page_url=b.warranty_page_url,
--   warranty_program_quote=b.warranty_program_quote, contact_verified_at=b.contact_verified_at
--   from public.dealers_contact_backup_20261016 b where b.id=d.id;
