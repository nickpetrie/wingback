-- Alerts: one place that decides who hears about what, and how.
--
-- Two independent axes, because they answer different questions:
--   * channels (email / sms / push) — how you want to be interrupted
--   * types (pick reminders, someone picked, a goal, injury news, results)
--     — what you care about at all
-- A type you have switched off is never generated for you. A type you have on
-- always lands in the in-app feed, and additionally goes out on whichever
-- channels you have switched on. That split is what makes the settings screen
-- explainable: the types are the subscription, the channels are the delivery.

create table alert_prefs (
  entrant_id uuid primary key references entrants(id) on delete cascade,

  -- Channels. Email on by default because it's the one address we're sure of;
  -- SMS off because it costs money and needs a number nobody has entered yet.
  email boolean not null default true,
  sms boolean not null default false,
  push boolean not null default true,

  -- Types. All on by default except the chatty one: a message every time any
  -- of the other four picks is the setting most likely to make someone turn
  -- the whole thing off, so it is opt-in.
  pick_reminders boolean not null default true,
  pick_activity boolean not null default false,
  goal_alerts boolean not null default true,
  injury_alerts boolean not null default true,
  results boolean not null default true,

  updated_at timestamptz not null default now()
);

alter table alert_prefs enable row level security;

create policy "own alert prefs readable" on alert_prefs
  for select to authenticated using (entrant_id = (select current_entrant_id()));
create policy "own alert prefs insertable" on alert_prefs
  for insert to authenticated with check (entrant_id = (select current_entrant_id()));
create policy "own alert prefs updatable" on alert_prefs
  for update to authenticated
  using (entrant_id = (select current_entrant_id()))
  with check (entrant_id = (select current_entrant_id()));

-- Everyone who already exists, and everyone who is added later. Without the
-- trigger a new entrant has no row, every "is this switched on?" check reads
-- null, and they silently receive nothing at all.
insert into alert_prefs (entrant_id) select id from entrants on conflict do nothing;

create or replace function create_alert_prefs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into alert_prefs (entrant_id) values (new.id) on conflict do nothing;
  return null;
end $$;

create trigger entrants_alert_prefs
  after insert on entrants
  for each row execute function create_alert_prefs();

-- The in-app feed behind the bell. Every alert lands here first and is
-- delivered outward from here, so "what was I told, and when" has one answer
-- rather than being scattered across a mail provider and a push service.
create table notifications (
  id bigserial primary key,
  entrant_id uuid not null references entrants(id) on delete cascade,
  kind text not null check (kind in ('pick_reminder', 'pick_made', 'goal', 'injury', 'results')),
  title text not null,
  body text not null,
  url text not null default '/',
  gameweek smallint references gameweeks(id),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- When the outbound channels were attempted. Null means the dispatcher has
  -- not seen this row yet; it is not a claim that anything was delivered.
  delivered_at timestamptz
);

create index notifications_entrant_idx on notifications (entrant_id, created_at desc);
create index notifications_pending_idx on notifications (created_at) where delivered_at is null;

alter table notifications enable row level security;

-- Read your own, and mark your own read. Nobody writes a notification from
-- the app: they are created by the triggers below and by edge functions on
-- the service role, which bypasses RLS.
create policy "own notifications readable" on notifications
  for select to authenticated using (entrant_id = (select current_entrant_id()));
create policy "own notifications updatable" on notifications
  for update to authenticated
  using (entrant_id = (select current_entrant_id()))
  with check (entrant_id = (select current_entrant_id()));

-- Live, so the bell fills in without a reload. Same reasoning as picks in
-- 20260101000021 — RLS still applies, so an entrant only ever receives their
-- own rows.
alter publication supabase_realtime add table notifications;

-- — The two events that come straight off the picks table. Both are AFTER
--   triggers: picks_guard is a BEFORE trigger and owns whether the write is
--   allowed at all, and nothing here may interfere with that. —

create or replace function notify_pick_made()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_who text;
  v_player text;
  v_team text;
