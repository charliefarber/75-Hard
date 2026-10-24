-- Meal prep and one-tap saved meals. Safe to run more than once.
--
-- 1. meal_preps: a batch she cooked, with everything that went in (items, the same shape as a
--    saved meal's), split into equal portions that count down as she logs them. A portion in
--    the diary is an ordinary food_entries row whose food_key is 'prep:<batch id>'.
-- 2. saved_meals.slots: the meals a saved meal is offered at as a one-tap option.
--
-- Until this has been run the app still works: meal prep shows nothing yet and asks for this
-- migration when she saves a batch, and saved meals are saved without their slots.

-- 1. Meal prep -----------------------------------------------------------------------------
create table if not exists public.meal_preps (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  items          jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40
                                       and pg_column_size(items) <= 131072),
  portions       integer not null check (portions between 1 and 30),
  portions_left  numeric(4, 1) not null,
  made_on        date not null default current_date,
  created_at     timestamptz not null default now(),
  -- halves allowed (½ portion), never below zero or above the batch
  constraint meal_preps_left_check check (portions_left >= 0 and portions_left <= portions and portions_left * 2 = floor(portions_left * 2))
);
create index if not exists meal_preps_user on public.meal_preps (user_id, created_at desc);
alter table public.meal_preps enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meal_preps' and policyname = 'own preps') then
    create policy "own preps" on public.meal_preps for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.meal_preps from anon;
grant select, insert, update, delete on public.meal_preps to authenticated;

-- 2. Saved meals offered at chosen meals ------------------------------------------------------
alter table public.saved_meals add column if not exists slots text[];
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saved_meals_slots_check') then
    alter table public.saved_meals add constraint saved_meals_slots_check
      check (slots is null or slots <@ array['breakfast', 'lunch', 'dinner', 'snacks']::text[]);
  end if;
end $$;

-- Let the API see the new table and column straight away.
notify pgrst, 'reload schema';
