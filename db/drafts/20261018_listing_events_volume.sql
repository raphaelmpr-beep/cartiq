-- 20261018_listing_events_volume.sql
-- DRAFT ONLY. NOT APPLIED. Volume monitor for SRE.
-- Daily listing_events row counts for the last p_days complete UTC days before p_until.
-- GET /api/admin/leads/event-volume (admin) returns these plus
-- {alert, reason, latest, baseline}: alert when the latest complete day is
-- > 3x the median of the up-to-14 prior days (baseline floor 50/day, >= 7 days history).
-- Suggested SRE use: poll daily after 00:30 UTC; page on alert=true (likely bot leak
-- or a client loop), and check the bot filter + dedupe first.
begin;

create or replace function public.listing_events_daily_counts(p_days integer default 15, p_until timestamptz default now())
returns table (day date, events bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select d::date as day, count(e.id) as events
  from generate_series(date_trunc('day', p_until at time zone 'UTC') - make_interval(days => p_days),
                       date_trunc('day', p_until at time zone 'UTC') - interval '1 day', interval '1 day') as d
  left join public.listing_events e
    on e.created_at >= (d at time zone 'UTC') and e.created_at < ((d + interval '1 day') at time zone 'UTC')
  group by d
  order by d;
$$;

revoke execute on function public.listing_events_daily_counts(integer, timestamptz) from public, anon, authenticated;
grant  execute on function public.listing_events_daily_counts(integer, timestamptz) to service_role;

commit;

-- Ad-hoc equivalent (read-only, run as service_role):
-- with daily as (
--   select date_trunc('day', created_at at time zone 'UTC')::date as day, count(*) as events
--   from public.listing_events
--   where created_at >= now() - interval '15 days' and created_at < date_trunc('day', now())
--   group by 1)
-- select day, events,
--        events > 3 * greatest(50, percentile_cont(0.5) within group (order by events) over ()) as naive_alert
-- from daily order by day;
