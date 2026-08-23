-- pg_cron runs *inside* Postgres, which is why it's used instead of Vercel
-- Hobby cron (once a day — useless for a T-2h reminder) and keeps the free
-- Supabase project from pausing after a week idle.
--
-- The project URL and service-role key are never hardcoded here: they're
-- read from Supabase Vault at call time. If they haven't been set (see
-- DEPLOY.md), every job below fires on schedule, finds nothing in the
-- Vault, and silently no-ops — which is exactly the failure mode DEPLOY.md
-- warns about, so we at least turn it into a WARNING in the Postgres logs
-- rather than a swallowed exception.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;

create or replace function call_edge_function(function_name text, payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_project_url text;
  v_service_key text;
begin
  select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_key from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_key is null then
    raise warning 'wingback: Vault secrets project_url/service_role_key are not set - % was skipped', function_name;
    return;
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json'
    ),
    body := payload
  );
end;
$$;

-- squads, injuries, fixtures, deadlines
select cron.schedule('wingback-sync-hourly', '0 * * * *', $$select call_edge_function('sync-fpl');$$);

-- late team news: every 10 min, only within 2h of a lock
select cron.schedule('wingback-sync-prelock', '*/10 * * * *', $$
  select call_edge_function('sync-fpl')
  where exists (
    select 1 from gameweeks
    where lock_at is not null
      and lock_at > now()
      and lock_at <= now() + interval '2 hours'
  );
$$);

-- email at T-24h; email + SMS at T-2h (the function itself is idempotent)
select cron.schedule('wingback-remind', '*/15 * * * *', $$select call_edge_function('remind');$$);

-- goals from the live endpoint while a gameweek is in progress
select cron.schedule('wingback-score-live', '*/10 * * * *', $$
  select call_edge_function('score')
  where exists (
    select 1 from gameweeks
    where not finished
      and lock_at is not null
      and lock_at <= now()
  );
$$);

-- post-match corrections (query string, since score/index.ts reads `settle` from the URL)
select cron.schedule('wingback-score-settle', '30 3 * * *', $$select call_edge_function('score?settle=true');$$);
