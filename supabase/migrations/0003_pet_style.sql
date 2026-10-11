-- Which sloth she picked: 'girl', 'guy' or 'nb' (non-binary).
alter table public.challenges add column if not exists pet_style text not null default 'girl'
  check (pet_style in ('girl', 'guy', 'nb'));
