-- 75 Hard tracker: schema, row-level security and the Apple Health shortcut endpoint.
-- Run once in the Supabase SQL editor (or with `supabase db push`).


-- ---------------------------------------------------------------------------
-- Profiles: one per auth user, holds goals and settings.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null default '',
  water_goal_ml       integer not null default 3785 check (water_goal_ml between 500 and 10000),
  step_goal           integer not null default 10000 check (step_goal between 0 and 100000),
  calorie_goal        integer check (calorie_goal is null or calorie_goal between 0 and 10000),
  workout_minutes     integer not null default 45 check (workout_minutes between 1 and 300),
  reading_goal_pages  integer not null default 10 check (reading_goal_pages between 1 and 500),
  steps_required      boolean not null default true,
  timezone            text not null default 'Europe/London',
  health_sync_token   uuid not null unique default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Challenges: each 75-day attempt. A restart closes the active one and opens a new one.
-- ---------------------------------------------------------------------------
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date  date not null,
  -- Days already done before she started using the app (e.g. tracked in Notes); counted as complete.
  credited_days integer not null default 0 check (credited_days between 0 and 75),
  status      text not null default 'active' check (status in ('active', 'completed', 'reset')),
  ended_on    date,
  created_at  timestamptz not null default now()
);

create unique index if not exists challenges_one_active_per_user
  on public.challenges (user_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Daily logs: one row per user per calendar day (independent of attempts,
-- so a restart never loses history).
-- workouts: [{ "done": bool, "minutes": int, "type": text, "outdoor": bool, "source": "manual"|"health" }, …]
-- ---------------------------------------------------------------------------
create table if not exists public.daily_logs (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date         date not null,
  workouts         jsonb not null default '[]'::jsonb,
  water_ml         integer not null default 0 check (water_ml >= 0),
  pages_read       integer not null default 0 check (pages_read >= 0),
  followed_diet    boolean not null default false,
  no_cheat_meal    boolean not null default false,
  no_alcohol       boolean not null default false,
  steps            integer check (steps is null or steps >= 0),
  steps_source     text,
  calories         integer check (calories is null or calories >= 0),
  calories_source  text,
  notes            text not null default '',
  updated_at       timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists daily_logs_touch on public.daily_logs;
create trigger daily_logs_touch before update on public.daily_logs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile automatically when someone signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security: everyone only ever sees their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.challenges enable row level security;
alter table public.daily_logs enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "own challenges" on public.challenges;
create policy "own challenges" on public.challenges
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own logs" on public.daily_logs;
create policy "own logs" on public.daily_logs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Apple Health bridge for the web version.
-- An iPhone Shortcut reads today's steps / dietary energy (Lifesum writes its
-- calories to Apple Health) and POSTs them to /rest/v1/rpc/ingest_health with the
-- user's private sync token. No login needed; the token is the credential.
-- ---------------------------------------------------------------------------
create or replace function public.ingest_health(
  p_token     uuid,
  p_steps     numeric default null,
  p_calories  numeric default null,
  p_water_ml  numeric default null,
  p_date      date default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid;
  v_tz    text;
  v_date  date;
begin
  select id, timezone into v_user, v_tz from public.profiles where health_sync_token = p_token;
  if v_user is null then
    raise exception 'invalid sync token' using errcode = '28000';
  end if;

  v_date := coalesce(p_date, (now() at time zone v_tz)::date);

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
    calories        = coalesce(excluded.calories, d.calories),
    calories_source = case when excluded.calories is null then d.calories_source else 'shortcut' end,
    water_ml        = greatest(d.water_ml, excluded.water_ml);

  return jsonb_build_object('ok', true, 'date', v_date);
end $$;

revoke all on function public.ingest_health(uuid, numeric, numeric, numeric, date) from public;
grant execute on function public.ingest_health(uuid, numeric, numeric, numeric, date) to anon, authenticated;
