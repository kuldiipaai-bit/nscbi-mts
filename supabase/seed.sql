-- =====================================================================
-- DEMO / LOCAL DEVELOPMENT SEED ONLY. Never run this on production.
-- Creates demo users (login id + password below) and sample data.
-- Login id is typed in the app WITHOUT the domain, e.g. "gm1".
--   admin1 / me_elec / me_hvac / se1 / se2 / gm1   password: Demo@12345
-- =====================================================================

do $$
declare
  v_pw text := crypt('Demo@12345', gen_salt('bf'));
  r record;
  v_admin uuid; v_me_elec uuid; v_me_hvac uuid;
  v_s_elec uuid; v_s_hvac uuid; v_s_lift uuid; v_s_fire uuid;
begin
  for r in
    select * from (values
      ('admin1',  'Admin User',            'admin', 'A001'),
      ('me_elec', 'R. Sen (Electrical)',   'me',    'M101'),
      ('me_hvac', 'P. Das (HVAC)',         'me',    'M102'),
      ('se1',     'A. Roy (Shift Eng)',    'se',    'S201'),
      ('se2',     'B. Ghosh (Shift Eng)',  'se',    'S202'),
      ('gm1',     'GM (Electrical)',       'gm',    'G001')
    ) as t(login, name, role, emp)
  loop
    if not exists (select 1 from auth.users where email = r.login || '@mts.local') then
      declare v_id uuid := gen_random_uuid();
      begin
        insert into auth.users
          (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
           confirmation_token, recovery_token, email_change, email_change_token_new,
           email_change_token_current)
        values
          ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
           r.login || '@mts.local', v_pw, now(),
           jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', r.role),
           jsonb_build_object('full_name', r.name, 'employee_id', r.emp),
           now(), now(), '', '', '', '', '');
        insert into auth.identities
          (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        values
          (gen_random_uuid(), v_id, v_id::text,
           jsonb_build_object('sub', v_id::text, 'email', r.login || '@mts.local'),
           'email', now(), now(), now());
      end;
    end if;
  end loop;

  select id into v_me_elec from public.profiles where employee_id = 'M101';
  select id into v_me_hvac from public.profiles where employee_id = 'M102';

  insert into public.services (name, location, owner_me_id) values
    ('Electrical - Terminal LT Panels', 'Terminal Building', v_me_elec),
    ('HVAC - Chillers & AHUs',          'Terminal Building', v_me_hvac),
    ('Lifts & Escalators',              'Terminal Building', v_me_elec),
    ('Fire Detection & Alarm',          'Terminal Building', v_me_elec)
  on conflict (name) do nothing;

  select id into v_s_elec from public.services where name like 'Electrical%';
  select id into v_s_hvac from public.services where name like 'HVAC%';
  select id into v_s_lift from public.services where name like 'Lifts%';
  select id into v_s_fire from public.services where name like 'Fire%';

  insert into public.activities
    (service_id, title, description, location, activity_date, start_time, end_time, priority, agency, checklist, created_by)
  values
    (v_s_elec, 'LT panel thermography', 'Thermal scan of main LT panels', 'Substation 1',
       current_date, '06:00', '10:00', 'high', 'M/s PowerCheck',
       '["Panel door safe to open","Hot-spot readings recorded","Loose terminations noted"]', v_me_elec),
    (v_s_hvac, 'Chiller 2 preventive maintenance', 'Quarterly PM', 'Plant Room',
       current_date, '09:00', '15:00', 'medium', 'M/s CoolTech',
       '["Refrigerant pressure OK","Oil level OK","Vibration normal"]', v_me_hvac),
    (v_s_lift, 'Lift L3 inspection', 'Monthly inspection', 'Arrival Hall',
       current_date, '13:00', '15:30', 'medium', 'OEM',
       '["Door sensor tested","Emergency alarm tested"]', v_me_elec),
    (v_s_fire, 'Fire panel zone test', 'Zone 4-6 test', 'Departure Level',
       current_date, '22:00', '02:00', 'critical', 'In-house',
       '["Detectors responding","Alarm panel log cleared"]', v_me_elec),
    (v_s_hvac, 'AHU filter cleaning', 'AHU 5-8', 'Level 2',
       current_date + 1, '08:00', '12:00', 'low', 'In-house',
       '["Filters cleaned","Belts checked"]', v_me_hvac);
end $$;
