-- 20261018_dealer_monthly_report.sql
-- DRAFT, READ-ONLY query. Per-dealer monthly views, outbound clicks and leads.
-- $1 = month start (date, e.g. '2026-10-01'). $1 MUST be bound as a parameter by the
-- server route (GET /api/admin/leads/monthly-report validates ?month=YYYY-MM); never
-- string-concatenate it. Run as service_role (tables are locked down).
-- outbound_clicks = contact_click + outbound_click (contact button, tel: link, dealer site link).
-- Views are already deduped at write time (one per session per listing per 30 min).
-- Leads with status 'spam' are excluded.
with bounds as (
  select date_trunc('month', $1::date)::timestamptz                      as m_start,
         (date_trunc('month', $1::date) + interval '1 month')::timestamptz as m_end
),
facts as (
  select e.dealer_id,
         (e.event_type = 'listing_view')::int                           as views,
         (e.event_type in ('contact_click', 'outbound_click'))::int     as outbound_clicks,
         0                                                              as leads
  from public.listing_events e, bounds b
  where e.created_at >= b.m_start and e.created_at < b.m_end
  union all
  select l.dealer_id, 0, 0, 1
  from public.listing_leads l, bounds b
  where l.created_at >= b.m_start and l.created_at < b.m_end and l.status <> 'spam'
),
agg as (
  select dealer_id, sum(views)::int as views, sum(outbound_clicks)::int as outbound_clicks, sum(leads)::int as leads
  from facts
  group by dealer_id
)
select to_char((select m_start from bounds), 'YYYY-MM') as month,
       a.dealer_id                                      as dealer_id,
       d.name                                           as dealer_name,
       a.views                                          as views,
       a.outbound_clicks                                as outbound_clicks,
       a.leads                                          as leads
from agg a
left join public.dealers d on d.id = a.dealer_id
order by a.leads desc, a.outbound_clicks desc, a.views desc, a.dealer_id nulls last;
