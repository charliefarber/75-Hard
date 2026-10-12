-- Tidy-ups from Supabase's security advisor. Safe to run more than once.
-- handle_new_user is only ever used by the sign-up trigger; nobody should call it over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Pin the search_path on the updated_at trigger function.
alter function public.touch_updated_at() set search_path = public;
-- ingest_health stays callable without signing in on purpose: the iPhone Shortcut uses it,
-- and it does nothing without a valid private sync token.
