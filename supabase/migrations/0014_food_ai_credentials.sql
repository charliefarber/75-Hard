-- Cloudflare credentials for the food function, kept encrypted in Supabase Vault, for when they
-- aren't set as Edge Function secrets. Add them once in the SQL editor:
--   select vault.create_secret('<account id>', 'cf_account_id');
--   select vault.create_secret('<api token>', 'cf_api_token');
-- Only the server (service role) can call these functions; the app and visitors can't.

create or replace function public.food_ai_credentials()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_object_agg(name, decrypted_secret)
  from vault.decrypted_secrets
  where name in ('cf_account_id', 'cf_api_token');
$$;

revoke all on function public.food_ai_credentials() from public, anon, authenticated;
grant execute on function public.food_ai_credentials() to service_role;

-- The daily estimate counter: rely on the grant (service role only) rather than reading the
-- request's JWT, which newer Supabase API keys don't carry in the same way.
create or replace function public.ai_usage_bump(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_calls integer;
begin
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

notify pgrst, 'reload schema';
