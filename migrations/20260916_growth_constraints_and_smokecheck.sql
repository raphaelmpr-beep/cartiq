begin;
alter table public.growth_events
  add constraint growth_event_listing_required
  check (event_type not in ('comp_click','listing_view','dealer_contact_click') or listing_id is not null);
alter table public.growth_events
  add constraint growth_event_contact_channel_required
  check (event_type <> 'dealer_contact_click' or channel is not null);

-- Transactional smoke test. The deliberate exception rolls back all synthetic
-- events in the inner block; no sample analytics survive this migration.
do $check$
declare
  test_id uuid := gen_random_uuid();
  test_session uuid := gen_random_uuid();
  before_count bigint;
  after_count bigint;
  observed bigint;
begin
  select count(*) into before_count from public.growth_events;
  begin
    insert into public.growth_events(event_id,session_id,event_type)
      values(test_id,test_session,'estimator_complete');
    select coalesce(sum(events),0) into observed
      from public.growth_scorecard(now()-interval '1 minute',now()+interval '1 minute')
      where event_type='estimator_complete';
    if observed < 1 then raise exception 'Growth aggregate smoke test failed'; end if;
    insert into public.growth_events(event_id,session_id,event_type)
      values(test_id,test_session,'estimator_complete')
      on conflict(event_id) do nothing;
    if (select count(*) from public.growth_events where event_id=test_id)<>1
      then raise exception 'Event idempotency smoke test failed'; end if;
    raise exception using errcode='P0002',message='Rollback smoke event';
  exception when no_data_found then null;
  end;
  select count(*) into after_count from public.growth_events;
  if after_count <> before_count then raise exception 'Smoke events were not rolled back'; end if;
  if exists(select 1 from public.growth_events where event_id=test_id)
    then raise exception 'Synthetic event leaked'; end if;
  if has_function_privilege('anon','public.growth_scorecard(timestamptz,timestamptz)','EXECUTE')
    then raise exception 'Public RPC permission unexpectedly enabled'; end if;
  if not has_function_privilege('service_role','public.growth_scorecard(timestamptz,timestamptz)','EXECUTE')
    then raise exception 'Server RPC permission missing'; end if;
end $check$;
commit;
