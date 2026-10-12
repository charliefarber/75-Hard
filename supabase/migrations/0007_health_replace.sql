-- Shortcut sync: each run REPLACES the steps/calories it sends for a date, so a bad run is
-- fixed simply by running the Shortcut again. Built for a "last 7 days, Group by Day" Shortcut:
--   * today and the 6 days before it: the Shortcut's number replaces what's saved
--   * anything older (the partly-covered oldest day of the window): keep the higher number,
--     so a partial count can't shrink a real total
--   * zeros / missing values are ignored (Fill Missing days with no data)
--   * numbers she typed by hand are kept: calories always, steps unless Health is higher
-- Safe to run more than once.
create or replace function public.ingest_health(
  p_token     uuid,
  p_steps     numeric default null,
  p_calories  numeric default null,
  p_water_ml  numeric default null,
  p_date      date default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid;
  v_tz       text;
  v_today    date;
  v_date     date;
  v_replace  boolean;
  v_steps    int := case when p_steps > 0 then round(p_steps)::int end;
  v_cal      int := case when p_calories > 0 then round(p_calories)::int end;
begin
  select id, timezone into v_user, v_tz from public.profiles where health_sync_token = p_token;
  if v_user is null then
    raise exception 'invalid sync token' using errcode = '28000';
  end if;

  v_today   := (now() at time zone v_tz)::date;
  v_date    := coalesce(p_date, v_today);
  v_replace := v_date >= v_today - 6;

  insert into public.daily_logs as d (user_id, log_date, steps, steps_source, calories, calories_source, water_ml)
  values (
    v_user, v_date,
    v_steps, case when v_steps is not null then 'shortcut' end,
    v_cal,   case when v_cal   is not null then 'shortcut' end,
    coalesce(round(p_water_ml)::int, 0)
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

notify pgrst, 'reload schema';
