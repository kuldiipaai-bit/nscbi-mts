-- =====================================================================
-- Maintenance Activity Tracking System (NSCBI Airport, AAI)
-- Schema, RLS, triggers and RPCs. Works on Supabase cloud and on the
-- self-hosted Supabase stack (no cloud-specific features are used).
-- =====================================================================

create extension if not exists pgcrypto;

create type user_role       as enum ('admin', 'me', 'se', 'gm');
create type priority_level  as enum ('low', 'medium', 'high', 'critical');
create type obs_status      as enum ('open', 'resolved');
create type recurrence_kind as enum ('daily', 'weekly', 'monthly', 'quarterly');
create type remark_kind     as enum ('remark', 'resolve', 'reopen');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'se',
  employee_id text,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  location     text,
  owner_me_id  uuid references public.profiles (id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.schedules (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references public.services (id) on delete cascade,
  title         text not null,
  description   text,
  location      text,
  start_time    time not null,
  end_time      time not null,
  priority      priority_level not null default 'medium',
  agency        text,
  checklist     jsonb not null default '[]'::jsonb,
  recurrence    recurrence_kind not null,
  weekdays      int[] not null default '{}',          -- 0=Sun .. 6=Sat (weekly)
  day_of_month  int check (day_of_month between 1 and 31), -- monthly / quarterly
  start_date    date not null,
  end_date      date,
  last_generated date,
  active        boolean not null default true,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references public.services (id) on delete cascade,
  schedule_id   uuid references public.schedules (id) on delete set null,
  title         text not null,
  description   text,
  location      text,
  activity_date date not null,
  start_time    time not null,
  end_time      time not null,                        -- end < start => ends next day
  priority      priority_level not null default 'medium',
  agency        text,
  checklist     jsonb not null default '[]'::jsonb,   -- ["item", ...]
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index activities_date_idx on public.activities (activity_date, start_time);
create index activities_service_idx on public.activities (service_id, activity_date);
create unique index activities_schedule_day_uq
  on public.activities (schedule_id, activity_date) where schedule_id is not null;

create table public.observations (
  id                uuid primary key default gen_random_uuid(),
  activity_id       uuid not null references public.activities (id) on delete cascade,
  submitted_by      uuid not null references public.profiles (id),
  monitored         boolean not null default true,
  checklist_results jsonb not null default '[]'::jsonb, -- [{"item":"..","done":true}]
  remarks           text,
  status            obs_status not null default 'open',
  resolved_by       uuid references public.profiles (id),
  resolved_role     user_role,
  resolved_note     text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index observations_activity_idx on public.observations (activity_id);
create index observations_status_idx on public.observations (status, created_at desc);

create table public.observation_photos (
  id             uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations (id) on delete cascade,
  storage_path   text not null,
  created_at     timestamptz not null default now()
);
create index observation_photos_obs_idx on public.observation_photos (observation_id);

create table public.observation_remarks (
  id             uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations (id) on delete cascade,
  author_id      uuid not null references public.profiles (id),
  author_role    user_role not null,
  body           text not null check (length(trim(body)) > 0),
  kind           remark_kind not null default 'remark',
  created_at     timestamptz not null default now()
);
create index observation_remarks_obs_idx on public.observation_remarks (observation_id, created_at);

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  observation_id uuid references public.observations (id) on delete cascade,
  kind           text not null,
  message        text not null,
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.auth_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.owns_service(p_service uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.services s
                 where s.id = p_service and s.owner_me_id = auth.uid())
$$;

create or replace function public.owns_observation(p_obs uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.observations o
    join public.activities a on a.id = o.activity_id
    join public.services s on s.id = a.service_id
    where o.id = p_obs and s.owner_me_id = auth.uid())
$$;

-- New auth user -> profile. Role comes ONLY from app_metadata (set by the
-- admin Edge Function / dashboard), never from user-editable metadata.
-- The very first user becomes admin (bootstrap).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  else
    v_role := coalesce(nullif(new.raw_app_meta_data ->> 'role', '')::user_role, 'se');
  end if;
  insert into public.profiles (id, full_name, role, employee_id, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role,
    new.raw_user_meta_data ->> 'employee_id',
    new.raw_user_meta_data ->> 'phone');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger observations_touch before update on public.observations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Notifications (in-app)
-- ---------------------------------------------------------------------
create or replace function public.notify_new_observation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_service text;
begin
  select s.owner_me_id, a.title, s.name into v_owner, v_title, v_service
  from public.activities a join public.services s on s.id = a.service_id
  where a.id = new.activity_id;

  insert into public.notifications (user_id, observation_id, kind, message)
  select p.id, new.id, 'observation',
         'New observation: ' || v_service || ' - ' || v_title
  from public.profiles p
  where p.active and p.id <> new.submitted_by
    and (p.role = 'gm' or p.id = v_owner);
  return new;
end $$;
create trigger observations_notify after insert on public.observations
  for each row execute function public.notify_new_observation();

create or replace function public.notify_new_remark()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_service text; v_label text;
begin
  select s.owner_me_id, a.title, s.name into v_owner, v_title, v_service
  from public.observations o
  join public.activities a on a.id = o.activity_id
  join public.services s on s.id = a.service_id
  where o.id = new.observation_id;

  v_label := case new.kind
    when 'remark'  then 'New remark'
    when 'resolve' then 'Observation resolved'
    else 'Observation reopened' end;

  insert into public.notifications (user_id, observation_id, kind, message)
  select p.id, new.observation_id, new.kind::text,
         v_label || ': ' || v_service || ' - ' || v_title
  from public.profiles p
  where p.active and p.id <> new.author_id
    and (p.role in ('se', 'gm') or p.id = v_owner);
  return new;
end $$;
create trigger remarks_notify after insert on public.observation_remarks
  for each row execute function public.notify_new_remark();

-- ---------------------------------------------------------------------
-- RPC: resolve / reopen an observation
-- ---------------------------------------------------------------------
create or replace function public.set_observation_status(
  p_obs uuid, p_status obs_status, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_owner uuid; v_cur obs_status;
begin
  v_role := public.auth_role();
  if v_role is null then raise exception 'Not allowed'; end if;

  select s.owner_me_id, o.status into v_owner, v_cur
  from public.observations o
  join public.activities a on a.id = o.activity_id
  join public.services s on s.id = a.service_id
  where o.id = p_obs;
  if not found then raise exception 'Observation not found'; end if;

  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'A note is required';
  end if;

  if p_status = 'resolved' then
    if v_role not in ('admin', 'gm', 'se') and not (v_role = 'me' and v_owner = auth.uid()) then
      raise exception 'Not allowed';
    end if;
    if v_cur = 'resolved' then raise exception 'Already resolved'; end if;
    update public.observations
       set status = 'resolved', resolved_by = auth.uid(), resolved_role = v_role,
           resolved_note = trim(p_note), resolved_at = now()
     where id = p_obs;
    insert into public.observation_remarks (observation_id, author_id, author_role, body, kind)
    values (p_obs, auth.uid(), v_role, trim(p_note), 'resolve');
  else
    if v_role not in ('admin', 'gm') and not (v_role = 'me' and v_owner = auth.uid()) then
      raise exception 'Only the owning ME or GM can reopen';
    end if;
    if v_cur = 'open' then raise exception 'Already open'; end if;
    update public.observations
       set status = 'open', resolved_by = null, resolved_role = null,
           resolved_note = null, resolved_at = null
     where id = p_obs;
    insert into public.observation_remarks (observation_id, author_id, author_role, body, kind)
    values (p_obs, auth.uid(), v_role, trim(p_note), 'reopen');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Recurring schedules -> activities
-- ---------------------------------------------------------------------
create or replace function public.generate_schedule_activities(p_schedule uuid, p_until date)
returns int language plpgsql set search_path = public as $$
declare
  s public.schedules%rowtype;
  d date; v_from date; v_to date; v_count int := 0; v_match boolean; v_last int;
begin
  select * into s from public.schedules where id = p_schedule;
  if not found or not s.active then return 0; end if;

  v_from := greatest(s.start_date, coalesce(s.last_generated + 1, s.start_date));
  v_to   := least(coalesce(s.end_date, p_until), p_until);
  if v_from > v_to then return 0; end if;

  for d in select generate_series(v_from, v_to, interval '1 day')::date loop
    v_match := case s.recurrence
      when 'daily'  then true
      when 'weekly' then extract(dow from d)::int = any (s.weekdays)
      when 'monthly' then
        extract(day from d)::int =
          least(coalesce(s.day_of_month, extract(day from s.start_date)::int),
                extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int)
      when 'quarterly' then
        (((extract(year from d)::int * 12 + extract(month from d)::int)
         - (extract(year from s.start_date)::int * 12 + extract(month from s.start_date)::int)) % 3 = 0)
        and extract(day from d)::int =
          least(coalesce(s.day_of_month, extract(day from s.start_date)::int),
                extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int)
    end;
    if v_match then
      insert into public.activities
        (service_id, schedule_id, title, description, location, activity_date,
         start_time, end_time, priority, agency, checklist, created_by)
      values
        (s.service_id, s.id, s.title, s.description, s.location, d,
         s.start_time, s.end_time, s.priority, s.agency, s.checklist, s.created_by)
      on conflict do nothing;
      v_count := v_count + 1;
    end if;
  end loop;

  update public.schedules set last_generated = v_to where id = s.id;
  return v_count;
end $$;

-- Extend every schedule the caller may edit, rolling 90 days ahead.
create or replace function public.extend_my_schedules(p_days int default 90)
returns int language plpgsql set search_path = public as $$
declare r record; v_total int := 0;
begin
  for r in select id from public.schedules where active loop
    v_total := v_total + public.generate_schedule_activities(r.id, current_date + p_days);
  end loop;
  return v_total;
end $$;

-- Stop a recurring schedule: deactivate it and remove FUTURE activities that
-- nobody has observed yet. Past activities and all observations are kept.
create or replace function public.stop_schedule(p_schedule uuid)
returns int language plpgsql set search_path = public as $$
declare v_deleted int;
begin
  update public.schedules set active = false where id = p_schedule;
  with del as (
    delete from public.activities a
    where a.schedule_id = p_schedule
      and a.activity_date >= current_date
      and not exists (select 1 from public.observations o where o.activity_id = a.id)
    returning 1)
  select count(*) into v_deleted from del;
  return v_deleted;
end $$;

-- Keep-alive ping (callable without login, exposes nothing)
create or replace function public.ping() returns timestamptz
language sql stable as $$ select now() $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.services            enable row level security;
alter table public.schedules           enable row level security;
alter table public.activities          enable row level security;
alter table public.observations        enable row level security;
alter table public.observation_photos  enable row level security;
alter table public.observation_remarks enable row level security;
alter table public.notifications       enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant execute on function public.ping() to anon;

-- profiles
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- services
create policy services_read on public.services for select to authenticated using (true);
create policy services_admin_write on public.services for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- schedules
create policy schedules_read on public.schedules for select to authenticated using (true);
create policy schedules_write on public.schedules for all to authenticated
  using (public.auth_role() = 'admin' or (public.auth_role() = 'me' and public.owns_service(service_id)))
  with check (public.auth_role() = 'admin' or (public.auth_role() = 'me' and public.owns_service(service_id)));

-- activities
create policy activities_read on public.activities for select to authenticated using (true);
create policy activities_write on public.activities for all to authenticated
  using (public.auth_role() = 'admin' or (public.auth_role() = 'me' and public.owns_service(service_id)))
  with check (public.auth_role() = 'admin' or (public.auth_role() = 'me' and public.owns_service(service_id)));

-- observations
create policy observations_read on public.observations for select to authenticated using (true);
create policy observations_insert on public.observations for insert to authenticated
  with check (public.auth_role() in ('se', 'admin') and submitted_by = auth.uid());
create policy observations_update_own on public.observations for update to authenticated
  using (submitted_by = auth.uid() and status = 'open')
  with check (submitted_by = auth.uid() and status = 'open');
-- Only content columns are updatable directly; status changes go via RPC.
revoke update on public.observations from authenticated;
grant update (monitored, checklist_results, remarks) on public.observations to authenticated;

-- photos
create policy photos_read on public.observation_photos for select to authenticated using (true);
create policy photos_insert on public.observation_photos for insert to authenticated
  with check (exists (select 1 from public.observations o
                      where o.id = observation_id and o.submitted_by = auth.uid()));
create policy photos_delete_own on public.observation_photos for delete to authenticated
  using (exists (select 1 from public.observations o
                 where o.id = observation_id and o.submitted_by = auth.uid() and o.status = 'open'));

-- remarks (ME owner / GM / admin may add; resolve+reopen rows come from the RPC)
create policy remarks_read on public.observation_remarks for select to authenticated using (true);
create policy remarks_insert on public.observation_remarks for insert to authenticated
  with check (
    author_id = auth.uid() and kind = 'remark'
    and author_role = public.auth_role()
    and (public.auth_role() in ('gm', 'admin')
         or (public.auth_role() = 'me' and public.owns_observation(observation_id))));

-- notifications
create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- Storage bucket for observation photos (private, signed URLs)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('observation-photos', 'observation-photos', false, 1048576,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_bucket_read on storage.objects for select to authenticated
  using (bucket_id = 'observation-photos');
create policy photos_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'observation-photos' and public.auth_role() in ('se', 'admin'));
create policy photos_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'observation-photos' and owner = auth.uid());
