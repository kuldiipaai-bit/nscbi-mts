-- RLS / workflow tests. Run AFTER stubs.sql (plain Postgres only), the migration and seed.sql.
-- Any failed expectation raises an exception (psql -v ON_ERROR_STOP=1 => non-zero exit).

create function public.t_uid(p_login text) returns uuid language sql stable security definer as
$$ select id from auth.users where email = p_login || '@mts.local' $$;

create function public.t_fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false;
exception when others then return true; end $$;

do $$
declare
  v_act_elec uuid; v_act_hvac uuid; v_obs uuid; v_n int; v_cnt int;
  v_sched uuid; v_svc uuid; v_me_elec uuid := public.t_uid('me_elec');
begin
  select id into v_act_elec from public.activities where title = 'LT panel thermography';
  select id into v_act_hvac from public.activities where title = 'Chiller 2 preventive maintenance';

  -- bootstrap: first user is admin, others take role from app_metadata
  assert (select role from public.profiles where id = public.t_uid('admin1')) = 'admin', 'first user must be admin';
  assert (select role from public.profiles where id = public.t_uid('se1')) = 'se', 'se role';
  assert (select role from public.profiles where id = public.t_uid('gm1')) = 'gm', 'gm role';

  ----------------------------------------------------------------- anon
  reset role; set role anon;
  assert public.t_fails('select count(*) from public.services'), 'anon must not read services';
  assert (select public.ping()) is not null, 'anon may ping';

  ----------------------------------------------------------------- SE
  reset role; perform set_config('request.jwt.claim.sub', public.t_uid('se1')::text, false); set role authenticated;
  select count(*) into v_n from public.activities;
  assert v_n >= 5, 'SE sees all activities';
  assert public.t_fails(format(
    $q$insert into public.activities(service_id,title,activity_date,start_time,end_time)
       select service_id,'hack',current_date,'01:00','02:00' from public.activities limit 1$q$)),
    'SE must not create activities';

  insert into public.observations(activity_id, submitted_by, monitored, checklist_results, remarks)
  values (v_act_elec, public.t_uid('se1'), true, '[{"item":"x","done":true}]', 'Hot spot on feeder 3')
  returning id into v_obs;

  assert public.t_fails(format($q$update public.observations set status='resolved' where id='%s'$q$, v_obs)),
    'SE must not set status via direct UPDATE';
  update public.observations set remarks = 'Hot spot on feeder 3 (updated)' where id = v_obs;
  assert public.t_fails(format(
    $q$insert into public.observation_remarks(observation_id,author_id,author_role,body)
       values ('%s','%s','se','sneaky')$q$, v_obs, public.t_uid('se1'))),
    'SE cannot post remarks (ME owner / GM only)';

  ----------------------------------------------------------------- notifications to owner ME + GM
  reset role;
  select count(*) into v_n from public.notifications where observation_id = v_obs and user_id = public.t_uid('gm1');
  assert v_n = 1, 'GM notified of new observation';
  select count(*) into v_n from public.notifications where observation_id = v_obs and user_id = v_me_elec;
  assert v_n = 1, 'owning ME notified';
  select count(*) into v_n from public.notifications where observation_id = v_obs and user_id = public.t_uid('me_hvac');
  assert v_n = 0, 'other ME not notified';

  ----------------------------------------------------------------- ME (non-owner)
  perform set_config('request.jwt.claim.sub', public.t_uid('me_hvac')::text, false); set role authenticated;
  assert public.t_fails(format(
    $q$insert into public.observation_remarks(observation_id,author_id,author_role,body)
       values ('%s','%s','me','not mine')$q$, v_obs, public.t_uid('me_hvac'))),
    'non-owner ME cannot remark';
  assert public.t_fails(format($q$select public.set_observation_status('%s','resolved','x')$q$, v_obs)),
    'non-owner ME cannot resolve';
  assert public.t_fails(format(
    $q$insert into public.activities(service_id,title,activity_date,start_time,end_time)
       select service_id,'steal',current_date,'01:00','02:00' from public.activities where id='%s'$q$, v_act_elec)),
    'ME cannot create activity on another ME''s service';

  ----------------------------------------------------------------- ME owner
  reset role; perform set_config('request.jwt.claim.sub', v_me_elec::text, false); set role authenticated;
  insert into public.observation_remarks(observation_id,author_id,author_role,body)
  values (v_obs, v_me_elec, 'me', 'Please re-torque terminations and retest');
  select service_id into v_svc from public.activities where id = v_act_elec;
  insert into public.activities(service_id,title,activity_date,start_time,end_time,created_by)
  values (v_svc,'ME own activity',current_date,'11:00','12:00',v_me_elec);

  -- recurring: weekly Mon+Thu for ~4 weeks, monthly, quarterly
  insert into public.schedules(service_id,title,start_time,end_time,recurrence,weekdays,start_date,end_date,created_by)
  values (v_svc,'Weekly check','08:00','09:00','weekly','{1,4}','2026-11-02','2026-11-29',v_me_elec) returning id into v_sched;
  v_cnt := public.generate_schedule_activities(v_sched, '2026-12-31');
  assert v_cnt = 8, format('weekly Mon+Thu over 4 weeks should be 8, got %s', v_cnt);
  assert public.generate_schedule_activities(v_sched, '2026-12-31') = 0, 'generation is idempotent';

  insert into public.schedules(service_id,title,start_time,end_time,recurrence,day_of_month,start_date,end_date,created_by)
  values (v_svc,'Monthly 31st','08:00','09:00','monthly',31,'2026-01-01','2026-04-30',v_me_elec) returning id into v_sched;
  v_cnt := public.generate_schedule_activities(v_sched, '2026-12-31');
  assert v_cnt = 4, format('monthly (31 -> last day) 4 months, got %s', v_cnt);
  assert exists (select 1 from public.activities where schedule_id = v_sched and activity_date = '2026-02-28'), 'Feb uses last day';

  insert into public.schedules(service_id,title,start_time,end_time,recurrence,day_of_month,start_date,end_date,created_by)
  values (v_svc,'Quarterly','08:00','09:00','quarterly',15,'2026-01-15','2026-12-31',v_me_elec) returning id into v_sched;
  v_cnt := public.generate_schedule_activities(v_sched, '2026-12-31');
  assert v_cnt = 4, format('quarterly Jan/Apr/Jul/Oct = 4, got %s', v_cnt);

  ----------------------------------------------------------------- remark visible + notifications fan-out
  reset role;
  select count(*) into v_n from public.notifications where observation_id = v_obs and kind = 'remark' and user_id = public.t_uid('se2');
  assert v_n = 1, 'other SEs notified of ME remark';
  select count(*) into v_n from public.notifications where observation_id = v_obs and kind = 'remark' and user_id = public.t_uid('gm1');
  assert v_n = 1, 'GM notified of ME remark';

  ----------------------------------------------------------------- GM
  perform set_config('request.jwt.claim.sub', public.t_uid('gm1')::text, false); set role authenticated;
  insert into public.observation_remarks(observation_id,author_id,author_role,body)
  values (v_obs, public.t_uid('gm1'), 'gm', 'Expedite - critical feeder');
  assert public.t_fails(format(
    $q$insert into public.observation_remarks(observation_id,author_id,author_role,body)
       values ('%s','%s','admin','role spoof')$q$, v_obs, public.t_uid('gm1'))),
    'role spoofing in remark is blocked';

  ----------------------------------------------------------------- SE resolves, only ME owner/GM reopen
  reset role; perform set_config('request.jwt.claim.sub', public.t_uid('se2')::text, false); set role authenticated;
  assert public.t_fails(format($q$select public.set_observation_status('%s','resolved','  ')$q$, v_obs)), 'note required';
  perform public.set_observation_status(v_obs, 'resolved', 'Retorqued and retested OK');
  assert (select status from public.observations where id = v_obs) = 'resolved', 'resolved';
  assert (select resolved_role from public.observations where id = v_obs) = 'se', 'resolver role recorded';
  assert public.t_fails(format($q$select public.set_observation_status('%s','open','nope')$q$, v_obs)), 'SE cannot reopen';

  reset role; perform set_config('request.jwt.claim.sub', public.t_uid('gm1')::text, false); set role authenticated;
  perform public.set_observation_status(v_obs, 'open', 'Issue recurred');
  assert (select status from public.observations where id = v_obs) = 'open', 'GM reopened';

  ----------------------------------------------------------------- stop schedule keeps observed/past data
  reset role; perform set_config('request.jwt.claim.sub', v_me_elec::text, false); set role authenticated;
  v_sched := (select id from public.schedules where title = 'Quarterly');
  perform public.stop_schedule(v_sched);
  assert (select active from public.schedules where id = v_sched) = false, 'schedule stopped';

  ----------------------------------------------------------------- notifications privacy
  reset role; perform set_config('request.jwt.claim.sub', public.t_uid('se1')::text, false); set role authenticated;
  assert (select count(*) from public.notifications where user_id <> public.t_uid('se1')) = 0, 'SE sees only own notifications';

  reset role;
  raise notice 'ALL RLS TESTS PASSED';
end $$;
