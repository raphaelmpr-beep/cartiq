-- 20261018_dealer_monthly_report.sql
-- DRAFT, READ-ONLY query. Per-dealer monthly views, outbound clicks and leads.
-- $1 = month start (date, e.g. '2026-10-01'). Run as service_role (tables are locked down).
-- "outbound_clicks" = contact_click + outbound_click (contact button, tel: link, dealer site link).
-- Views are already deduped at write time (one per session per listing per 30 min).
with bounds as (
  select date_trunc('month', $1::date)::timestamptz as m_start,
         (date_trunc('month', $1::date) + interval '1 month')::timestamptz as m_end
),
ev as (
  select e.dealer_id,
         count(*) filter (where e.event_type = 'listing_view')                        as views,
         count(*) filter (where e.event_type in ('contact_click', 'outbound_click'))  as outbound_clicks
  from public.listing_events e, bounds b
  where e.created_at >= b.m_start and e.created_at < b.m_end
  group by e.dealer_id
),
ld as (
  select l.dealer_id, count(*) filter (where l.status <> 'spam') as leads
  from public.listing_leads l, bounds b
  where l.created_at >= b.m_start and l.created_at < b.m_end
  group by l.dealer_id
)
select to_char((select m_start from bounds), 'YYYY-MM') as month,
       coalesce(ev.dealer_id, ld.dealer_id)             as dealer_id,
       d.name                                           as dealer_name,
       coalesce(ev.views, 0)::int                       as views,
       coalesce(ev.outbound_clicks, 0)::int             as outbound_clicks,
       coalesce(ld.leads, 0)::int                       as leads
from ev
full outer join ld on ld.dealer_id is not distinct from ev.dealer_id
left join public.dealers d on d.id = coalesce(ev.dealer_id, ld.dealer_id)
order by leads desc, outbound_clicks desc, views desc, dealer_id nulls last;
