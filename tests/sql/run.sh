#!/usr/bin/env bash
# Usage: tests/sql/run.sh   (needs local Postgres 15+ and sudo -u postgres)
set -euo pipefail
cd "$(dirname "$0")/../.."
sudo -u postgres dropdb --if-exists cartiq_rls_test && sudo -u postgres createdb cartiq_rls_test
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d cartiq_rls_test -f tests/sql/00_supabase_stub.sql \
  -f supabase/migrations/20261026_dealer_self_serve.sql -f tests/sql/10_rls_acceptance.sql 2>&1 | grep -v 'does not exist, skipping'
