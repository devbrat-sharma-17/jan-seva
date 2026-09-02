-- ============================================================
-- JAN-SEVA — atomic rate limiting
-- ============================================================
-- FOUND BY HTTP TESTING, NOT BY READING THE CODE.
--
-- api/_lib/rateLimit.ts counted like this:
--
--     const existing = await select(...);            -- read
--     const next = (existing[0]?.count ?? 0) + 1;    -- increment in JS
--     await upsert(..., { count: next });            -- write
--
-- Three statements, three round trips, no lock. Twenty-five concurrent
-- requests all read the same count, all compute the same `next`, and all
-- write it — so twenty-five requests consumed ONE unit of a fifteen-unit
-- budget and every one was allowed.
--
-- Sequential callers were limited correctly, which is why this survived
-- review: it works exactly as intended right up until someone sends
-- requests in parallel, which is the only way an abusive script ever
-- sends them. A burst of 25 against a limit of 15 produced zero 429s.
--
-- The fix is one statement. `on conflict do update` takes a row lock, so
-- concurrent callers serialise on it and each sees a distinct count.

/**
 * Records one hit and returns the resulting count, atomically.
 *
 * The caller compares the returned count against its own limit — the
 * policy stays in TypeScript beside the bucket definitions, and only the
 * counting moves into the database, which is the part that had to be
 * atomic and could not be.
 */
create or replace function consume_rate_limit(
  p_bucket       text,
  p_subject      text,
  p_window_start timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into rate_limits (bucket, subject, window_start, count)
  values (p_bucket, p_subject, p_window_start, 1)
  on conflict (bucket, subject, window_start)
    do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

-- Server-only, like every other function here. A client that could call
-- this could inflate someone else's counter and lock them out — or, more
-- cheaply, simply decline to call it.
revoke execute on function consume_rate_limit(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function consume_rate_limit(text, text, timestamptz)
  to service_role;
