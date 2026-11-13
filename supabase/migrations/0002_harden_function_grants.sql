-- Postgres grants EXECUTE on new functions to PUBLIC by default, so anonymous
-- callers could reach every function through the REST rpc endpoint. Close that:
-- only signed-in users may call the functions the app and the RLS policies need,
-- and trigger functions are not callable by anyone over the API.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.ping() to anon, authenticated;
grant execute on function
  public.auth_role(),
  public.owns_service(uuid),
  public.owns_observation(uuid),
  public.set_observation_status(uuid, obs_status, text),
  public.generate_schedule_activities(uuid, date),
  public.extend_my_schedules(int),
  public.stop_schedule(uuid)
to authenticated;

alter function public.ping() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
