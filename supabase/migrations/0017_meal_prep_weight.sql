-- Meal prep by weight. Safe to run more than once.
--
-- cooked_grams: what the whole batch weighed once cooked (optional). With it she can log
-- "100 g of the lasagne" and the calories and macros are worked out from the batch.
-- portions_left can now be any amount (100 g of a 1,200 g batch split in 4 is 0.333 of a
-- portion), not just halves.
--
-- Until this has been run the app still works: batches without a weight log as before, and
-- saving a weight asks for this migration.

alter table public.meal_preps add column if not exists cooked_grams numeric(7, 1);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meal_preps_cooked_grams_check') then
    alter table public.meal_preps add constraint meal_preps_cooked_grams_check
      check (cooked_grams is null or (cooked_grams > 0 and cooked_grams <= 50000));
  end if;
end $$;

alter table public.meal_preps drop constraint if exists meal_preps_left_check;
alter table public.meal_preps alter column portions_left type numeric(7, 3);
alter table public.meal_preps add constraint meal_preps_left_check check (portions_left >= 0 and portions_left <= portions);

notify pgrst, 'reload schema';
