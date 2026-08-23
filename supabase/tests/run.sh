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

# 20260101000004_cron.sql is deliberately excluded: it needs pg_cron/pg_net
# and the Vault, which exist only on an actual Supabase project, not in a
# plain local Postgres. It has nothing to do with the rules engine anyway.
for f in supabase/tests/00_local_harness.sql \
         supabase/migrations/20260101000000_schema.sql \
         supabase/migrations/20260101000001_functions.sql \
         supabase/migrations/20260101000002_views.sql \
         supabase/migrations/20260101000003_rls.sql \
         supabase/tests/01_local_grants.sql; do
  run -d "$DB" -f "$f" > /dev/null
done

echo "=== pgTAP results ==="
sudo -u "$PSQL_SUPERUSER" psql -At -d "$DB" -f supabase/tests/pick_rules_test.sql
