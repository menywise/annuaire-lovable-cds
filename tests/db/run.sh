#!/usr/bin/env bash
# Rejoue toutes les migrations sur une base locale neuve puis lance les tests RLS.
# Usage : PGHOST=/var/tmp PGPORT=54329 PGUSER=postgres tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=cds_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f" >/dev/null || { echo "ÉCHEC migration $f"; exit 1; }
done
echo "Migrations OK ($(ls supabase/migrations/*.sql | wc -l))"
for t in tests/db/test_*.sql; do
  [ -e "$t" ] || continue
  psql -q -At -v ON_ERROR_STOP=1 -d $DB -f "$t" >/dev/null || { echo "ÉCHEC $t"; exit 1; }
  echo "OK $t"
done
