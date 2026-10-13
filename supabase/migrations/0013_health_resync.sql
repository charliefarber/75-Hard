-- Shortcut sync: whatever Apple Health sends now wins, for any day it sends.
--
-- Until now only today and the 6 days before it were replaced; older days could only go up.
-- That meant fixing the Shortcut and running it again couldn't correct older days that had
-- come in too high. Now every day the Shortcut sends is replaced with the fresh number.
-- Still kept:
--   * steps typed by hand, unless Health's number is higher
--   * calories typed by hand or coming from the in-app food diary
--   * water only goes up (it's also tapped in by hand)
-- Also records when the Shortcut last sent something, so Profile can show it.

alter table public.profiles add column if not exists health_synced_at timestamptz;

create or replace function public.ingest_health(
  p_token uuid,
  p_steps numeric default null,
  p_calories numeric default null,
  p_water_ml numeric default null,
  p_date date default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid;
  v_tz    text;
  v_today date;
  v_date  date;
  v_steps int := case when p_steps    > 0 and p_steps    <= 200000 then round(p_steps)::int end;
  v_cal   int := case when p_calories > 0 and p_calories <= 20000  then round(p_calories)::int end;
  v_water int := case when p_water_ml > 0 and p_water_ml <= 20000  then round(p_water_ml)::int end;
begin
  select id, timezone into v_user, v_tz from public.profiles where health_sync_token = p_token;
  if v_user is null then
    raise exception 'invalid sync token' using errcode = '28000';
  end if;
  v_today := (now() at time zone coalesce(v_tz, 'Europe/London'))::date;
  v_date  := coalesce(p_date, v_today);
  if v_date > v_today + 1 or v_date < v_today - 400 then
    raise exception 'date out of range' using errcode = '22008';
  end if;

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
      when d.steps_source = 'manual' then greatest(coalesce(d.steps, 0), excluded.steps)
      else excluded.steps
    end,
    steps_source = case
      when excluded.steps is null then d.steps_source
      when d.steps_source = 'manual' and coalesce(d.steps, 0) >= excluded.steps then 'manual'
      else 'shortcut'
    end,
    calories = case
      when excluded.calories is null or d.calories_source in ('manual', 'food') then d.calories
      else excluded.calories
    end,
    calories_source = case
      when excluded.calories is null or d.calories_source in ('manual', 'food') then d.calories_source
      else 'shortcut'
    end,
    water_ml = greatest(d.water_ml, excluded.water_ml);

  update public.profiles set health_synced_at = now() where id = v_user;
  return jsonb_build_object('ok', true, 'date', v_date, 'steps', v_steps, 'calories', v_cal);
end $$;

revoke all on function public.ingest_health(uuid, numeric, numeric, numeric, date) from public;
grant execute on function public.ingest_health(uuid, numeric, numeric, numeric, date) to anon, authenticated;

notify pgrst, 'reload schema';
