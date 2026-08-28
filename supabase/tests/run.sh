#!/usr/bin/env bash
# Runs the pgTAP suite against a scratch database using a local `psql`.
# Does not require Docker or a running Supabase project.
#
# Usage: supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=wingback_test
PSQL_SUPERUSER=${PSQL_SUPERUSER:-postgres}

run() { sudo -u "$PSQL_SUPERUSER" psql -v ON_ERROR_STOP=1 "$@"; }

run -c "drop database if exists ${DB};"
run -c "create database ${DB};"
run -d "$DB" -c "create extension if not exists pgtap; create extension if not exists pgcrypto;"

# 20260101000004_cron.sql, 20260101000014_score_on_match_windows.sql and
# 20260101000008_avatars_storage.sql are deliberately excluded: the first two
# need pg_cron/pg_net/Vault and the last needs Supabase's storage schema,
# none of which exist in a plain local Postgres. None has anything to do with
# the rules engine anyway.
for f in supabase/tests/00_local_harness.sql \
         supabase/migrations/20260101000000_schema.sql \
         supabase/migrations/20260101000001_functions.sql \
         supabase/migrations/20260101000002_views.sql \
         supabase/migrations/20260101000003_rls.sql \
         supabase/migrations/20260101000005_display_name_onboarding.sql \
         supabase/migrations/20260101000006_profile_claiming.sql \
         supabase/migrations/20260101000007_seed_entrants.sql \
         supabase/migrations/20260101000009_public_picks.sql \
         supabase/migrations/20260101000011_team_code.sql \
         supabase/migrations/20260101000015_fixture_played.sql \
         supabase/migrations/20260101000020_player_season_stats.sql \
         supabase/tests/01_local_grants.sql; do
  run -d "$DB" -f "$f" > /dev/null
done

echo "=== pgTAP results ==="
sudo -u "$PSQL_SUPERUSER" psql -At -d "$DB" -f supabase/tests/pick_rules_test.sql
