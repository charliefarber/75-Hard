-- Clean-up: remove the one-off test endpoint (ingest_health_week) and the table it wrote to.
-- It was added by hand once to see what a single "send the whole week" Shortcut step sends.
-- Result: Shortcuts sent one combined number rather than a day-by-day list, so the
-- day-by-day loop calling ingest_health stays the way to sync and the test isn't needed.
-- Safe to run more than once.

drop function if exists public.ingest_health_week(uuid, text, text);
drop table if exists public.health_sync_log;
