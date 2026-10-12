-- Security & data-protection pass. Safe to run more than once.
--
-- 1. Least-privilege table access. Row-level security already limits everyone to their own
--    rows, but the default Supabase grants also gave the signed-out "anon" role (and signed-in
--    users) every table privilege, including TRUNCATE, which row-level security doesn't cover.
--    The app never reads tables signed out, and never deletes rows directly.
revoke all on public.profiles, public.challenges, public.daily_logs from anon;
revoke all on public.profiles, public.challenges, public.daily_logs from authenticated;

grant select on public.profiles to authenticated;
-- The Shortcut sync token is a password-like secret: users can read their own, but only the
-- server can create or change it (see regenerate_sync_token below).
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name, water_goal_ml, step_goal, calorie_goal, workout_minutes,
              reading_goal_pages, steps_required, timezone, birthday, birthday_pass_year)
  on public.profiles to authenticated;

grant select, insert, update on public.challenges to authenticated;
grant select, insert, update on public.daily_logs to authenticated;

-- Tables and functions added later don't get handed to signed-out visitors automatically.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- 2. Functions: empty search_path (everything is schema-qualified), no stray execute rights.
alter function public.touch_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. Shortcut endpoint: same behaviour as 0007, plus sanity limits on what it accepts.
create or replace function public.ingest_health(
  p_token     uuid,
  p_steps     numeric default null,
  p_calories  numeric default null,
  p_water_ml  numeric default null,
  p_date      date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user     uuid;
  v_tz       text;
  v_today    date;
  v_date     date;
  v_replace  boolean;
  -- Ignore zeros, negatives and absurd values instead of storing them.
  v_steps    int := case when p_steps    > 0 and p_steps    <= 200000 then round(p_steps)::int end;
  v_cal      int := case when p_calories > 0 and p_calories <= 20000  then round(p_calories)::int end;
  v_water    int := case when p_water_ml > 0 and p_water_ml <= 20000  then round(p_water_ml)::int end;
begin
  select id, timezone into v_user, v_tz from public.profiles where health_sync_token = p_token;
  if v_user is null then
    raise exception 'invalid sync token' using errcode = '28000';
  end if;

  v_today   := (now() at time zone v_tz)::date;
  v_date    := coalesce(p_date, v_today);
  if v_date > v_today + 1 or v_date < v_today - 400 then
    raise exception 'date out of range' using errcode = '22008';
  end if;
  v_replace := v_date >= v_today - 6;

  insert into public.daily_logs as d (user_id, log_date, steps, steps_source, calories, calories_source, water_ml)
  values (
    v_user, v_date,
    v_steps, case when v_steps is not null then 'shortcut' end,
    v_cal,   case when v_cal   is not null then 'shortcut' end,
    coalesce(v_water, 0)
  )
  on conflict (user_id, log_date) do update set
    steps = case
      when excluded.steps is null then d.steps
      when d.steps_source = 'manual' or not v_replace then greatest(coalesce(d.steps, 0), excluded.steps)
      else excluded.steps
    end,
    steps_source = case
      when excluded.steps is null then d.steps_source
      when d.steps_source = 'manual' and coalesce(d.steps, 0) >= excluded.steps then 'manual'
      when not v_replace and coalesce(d.steps, 0) >= excluded.steps then d.steps_source
      else 'shortcut'
    end,
    calories = case
      when excluded.calories is null or d.calories_source = 'manual' then d.calories
      when not v_replace then greatest(coalesce(d.calories, 0), excluded.calories)
      else excluded.calories
    end,
    calories_source = case
      when excluded.calories is null or d.calories_source = 'manual' then d.calories_source
      when not v_replace and coalesce(d.calories, 0) >= excluded.calories then d.calories_source
      else 'shortcut'
    end,
    water_ml = greatest(d.water_ml, excluded.water_ml);

  return jsonb_build_object('ok', true, 'date', v_date);
end $$;

revoke all on function public.ingest_health(uuid, numeric, numeric, numeric, date) from public;
grant execute on function public.ingest_health(uuid, numeric, numeric, numeric, date) to anon, authenticated;

-- 4. New sync token, generated on the server.
create or replace function public.regenerate_sync_token() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  update public.profiles set health_sync_token = gen_random_uuid()
   where id = auth.uid()
   returning health_sync_token into v_token;
  return v_token;
end $$;
revoke all on function public.regenerate_sync_token() from public, anon;
grant execute on function public.regenerate_sync_token() to authenticated;

-- 5. Right to erasure: delete your own account and everything in it (profile, challenges and
--    daily logs all cascade from auth.users).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = v_uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
