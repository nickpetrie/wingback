-- pgTAP suite for the Wingback rules engine.
--
-- Run locally (no Supabase/Docker required) with:
--   createdb wingback_test
--   psql -d wingback_test -c 'create extension pgtap; create extension pgcrypto;'
--   psql -d wingback_test -f supabase/tests/00_local_harness.sql
--   psql -d wingback_test -f supabase/migrations/20260101000000_schema.sql
--   psql -d wingback_test -f supabase/migrations/20260101000001_functions.sql
--   psql -d wingback_test -f supabase/migrations/20260101000002_views.sql
--   psql -d wingback_test -f supabase/migrations/20260101000003_rls.sql
--   psql -d wingback_test -f supabase/migrations/20260101000005_display_name_onboarding.sql
--   psql -d wingback_test -f supabase/migrations/20260101000006_profile_claiming.sql
--   psql -d wingback_test -f supabase/migrations/20260101000007_seed_entrants.sql
--   psql -d wingback_test -f supabase/tests/01_local_grants.sql
--   psql -d wingback_test -f supabase/tests/pick_rules_test.sql
--
-- Never run this against the production database: it inserts fixture data.

begin;
select plan(33);

grant anon, authenticated, service_role to current_user;

-- Small helpers to move between "who is running this query" personas,
-- mirroring what PostgREST does with a JWT's `sub` and `role` claims.
create or replace function test_as_entrant(p_id uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_id::text, true);
end;
$$;

create or replace function test_as_service() returns void language plpgsql as $$
begin
  execute 'set local role service_role';
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

create or replace function test_as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

select test_as_admin();

-- ---------------------------------------------------------------------
-- Seed reference data
-- ---------------------------------------------------------------------

insert into teams (id, name, short_name) values
  (1, 'Arsenal', 'ARS'),
  (2, 'Chelsea', 'CHE');

insert into players (code, fpl_id, web_name, first_name, second_name, team_id, element_type, status, news) values
  (100, 100, 'Forward1', 'For', 'Ward', 1, 4, 'a', ''),
  (200, 200, 'Defender1', 'De', 'Fender', 1, 2, 'a', ''),
  (300, 300, 'Nominee', 'No', 'Minee', 2, 3, 'a', ''),
  (400, 400, 'PlainMid', 'Pla', 'InMid', 2, 3, 'a', ''),
  (401, 401, 'HatTrickHero', 'Hat', 'Trick', 2, 4, 'a', ''),
  (500, 500, 'DGWPlayer', 'Dou', 'Ble', 1, 4, 'a', ''),
  (701, 701, 'Filler1', 'Fil', 'Ler1', 1, 3, 'a', ''),
  (702, 702, 'Filler2', 'Fil', 'Ler2', 1, 3, 'a', ''),
  (703, 703, 'Filler3', 'Fil', 'Ler3', 1, 3, 'a', ''),
  (710, 710, 'Filler4', 'Fil', 'Ler4', 1, 3, 'a', ''),
  (711, 711, 'Filler5', 'Fil', 'Ler5', 1, 3, 'a', '');

-- Gameweeks 1..20: one open (future) fixture each, except GW1 which is
-- already in the past (and thus locked). GW90 is a genuine double
-- gameweek: the same team appears in two fixtures.
insert into gameweeks (id) select generate_series(1, 20);
insert into gameweeks (id) values (90);

insert into fixtures (id, event, team_h, team_a, kickoff_time, finished) values
  (1, 1, 1, 2, now() - interval '2 days', true);

insert into fixtures (id, event, team_h, team_a, kickoff_time, finished)
select 1000 + gw, gw, 1, 2, now() + (gw || ' days')::interval, false
from generate_series(2, 20) as gw;

insert into fixtures (id, event, team_h, team_a, kickoff_time, finished) values
  (9001, 90, 1, 2, now() + interval '60 days', false),
  (9002, 90, 2, 1, now() + interval '61 days', false);

-- Entrants are a fixed, pre-seeded roster now (see 20260101000007), claimed
-- by an auth user rather than auto-created on sign-in. For the rules-engine
-- tests below, seed two ad-hoc ones directly, already claimed.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

insert into entrants (id, auth_user_id, email, display_name, nomination_player_code) values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'alice@example.com', 'alice', 300),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'bob@example.com', 'bob', null);

-- ---------------------------------------------------------------------
-- Claiming: an unclaimed profile can be claimed by anyone; a claimed one
-- can't be claimed again out from under them.
-- ---------------------------------------------------------------------

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com');

