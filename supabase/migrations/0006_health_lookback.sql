-- Let the Shortcut send the last few days, not just today.
-- Steps: always keep the higher number (unchanged).
-- Calories: today's number replaces what's saved (so deleting a Lifesum entry lowers it);
-- for earlier days keep the higher number, so a partial look-back window can't shrink a real total.
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
  v_user   uuid;
  v_tz     text;
  v_today  date;
  v_date   date;
begin
  select id, timezone into v_user, v_tz from public.profiles where health_sync_token = p_token;
  if v_user is null then
    raise exception 'invalid sync token' using errcode = '28000';
  end if;

  v_today := (now() at time zone v_tz)::date;
  v_date  := coalesce(p_date, v_today);

  insert into public.daily_logs as d (user_id, log_date, steps, steps_source, calories, calories_source, water_ml)
  values (
    v_user, v_date,
    round(p_steps)::int, case when p_steps is not null then 'shortcut' end,
    case when p_calories > 0 then round(p_calories)::int end, case when p_calories > 0 then 'shortcut' end,
    coalesce(round(p_water_ml)::int, 0)
  )
  on conflict (user_id, log_date) do update set
    steps           = case when excluded.steps is null then d.steps else greatest(coalesce(d.steps, 0), excluded.steps) end,
    steps_source    = case when excluded.steps is null then d.steps_source else 'shortcut' end,
    calories        = case
                        when excluded.calories is null then d.calories
                        when v_date = v_today then excluded.calories
                        else greatest(coalesce(d.calories, 0), excluded.calories)
                      end,
    calories_source = case when excluded.calories is null then d.calories_source else 'shortcut' end,
    water_ml        = greatest(d.water_ml, excluded.water_ml);

  return jsonb_build_object('ok', true, 'date', v_date);
end $$;

revoke all on function public.ingest_health(uuid, numeric, numeric, numeric, date) from public;
grant execute on function public.ingest_health(uuid, numeric, numeric, numeric, date) to anon, authenticated;

notify pgrst, 'reload schema';
