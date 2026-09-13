#!/usr/bin/env bash
# Apply every migration to a scratch PostgreSQL database and run the RLS suite against it.
#
# `supabase start` needs Docker, which this environment does not have, and untested RLS is not
# worth much -- a policy that has never faced a hostile session is a comment. So this runs the real
# migrations, unmodified and in order, against a plain PostgreSQL 16 cluster, with 00_supabase_shim
# supplying the handful of objects a Supabase project would provide (the auth schema, the anon /
# authenticated / service_role roles, the extensions schema).
#
# What this does NOT cover, and where the real project still has to be checked: Supabase's own
# default privileges, GoTrue's actual JWT claim shape, Realtime, and anything storage-related.
#
# Usage:  PGHOST=/var/run/postgresql PGPORT=5433 ./supabase/tests/run-local.sh
set -euo pipefail

PGHOST="${PGHOST:-/var/run/postgresql}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-postgres}"
DB="${DB:-rls_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

psql() { command psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 "$@"; }

echo "==> resetting $DB"
psql -d postgres -q -c "drop database if exists $DB;" -c "create database $DB;"

# ROLES ARE CLUSTER-LEVEL, AND DROPPING THE DATABASE DOES NOT TOUCH THEM.
#
# This was found by a mutation that should have failed and did not: deleting
# `grant app_ingest to authenticator` from a migration left the suite green, because the grant was
# still there from the PREVIOUS run. Every role below, and every membership between them, outlives
# `drop database` -- so without this the suite stops testing the migrations and starts testing the
# accumulated state of whoever's cluster it happens to run on. CI gets a fresh container and would
# have kept passing; a developer's machine would drift silently in the other direction.
#
# WHAT LEAKS IS THE MEMBERSHIPS, so those are revoked unconditionally and first. `grant app_ingest
# to authenticator` is the one the mutation exposed, and a revoke needs no cooperation from any
# other database: it is cluster state that this loop owns outright.
psql -d postgres -q -t -c "
  select format('revoke %I from %I;', r.rolname, m.rolname)
    from pg_auth_members am
    join pg_roles r on r.oid = am.roleid
    join pg_roles m on m.oid = am.member
   where r.rolname in ('app_ingest','app_scheduler','app_webhook','anon','authenticated','service_role');
" | psql -d postgres -q -f -

# Then drop the roles themselves, BEST EFFORT. This is the stronger reset -- it also catches a
# migration that stopped creating a role at all -- but `drop role` fails if the role holds
# privileges in ANY other database in the cluster, which this script has no way to clean and no
# business dropping. So a failure warns and continues rather than killing the run: the membership
# revoke above has already closed the leak that matters.
for role in app_ingest app_scheduler app_webhook authenticator anon authenticated service_role; do
  if ! psql -d postgres -q -c "drop role if exists $role;" 2>/dev/null; then
    printf '    WARNING: could not drop role %s (it holds privileges in another database).\n' "$role"
    printf '             Memberships were still revoked, so this run is sound.\n'
  fi
done

psql -d "$DB" -q -c "create extension if not exists pgcrypto;"

echo "==> shim"
psql -d "$DB" -q -f "$HERE/00_supabase_shim.sql"

echo "==> migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '    %-48s ' "$(basename "$f")"
  psql -d "$DB" -q -f "$f" && echo "ok"
done

# EVERY NUMBERED SUITE, ENUMERATED FROM THE DIRECTORY RATHER THAN LISTED HERE.
#
# This used to be twenty hand-written `psql -f` lines, and the failure that arrangement produces
# has already happened twice. `13_scheduler_entry_point.sql` shipped beside its migration and was
# never wired in -- it sat in the directory proving nothing, which is indistinguishable from a
# suite that passes. It was fixed by adding one more hand-written line, which fixed that instance
# and left the mechanism intact; `20_data_requests.sql` then hit it again immediately.
#
# A suite that cannot run is worse than a missing one, because it reports as coverage. So the list
# is now the filesystem. `00_supabase_shim.sql` is excluded because it is applied above, before the
# migrations, and is setup rather than a suite.
#
# ORDER IS THE NUMERIC PREFIX, and `sort -V` rather than glob order so `19` does not sort before
# `2`. The suites share one database and several depend on fixtures earlier ones create, so the
# ordering is load-bearing and not cosmetic.
for f in $(printf '%s\n' "$HERE"/[0-9][0-9]_*.sql | sort -V); do
  name="$(basename "$f")"
  [ "$name" = "00_supabase_shim.sql" ] && continue
  echo "==> ${name%.sql}"
  psql -d "$DB" -q -f "$f"
done