select test_as_entrant('33333333-3333-3333-3333-333333333333'::uuid);
select lives_ok(
  $$ update entrants set auth_user_id = '33333333-3333-3333-3333-333333333333'
     where id = 'a1000000-0000-0000-0000-000000000004' and auth_user_id is null $$,
  'an unclaimed profile can be claimed'
);
select is(
  (select auth_user_id from entrants where id = 'a1000000-0000-0000-0000-000000000004'),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'the claim actually took'
);

select test_as_entrant('44444444-4444-4444-4444-444444444444'::uuid);
select lives_ok(
  $$ update entrants set auth_user_id = '44444444-4444-4444-4444-444444444444'
     where id = 'a1000000-0000-0000-0000-000000000004' and auth_user_id is null $$,
  'claiming an already-claimed profile is a no-op, not an error'
);
select is(
  (select auth_user_id from entrants where id = 'a1000000-0000-0000-0000-000000000004'),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'the earlier claim is undisturbed'
);

-- ---------------------------------------------------------------------
-- Scoring function: the acceptance-criteria arithmetic, direct.
-- ---------------------------------------------------------------------

select is(pick_points(4, 3, 2), 2, 'forward, 2 goals, £3 stake -> 2 points');
select is(pick_points(4, 6, 2), 4, 'forward, 2 goals, £6 stake -> 4 points');
select is(pick_points(2, 3, 1), 2, 'defender, 1 goal, £3 stake -> 2 points (doubled)');
select is(pick_points(2, 6, 1), 4, 'defender, 1 goal, £6 stake -> 4 points (doubled again)');

-- ---------------------------------------------------------------------
-- Lock guard
-- ---------------------------------------------------------------------

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);

select throws_like(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 1, 100, 1, 3) $$,
  '%locked%',
  'a pick for a locked gameweek is rejected'
);

-- ---------------------------------------------------------------------
-- Reuse guard: a non-nominated player cannot be picked twice
-- ---------------------------------------------------------------------

select test_as_entrant('22222222-2222-2222-2222-222222222222'::uuid);

select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('22222222-2222-2222-2222-222222222222', 2, 400, 1002, 3) $$,
  'bob can pick a fresh (non-nominated) player'
);

select test_as_service();
update picks set goals = 1
where entrant_id = '22222222-2222-2222-2222-222222222222' and gameweek = 2;

select test_as_entrant('22222222-2222-2222-2222-222222222222'::uuid);

select throws_like(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('22222222-2222-2222-2222-222222222222', 3, 400, 1003, 3) $$,
  '%not available%',
  'a non-nominated player cannot be picked twice (no hat-trick in between)'
);

-- ---------------------------------------------------------------------
-- Reuse guard: the nominated player can be picked twice, but not three times
-- ---------------------------------------------------------------------

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);

select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 4, 300, 1004, 3) $$,
  'alice can pick her nominated player the first time'
);

select test_as_service();
update picks set goals = 1
where entrant_id = '11111111-1111-1111-1111-111111111111' and gameweek = 4;

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);

select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 5, 300, 1005, 3) $$,
  'alice can pick her nominated player a second time'
);

select test_as_service();
update picks set goals = 1
where entrant_id = '11111111-1111-1111-1111-111111111111' and gameweek = 5;

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);

select throws_like(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 6, 300, 1006, 3) $$,
  '%not available%',
  'the nominated player cannot be picked a third time (no hat-trick in between)'
);

-- ---------------------------------------------------------------------
-- Reuse guard: a hat-trick makes that player available again, repeatedly
-- ---------------------------------------------------------------------

select test_as_entrant('22222222-2222-2222-2222-222222222222'::uuid);

select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('22222222-2222-2222-2222-222222222222', 7, 401, 1007, 3) $$,
  'bob picks a fresh player for the hat-trick scenario'
);

select test_as_service();
update picks set goals = 3
where entrant_id = '22222222-2222-2222-2222-222222222222' and gameweek = 7;

select test_as_entrant('22222222-2222-2222-2222-222222222222'::uuid);

select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('22222222-2222-2222-2222-222222222222', 8, 401, 1008, 3) $$,
  'a hat-trick makes the player available again'
);

select test_as_service();
update picks set goals = 3
where entrant_id = '22222222-2222-2222-2222-222222222222' and gameweek = 8;

select test_as_entrant('22222222-2222-2222-2222-222222222222'::uuid);

select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('22222222-2222-2222-2222-222222222222', 9, 401, 1009, 3) $$,
  'a second consecutive hat-trick frees the player again (no repeat limit)'
);

