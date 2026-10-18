-- DRAFT — NOT APPLIED. Lead tracking: failed admin sign-in cap scope (admin_fail_ip).
-- Depends on 20261018_lead_tracking_draft.sql (unchanged). Its inline scope check on
-- public.lead_rate_limits is auto-named lead_rate_limits_scope_check; drop + re-add by that name.
-- Window: 15 min (server/leads/admin-guard.ts, ADMIN_FAIL). Rows are removed by
-- lead_tracking_cleanup() (window_start < now() - 2 days), so the 15-min window sits well inside
-- the cleanup horizon — no retention change needed.
-- Keys are salted sha256 IP hashes (never raw IPs). Same RLS/grants as the base table (no change).
begin;
alter table public.lead_rate_limits drop constraint if exists lead_rate_limits_scope_check;
alter table public.lead_rate_limits add constraint lead_rate_limits_scope_check
  check (scope in ('ev_ip','lead_ip','lead_ip_listing','lead_listing','admin_fail_ip'));
commit;

-- Rollback:
-- begin; delete from public.lead_rate_limits where scope = 'admin_fail_ip';
--   alter table public.lead_rate_limits drop constraint if exists lead_rate_limits_scope_check;
--   alter table public.lead_rate_limits add constraint lead_rate_limits_scope_check
--     check (scope in ('ev_ip','lead_ip','lead_ip_listing','lead_listing'));
-- commit;
