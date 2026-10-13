-- A simpler Shortcut: send the whole week of steps in ONE request, no Repeat loop.
--
-- The Shortcut does just:
--   1. Find Health Samples: Steps, last 7 days, Group By Day
--   2. Get Contents of URL → /rest/v1/rpc/sync_steps, JSON body:
--        p_token  (Text)  the sync token
--        p_steps  (Text)  Health Samples › Value       (a list: one number per line)
--        p_dates  (Text)  Health Samples › Start Date  (a list: one date per line)
--
-- The two lists are paired up line by line and each day goes through ingest_health, so the
-- same rules apply (every day sent replaces what's saved; steps typed by hand are kept
-- unless Health's number is higher). Dates are read in whatever format Shortcuts uses:
-- 2026-10-13, 2026-10-13T00:00:00+01:00, 13 Oct 2026 at 00:00, Oct 13, 2026, 13/10/2026,
-- Today / Yesterday. A JSON array works too.

create or replace function public.sync_steps(p_token uuid, p_steps text, p_dates text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz     text;
  v_today  date;
  v_vals   text[];
  v_dates  text[];
  v_saved  jsonb := '[]'::jsonb;
  v_skip   int := 0;
  i        int;
  s        text;
  v        numeric;
  d        date;
  m        text[];
  mn       text[];
  nm       text[];
  y        int;
  mo       int;
  dy       int;
  a        int;
  b        int;
  months   constant text[] := array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
begin
  select timezone into v_tz from public.profiles where health_sync_token = p_token;
  if not found then
    raise exception 'invalid sync token' using errcode = '28000';
  end if;
  v_tz := coalesce(v_tz, 'Europe/London');
  v_today := (now() at time zone v_tz)::date;

  -- Lists arrive as text with one item per line, or as a JSON array.
  if btrim(coalesce(p_steps, '')) like '[%' then
    select array_agg(x) into v_vals from jsonb_array_elements_text(p_steps::jsonb) x;
  else
    v_vals := array(select x from regexp_split_to_table(coalesce(p_steps, ''), '\s*[\r\n]+\s*') x where btrim(x) <> '');
  end if;
  if btrim(coalesce(p_dates, '')) like '[%' then
    select array_agg(x) into v_dates from jsonb_array_elements_text(p_dates::jsonb) x;
  else
    v_dates := array(select x from regexp_split_to_table(coalesce(p_dates, ''), '\s*[\r\n]+\s*') x where btrim(x) <> '');
  end if;

  if coalesce(cardinality(v_vals), 0) = 0 then
    raise exception 'p_steps is empty' using errcode = '22023';
  end if;
  if cardinality(v_vals) <> coalesce(cardinality(v_dates), 0) then
    raise exception 'p_steps has % values but p_dates has % dates. Make both fields Text (not Number) and set them to Health Samples › Value and Health Samples › Start Date.',
      cardinality(v_vals), coalesce(cardinality(v_dates), 0) using errcode = '22023';
  end if;

  for i in 1 .. cardinality(v_vals) loop
    -- the number ("8,159", "8159 steps", "8159.0")
    s := regexp_replace(v_vals[i], '[^0-9.]', '', 'g');
    v := case when s ~ '^\d+(\.\d+)?$' then s::numeric end;

    -- the date
    s := lower(btrim(v_dates[i]));
    d := null;
    begin
    m  := regexp_match(s, '(\d{4})-(\d{1,2})-(\d{1,2})');
    mn := regexp_match(s, '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)');
    nm := regexp_match(s, '(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})');
    if s ~ '^(today|yesterday)' then
      d := v_today - case when s like 'yesterday%' then 1 else 0 end;
    elsif s ~ '^\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}.*(z|[+-]\d{2}:?\d{2})$' then
      d := (s::timestamptz at time zone v_tz)::date;   -- a timestamp with offset: her local day
    elsif m is not null then
      d := make_date(m[1]::int, m[2]::int, m[3]::int);
    elsif mn is not null then
      mo := array_position(months, mn[1]);
      s := regexp_replace(s, '\d{1,2}:\d{2}(:\d{2})?', '', 'g');        -- drop the time
      y := (regexp_match(s, '(\d{4})'))[1]::int;
      s := regexp_replace(s, '\d{4}', '', 'g');
      dy := (regexp_match(s, '\m(\d{1,2})\M'))[1]::int;
      if dy is not null then
        d := make_date(coalesce(y, extract(year from v_today)::int), mo, dy);
        if y is null and d > v_today + 1 then d := (d - interval '1 year')::date; end if;
      end if;
    elsif nm is not null then
      a := nm[1]::int; b := nm[2]::int; y := nm[3]::int;
      if y < 100 then y := y + 2000; end if;
      if a > 12 or (b <= 12 and v_tz not like 'America/%') then
        d := make_date(y, b, a);   -- day/month (UK)
      else
        d := make_date(y, a, b);   -- month/day (US)
      end if;
    end if;
    exception when others then
      d := null;                   -- e.g. 31/02: skip that line
    end;

    if v is null or d is null or d > v_today + 1 or d < v_today - 400 then
      v_skip := v_skip + 1;
      continue;
    end if;
    perform public.ingest_health(p_token, v, null, null, d);
    v_saved := v_saved || jsonb_build_object('date', d, 'steps', round(v)::int);
  end loop;

  if jsonb_array_length(v_saved) = 0 then
    raise exception 'no days could be read (first date was "%")', v_dates[1] using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true, 'saved', v_saved, 'skipped', v_skip);
end $$;

revoke all on function public.sync_steps(uuid, text, text) from public;
grant execute on function public.sync_steps(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
