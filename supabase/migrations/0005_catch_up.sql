-- Catch-up: makes sure every column added after 0001 exists, then tells the Supabase API
-- to reload its schema cache so new columns are usable straight away.
-- Safe to run any number of times (it skips anything that's already there).

-- 0002: pet
alter table public.challenges add column if not exists pet_name text not null default 'Mochi';
alter table public.challenges add column if not exists treat_dates date[] not null default '{}';

-- 0003: which sloth
alter table public.challenges add column if not exists pet_style text not null default 'girl'
  check (pet_style in ('girl', 'guy', 'nb'));

-- 0004: birthday + birthday pass
alter table public.profiles   add column if not exists birthday date;
alter table public.profiles   add column if not exists birthday_pass_year integer;
alter table public.daily_logs add column if not exists birthday_pass boolean not null default false;

-- Refresh the API's view of the tables (fixes "Could not find the '…' column … in the schema cache").
notify pgrst, 'reload schema';
