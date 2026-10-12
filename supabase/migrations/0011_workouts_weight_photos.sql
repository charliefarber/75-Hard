-- Workouts that add up to a daily total, details for calorie estimates, daily weigh-ins and
-- private progress photos. Safe to run more than once.

-- 1. Profile ------------------------------------------------------------------------------

-- Daily workout total in minutes (replaces "two workouts of N minutes"). Existing accounts
-- keep what they had: two × their old workout length.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'workout_goal_minutes') then
    alter table public.profiles add column workout_goal_minutes int not null default 90;
    update public.profiles set workout_goal_minutes = least(600, greatest(10, workout_minutes * 2));
  end if;
end $$;

alter table public.profiles
  add column if not exists height_cm         numeric(4,1),
  add column if not exists sex               text,
  -- null = pick from the phone's region (kg, or lb in the US)
  add column if not exists weight_unit       text,
  add column if not exists workout_favorites jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_body_check') then
    alter table public.profiles add constraint profiles_body_check check (
      workout_goal_minutes between 10 and 600
      and (height_cm is null or height_cm between 100 and 250)
      and (sex is null or sex in ('female', 'male'))
      and (weight_unit is null or weight_unit in ('kg', 'lb', 'st'))
      and case when jsonb_typeof(workout_favorites) = 'array'
               then jsonb_array_length(workout_favorites) <= 40 and pg_column_size(workout_favorites) <= 16384
               else false end
    );
  end if;
end $$;

-- The app may change these too (column-level grants, see 0009_security.sql).
grant update (workout_goal_minutes, height_cm, sex, weight_unit, workout_favorites)
  on public.profiles to authenticated;

-- 2. Daily logs ---------------------------------------------------------------------------

alter table public.daily_logs
  add column if not exists weight_kg  numeric(5,2),
  add column if not exists photo_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'daily_logs_body_check') then
    alter table public.daily_logs add constraint daily_logs_body_check check (
      (weight_kg is null or weight_kg between 20 and 400)
      -- a photo path always points inside the owner's own folder
      and (photo_path is null or (length(photo_path) <= 200 and split_part(photo_path, '/', 1) = user_id::text))
      and case when jsonb_typeof(workouts) = 'array'
               then jsonb_array_length(workouts) <= 40 and pg_column_size(workouts) <= 32768
               else false end
    );
  end if;
end $$;

-- 3. Progress photos ----------------------------------------------------------------------
-- A private bucket: no public links. Each person's photos live in a folder named after their
-- user id and only they can see, add or delete them. The app shows them through short-lived
-- signed links, and strips location data from the photo before it's uploaded.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'progress photos: read own') then
    create policy "progress photos: read own" on storage.objects for select to authenticated
      using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'progress photos: add own') then
    create policy "progress photos: add own" on storage.objects for insert to authenticated
      with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'progress photos: delete own') then
    create policy "progress photos: delete own" on storage.objects for delete to authenticated
      using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

notify pgrst, 'reload schema';
