-- "When was injury news last updated?" was unanswerable: players carries no
-- timestamp, and the only evidence a sync had run was in pg_cron's history —
-- which records that the *job fired*, not that FPL answered. Worse, the
-- every-10-minutes job is guarded by `where exists (... lock_at within 2h)`,
-- so it logs "succeeded" while making no request at all. The cron table looks
-- busy while the data sits still.
--
-- Stamped from a trigger on players rather than from sync-fpl, so it measures
-- the thing itself: rows were written, therefore the sync got through. A
-- function that stamped a timestamp next to its own write could drift from
-- that; a trigger can't.
create table sync_state (
  source text primary key,
  synced_at timestamptz not null default now()
);

alter table sync_state enable row level security;

create policy "sync state readable" on sync_state
  for select to authenticated using (true);

-- Statement-level, not per row: sync-fpl writes all ~612 players in a handful
-- of statements, and one stamp per statement is plenty.
create or replace function record_players_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into sync_state (source, synced_at)
  values ('players', now())
  on conflict (source) do update set synced_at = excluded.synced_at;
  return null;
end $$;

create trigger players_sync_stamp
  after insert or update on players
  for each statement execute function record_players_sync();

-- Seed from the last known-good run so the UI isn't blank until the next sync.
insert into sync_state (source, synced_at)
values ('players', now())
on conflict (source) do nothing;