begin
  select display_name into v_who from entrants where id = new.entrant_id;
  select p.web_name, t.short_name into v_player, v_team
  from players p join teams t on t.id = p.team_id
  where p.code = new.player_code;

  insert into notifications (entrant_id, kind, title, body, gameweek)
  select a.entrant_id,
         'pick_made',
         v_who || ' has picked',
         v_who || ' is on ' || v_player || ' (' || v_team || ') for gameweek ' || new.gameweek || '.',
         new.gameweek
  from alert_prefs a
  where a.pick_activity
    and a.entrant_id <> new.entrant_id;  -- you know what you picked

  return null;
end $$;

create trigger picks_notify_made
  after insert on picks
  for each row execute function notify_pick_made();

create or replace function notify_goal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_who text;
  v_player text;
  v_team text;
  v_scored smallint;
  v_points integer;
begin
  -- Only a goal going *up*. The score function rewrites every pick in a
  -- gameweek on each run, so most of these updates change nothing, and a
  -- correction downward is not news worth a buzz.
  v_scored := new.goals - old.goals;
  if v_scored <= 0 then
    return null;
  end if;

  select display_name into v_who from entrants where id = new.entrant_id;
  select p.web_name, t.short_name, pick_points(p.element_type, new.stake, v_scored)
    into v_player, v_team, v_points
  from players p join teams t on t.id = p.team_id
  where p.code = new.player_code;

  insert into notifications (entrant_id, kind, title, body, gameweek)
  select a.entrant_id,
         'goal',
         v_player || ' scores',
         case when a.entrant_id = new.entrant_id then 'Your pick' else v_who || '''s pick' end
           || ' — ' || v_player || ' (' || v_team || ') — has scored. '
           || v_points || case when v_points = 1 then ' point.' else ' points.' end,
         new.gameweek
  from alert_prefs a
  where a.goal_alerts;  -- including your own: a goal you scored is the news

  return null;
end $$;

create trigger picks_notify_goal
  after update on picks
  for each row execute function notify_goal();

-- Injury news about the player *you* have picked, for a gameweek that hasn't
-- locked yet — the only alert here you can still act on. Fired from the
-- players table, which sync-fpl rewrites hourly, so it catches a status change
-- within the hour of FPL publishing it.
create or replace function notify_injury()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_team text;
begin
  -- 'a' is available. Going *to* available is good news nobody needs waking
  -- for; this is only about a player becoming doubtful, injured or suspended.
  if new.status = 'a' or new.status is not distinct from old.status then
    return null;
  end if;

  select short_name into v_team from teams where id = new.team_id;

  insert into notifications (entrant_id, kind, title, body, gameweek)
  select p.entrant_id,
         'injury',
         new.web_name || ' — ' || case new.status
           when 'd' then 'doubtful'
           when 'i' then 'injured'
           when 's' then 'suspended'
           when 'u' then 'unavailable'
           else 'not in the squad' end,
         'Your gameweek ' || p.gameweek || ' pick ' || new.web_name || ' (' || v_team || ')'
           -- FPL's news field carries no trailing full stop, so one is added
           -- here; without it the sentence runs straight into the next one.
           || case when new.news <> '' then ': ' || new.news || '.' else '.' end
           || ' You can still change it.',
         p.gameweek
  from picks p
  join alert_prefs a on a.entrant_id = p.entrant_id
  join gameweeks g on g.id = p.gameweek
  where p.player_code = new.code
    and a.injury_alerts
    and g.finished = false
    and g.lock_at is not null
    and g.lock_at > now();

  return null;
end $$;

create trigger players_notify_injury
  after update on players
  for each row execute function notify_injury();

-- The reminder windows change shape: instead of a nudge 24 hours and 2 hours
-- out, there are three — when the gameweek opens, around midday at the
-- midpoint, and an hour before the deadline. The old keys stay in the
-- constraint so the rows already recorded under them remain valid.
alter table reminders_sent drop constraint if exists reminders_sent_window_key_check;
alter table reminders_sent add constraint reminders_sent_window_key_check
  check (window_key in ('t24h', 't2h', 'open', 'midpoint', 't1h'));