-- ---------------------------------------------------------------------
-- Doubles: first two are free, the third+ costs -2 per goalless fixture
-- ---------------------------------------------------------------------

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);

select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 11, 701, 1011, 6) $$,
  'alice takes her first free double'
);
select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 12, 702, 1012, 6) $$,
  'alice takes her second free double'
);
select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 13, 703, 1013, 6) $$,
  'alice takes a third double (permitted, not blocked)'
);

-- Mark those gameweeks' fixtures finished so the penalty calc (which only
-- counts settled fixtures) sees them as blanks rather than "still to play".
select test_as_admin();
update fixtures set finished = true where id in (1011, 1012, 1013);

-- All three blank (goals stay 0, the seeded default).
select is(
  (select points from pick_scores where entrant_id = '11111111-1111-1111-1111-111111111111' and gameweek = 11),
  0,
  'first free double that blanks costs nothing'
);
select is(
  (select points from pick_scores where entrant_id = '11111111-1111-1111-1111-111111111111' and gameweek = 12),
  0,
  'second free double that blanks costs nothing'
);
select is(
  (select points from pick_scores where entrant_id = '11111111-1111-1111-1111-111111111111' and gameweek = 13),
  -2,
  'third double that blanks costs -2 (one goalless fixture)'
);

-- Regression for the stuck-flag bug: FPL leaves `finished` false long after
-- full time and sets `finished_provisional` instead (measured: all ten GW1
-- fixtures still false three days on). pick_scores keys off `played` so the
-- penalty still fires; before that it read `finished` alone and this was 0,
-- meaning the rule could never apply in production at all.
select test_as_admin();
update fixtures set finished = false, finished_provisional = true where id = 1013;

select is(
  (select points from pick_scores where entrant_id = '11111111-1111-1111-1111-111111111111' and gameweek = 13),
  -2,
  'a provisionally-finished fixture still counts as a goalless fixture'
);

update fixtures set finished = true, finished_provisional = false where id = 1013;

-- A genuine double gameweek: two goalless fixtures for the same pick means
-- -2 for each, i.e. -4 overall, once the free doubles are used up.
select test_as_admin();
update fixtures set finished = true where id in (9001, 9002);

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);
select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 90, 500, 9001, 6) $$,
  'alice takes a fourth double in a double gameweek'
);

select is(
  (select points from pick_scores where entrant_id = '11111111-1111-1111-1111-111111111111' and gameweek = 90),
  -4,
  'a double gameweek double that blanks both fixtures costs -2 per goalless fixture'
);

-- ---------------------------------------------------------------------
-- Recording goals never trips the lock or reuse guards
-- ---------------------------------------------------------------------

select test_as_admin();
update fixtures set kickoff_time = now() - interval '1 hour' where id = 1002; -- locks gameweek 2

select test_as_service();
select lives_ok(
  $$ update picks set goals = 5
     where entrant_id = '22222222-2222-2222-2222-222222222222' and gameweek = 2 $$,
  'recording a goal on an existing pick does not trip the lock guard, even after lock'
);

-- ---------------------------------------------------------------------
-- RLS: picks are visible to every entrant as soon as they're made
-- ---------------------------------------------------------------------

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);
select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('11111111-1111-1111-1111-111111111111', 20, 710, 1020, 3) $$,
  'alice picks for gameweek 20 (still open)'
);

select test_as_entrant('22222222-2222-2222-2222-222222222222'::uuid);
select lives_ok(
  $$ insert into picks (entrant_id, gameweek, player_code, fixture_id, stake)
     values ('22222222-2222-2222-2222-222222222222', 20, 711, 1020, 3) $$,
  'bob picks for gameweek 20 (still open)'
);

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);

select is(
  (select count(*)::int from picks where gameweek = 20 and entrant_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'entrant A can see entrant B''s pick even before the lock'
);
select is(
  (select count(*)::int from picks where gameweek = 20 and entrant_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'entrant A can always see their own pick'
);

-- pick_scores is a view over picks, not the table itself: without
-- security_invoker it would run as the view owner and bypass the picks
-- table's `to authenticated` restriction, letting even an anon request
-- read through the view.
select is(
  (select count(*)::int from pick_scores where gameweek = 20 and entrant_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'the pick_scores view also shows a rival''s pick before the lock'
);

select test_as_admin();
update fixtures set kickoff_time = now() - interval '2 hours' where id = 1020; -- locks gameweek 20

select test_as_entrant('11111111-1111-1111-1111-111111111111'::uuid);
select is(
  (select count(*)::int from picks where gameweek = 20 and entrant_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'picks remain visible after the lock too'
);

select * from finish();
rollback;
