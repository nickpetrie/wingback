-- Wingback core schema: mirrors of FPL reference data, plus entrants/picks.

create table teams (
  id smallint primary key,           -- FPL team id (stable within a season)
  name text not null,
  short_name text not null
);

create table players (
  code integer primary key,          -- stable across seasons; the join key
  fpl_id integer not null unique,    -- current-season id, only for hitting /live/
  web_name text not null,
  first_name text not null,
  second_name text not null,
  team_id smallint not null references teams(id),
  element_type smallint not null check (element_type between 1 and 4), -- 1 GK 2 DEF 3 MID 4 FWD
  status text not null default 'a' check (status in ('a','d','i','s','u','n')),
  news text not null default '',
  chance_of_playing_next_round smallint,
  photo text
);

create table gameweeks (
  id smallint primary key,           -- FPL event id
  deadline_time timestamptz,         -- FPL's own deadline, kept for reference only
  lock_at timestamptz,               -- ours: min(fixture kickoff) - 1h. Maintained by trigger, see functions.sql
  finished boolean not null default false
);

create table fixtures (
  id integer primary key,            -- FPL fixture id
  event smallint references gameweeks(id),
  team_h smallint not null references teams(id),
  team_a smallint not null references teams(id),
  kickoff_time timestamptz,
  finished boolean not null default false
);

create index fixtures_event_idx on fixtures(event);

-- One row per detected change, so an injury timeline accumulates over the season.
create table player_status_history (
  id bigserial primary key,
  player_code integer not null references players(code),
  status text not null,
  news text not null default '',
  chance_of_playing_next_round smallint,
  recorded_at timestamptz not null default now()
);

create index player_status_history_player_idx on player_status_history(player_code, recorded_at desc);

create table entrants (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  phone text,
  sms_opt_in boolean not null default false,
  nomination_player_code integer references players(code),
  created_at timestamptz not null default now()
);

-- Per-fixture goals for a player, used to work out double-gameweek penalties
-- (the live endpoint only gives a per-gameweek total, which hides which of
-- two fixtures in a double gameweek was the goalless one).
create table fixture_goals (
  fixture_id integer not null references fixtures(id),
  player_code integer not null references players(code),
  goals smallint not null default 0,
  primary key (fixture_id, player_code)
);

create table picks (
  id bigserial primary key,
  entrant_id uuid not null references entrants(id) on delete cascade,
  gameweek smallint not null references gameweeks(id),
  player_code integer not null references players(code),
  fixture_id integer references fixtures(id),
  stake smallint not null default 3 check (stake in (3, 6)),
  goals smallint not null default 0,
  is_substitution boolean not null default false,
  substituted_from_player_code integer references players(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entrant_id, gameweek)
);

create index picks_entrant_idx on picks(entrant_id);
create index picks_gameweek_idx on picks(gameweek);
create index picks_player_idx on picks(player_code);

-- Idempotency for reminders: insert the marker row *first*; the primary key
-- rejects a duplicate send. If the actual send then fails, delete the row so
-- the next run retries instead of silently swallowing it.
create table reminders_sent (
  entrant_id uuid not null references entrants(id) on delete cascade,
  gameweek smallint not null references gameweeks(id),
  channel text not null check (channel in ('email', 'sms')),
  window_key text not null check (window_key in ('t24h', 't2h')),
  sent_at timestamptz not null default now(),
  primary key (entrant_id, gameweek, channel, window_key)
);
