-- 20261018_lead_retention_draft.sql
-- DRAFT ONLY. NOT APPLIED. Requires 20261018_lead_tracking_draft.sql first.
-- Retention: listing_leads 12 months, listing_events 90 days, lead_rate_limits
-- rows whose window started > 2 days ago (longest window is 24 h).
-- Called by POST /api/cron/lead-retention (admin token or CRON_SECRET; flag-gated)
-- through the service_role client. Uses idx_listing_leads_created,
-- idx_listing_events_created and idx_lead_rate_limits_window.
begin;

create or replace function public.lead_tracking_cleanup()
returns table (leads_deleted bigint, events_deleted bigint, rate_limits_deleted bigint)
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare l bigint; e bigint; r bigint;
begin
  delete from public.listing_leads    where created_at   < now() - interval '12 months'; get diagnostics l = row_count;
  delete from public.listing_events   where created_at   < now() - interval '90 days';   get diagnostics e = row_count;
  delete from public.lead_rate_limits where window_start < now() - interval '2 days';    get diagnostics r = row_count;
  return query select l, e, r;
end;
$$;

revoke execute on function public.lead_tracking_cleanup() from public, anon, authenticated;
grant  execute on function public.lead_tracking_cleanup() to service_role;

commit;
-- Rollback: drop function if exists public.lead_tracking_cleanup();
