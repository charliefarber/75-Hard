-- Food diary: everything she eats, her own food library and saved meals, macro goals, and a
-- daily cap on photo/description estimates. Safe to run more than once.

-- 1. What she ate --------------------------------------------------------------------------
create table if not exists public.food_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date    date not null,
  meal        text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  name        text not null check (char_length(name) between 1 and 120),
  brand       text check (char_length(brand) <= 80),
  food_key    text check (char_length(food_key) <= 80),
  amount      numeric(9, 2) not null check (amount > 0 and amount <= 100000),
  unit        text not null check (char_length(unit) between 1 and 40),
  grams       numeric(8, 1) check (grams is null or (grams >= 0 and grams <= 20000)),
  kcal        numeric(7, 1) not null check (kcal >= 0 and kcal <= 20000),
  protein_g   numeric(6, 1) check (protein_g is null or protein_g between 0 and 2000),
  carbs_g     numeric(6, 1) check (carbs_g is null or carbs_g between 0 and 2000),
  fat_g       numeric(6, 1) check (fat_g is null or fat_g between 0 and 2000),
  fiber_g     numeric(6, 1) check (fiber_g is null or fiber_g between 0 and 1000),
  sugar_g     numeric(6, 1) check (sugar_g is null or sugar_g between 0 and 2000),
  sat_fat_g   numeric(6, 1) check (sat_fat_g is null or sat_fat_g between 0 and 1000),
  salt_g      numeric(6, 2) check (salt_g is null or salt_g between 0 and 500),
  source      text not null default 'basic' check (source in ('basic', 'off', 'custom', 'quick', 'photo', 'describe', 'meal')),
  -- the food as it was when logged, so the amount can be changed later
  food        jsonb check (food is null or (jsonb_typeof(food) = 'object' and pg_column_size(food) <= 8192)),
  created_at  timestamptz not null default now()
);
create index if not exists food_entries_user_date on public.food_entries (user_id, log_date);
alter table public.food_entries enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'food_entries' and policyname = 'own food') then
    create policy "own food" on public.food_entries for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
grant select, insert, update, delete on public.food_entries to authenticated;

-- 2. Her food library: favourites, her own foods, and what she logged recently --------------
create table if not exists public.my_foods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key          text not null check (char_length(key) between 1 and 80),
  food         jsonb not null check (jsonb_typeof(food) = 'object' and pg_column_size(food) <= 8192),
  favorite     boolean not null default false,
  custom       boolean not null default false,
  uses         integer not null default 0 check (uses >= 0),
  last_amount  numeric(9, 2) check (last_amount is null or last_amount > 0),
  last_unit    text check (char_length(last_unit) <= 40),
  last_meal    text check (last_meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  last_used    timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists my_foods_user_used on public.my_foods (user_id, last_used desc);
alter table public.my_foods enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'my_foods' and policyname = 'own foods') then
    create policy "own foods" on public.my_foods for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
grant select, insert, update, delete on public.my_foods to authenticated;

-- 3. Saved meals (one tap logs every item) -------------------------------------------------
create table if not exists public.saved_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  items       jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30
                                    and pg_column_size(items) <= 65536),
  uses        integer not null default 0 check (uses >= 0),
  last_used   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists saved_meals_user on public.saved_meals (user_id);
alter table public.saved_meals enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_meals' and policyname = 'own meals') then
    create policy "own meals" on public.saved_meals for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
grant select, insert, update, delete on public.saved_meals to authenticated;

-- 4. Goals: macros (grams a day) and active calories ------------------------------------------
alter table public.profiles
  add column if not exists protein_goal_g   integer,
  add column if not exists carbs_goal_g     integer,
  add column if not exists fat_goal_g       integer,
  add column if not exists active_goal_kcal integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_food_goals_check') then
    alter table public.profiles add constraint profiles_food_goals_check check (
      (protein_goal_g is null or protein_goal_g between 0 and 1000)
      and (carbs_goal_g is null or carbs_goal_g between 0 and 1000)
      and (fat_goal_g is null or fat_goal_g between 0 and 1000)
      and (active_goal_kcal is null or active_goal_kcal between 50 and 5000)
    );
  end if;
end $$;
grant update (protein_goal_g, carbs_goal_g, fat_goal_g, active_goal_kcal) on public.profiles to authenticated;

-- 5. Daily cap on photo / description estimates (the server function counts, nobody else) -----
create table if not exists public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  calls    integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security; -- no policies: only the server function

create or replace function public.ai_usage_bump(p_user uuid, p_limit integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_calls integer;
begin
  -- only the server function (service role) may count
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.ai_usage as u (user_id, day, calls) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set calls = u.calls + 1
  returning calls into v_calls;
  if v_calls > p_limit then
    raise exception 'daily limit reached' using errcode = 'P0001';
  end if;
  return v_calls;
end $$;
revoke all on function public.ai_usage_bump(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_usage_bump(uuid, integer) to service_role;

-- 6. Calories logged in the food diary win over the Shortcut, like numbers typed by hand ------
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
      when excluded.calories is null or d.calories_source in ('manual', 'food') then d.calories
      when not v_replace then greatest(coalesce(d.calories, 0), excluded.calories)
      else excluded.calories
    end,
    calories_source = case
      when excluded.calories is null or d.calories_source in ('manual', 'food') then d.calories_source
      when not v_replace and coalesce(d.calories, 0) >= excluded.calories then d.calories_source
      else 'shortcut'
    end,
    water_ml = greatest(d.water_ml, excluded.water_ml);

  return jsonb_build_object('ok', true, 'date', v_date);
end $$;

notify pgrst, 'reload schema';
