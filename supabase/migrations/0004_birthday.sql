-- Birthday + the yearly birthday pass (makes one chosen day count as complete).
alter table public.profiles   add column if not exists birthday date;
alter table public.profiles   add column if not exists birthday_pass_year integer;
alter table public.daily_logs add column if not exists birthday_pass boolean not null default false;
