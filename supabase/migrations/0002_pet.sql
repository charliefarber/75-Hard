-- Challenge pet: its name, and the missed days a treat was spent on.
alter table public.challenges add column if not exists pet_name text not null default 'Mochi';
alter table public.challenges add column if not exists treat_dates date[] not null default '{}';
