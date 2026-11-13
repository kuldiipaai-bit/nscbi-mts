-- Defence in depth if public sign-up is ever left enabled:
--  * the bootstrap admin must use the email admin@mts.local (first user only)
--  * a user with no role in app_metadata (self-registered, or created by the admin
--    Edge Function, which sets role and activates the profile right after) starts
--    INACTIVE, and inactive users cannot read or write anything (auth_role() is null).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   user_role;
  v_active boolean := true;
  v_meta   text := nullif(new.raw_app_meta_data ->> 'role', '');
begin
  if not exists (select 1 from public.profiles) and new.email = 'admin@mts.local' then
    v_role := 'admin';
  elsif v_meta is not null then
    v_role := v_meta::user_role;
  else
    v_role := 'se';
    v_active := false;
  end if;
  insert into public.profiles (id, full_name, role, employee_id, phone, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role,
    new.raw_user_meta_data ->> 'employee_id',
    new.raw_user_meta_data ->> 'phone',
    v_active);
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
