#!/usr/bin/env bash
set -euo pipefail

# Connection parameters may come from DATABASE_URL (CI service container / local
# docker compose) or explicit MIGRATION_DB_* overrides. Explicit overrides win.
if [[ -n "${DATABASE_URL:-}" ]]; then
  _db_url="${DATABASE_URL}"
  _db_path="${_db_url#*://}"
  _db_userinfo="${_db_path%%@*}"
  _db_hostport="${_db_path#*@}"
  _db_hostport="${_db_hostport%%/*}"
  _db_host="${_db_hostport%%:*}"
  _db_port="${_db_hostport##*:}"
  _db_user="${_db_userinfo%%:*}"
  _db_password="${_db_userinfo#*:}"
  MIGRATION_DB_HOST="${MIGRATION_DB_HOST:-$_db_host}"
  MIGRATION_DB_PORT="${MIGRATION_DB_PORT:-$_db_port}"
  MIGRATION_DB_USER="${MIGRATION_DB_USER:-$_db_user}"
  MIGRATION_DB_PASSWORD="${MIGRATION_DB_PASSWORD:-$_db_password}"
fi

DB_HOST="${MIGRATION_DB_HOST:-localhost}"
DB_PORT="${MIGRATION_DB_PORT:-5433}"
DB_USER="${MIGRATION_DB_USER:-aliauction}"
DB_PASSWORD="${MIGRATION_DB_PASSWORD:-aliauction}"
DB_NAME="${MIGRATION_DB_NAME:-aliauction_migrate_test}"
ADMIN_DB="${MIGRATION_ADMIN_DB:-postgres}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-apps/api/migrations}"

export PGPASSWORD="$DB_PASSWORD"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if command -v psql >/dev/null 2>&1; then
  echo "[migrations] using psql from PATH: $(command -v psql)"
  run_psql() { local db="$1"; shift; psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 "$@"; }
else
  echo "[migrations] FAIL: psql not found on PATH; install postgresql-client" >&2
  exit 1
fi

echo "[migrations] dropping/creating scratch database: ${DB_NAME}"
run_psql "$ADMIN_DB" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null
run_psql "$ADMIN_DB" -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
run_psql "$ADMIN_DB" -c "CREATE DATABASE \"${DB_NAME}\";"

run_migrate() { (cd apps/api && DATABASE_URL="$DATABASE_URL" npx node-pg-migrate -m migrations "$@"); }

EXPECTED=(1700000000000_baseline 1700000000100_identity_access 1700000000200_identity_profile 1700000000300_seller_profile_verification 1700000000400_catalogue_listings_slice3a 1700000000500_auctions_bids_slice4a 1700000000600_listings_search_slice5 1700000000700_orders_payments_slice6 1700000000800_reports_moderation_slice7 1700000000900_notifications_slice8 1700001000000_account_deletion_stub)

fail() { echo "[migrations] FAIL: $*" >&2; exit 1; }

applied_names() { run_psql "$DB_NAME" -tA -c "SELECT name FROM pgmigrations ORDER BY id;"; }

assert_names_match() {
  local expected_count="$1"
  local expected=("${EXPECTED[@]:0:${expected_count}}")
  local actual_str
  actual_str="$(applied_names)"
  local actual_names=()
  mapfile -t actual_names <<< "$actual_str"
  if [[ "${#actual_names[@]}" -ne "${#expected[@]}" ]]; then
    fail "migration list mismatch: expected ${expected_count} applied, got ${#actual_names[@]} (expected: [${expected[*]:-}], applied: [${actual_names[*]:-}])"
  fi
  local i=0
  for name in "${expected[@]}"; do
    if [[ "${actual_names[$i]}" != "$name" ]]; then
      fail "migration list mismatch at position $((i + 1)): expected '${name}', got '${actual_names[$i]}'"
    fi
    i=$((i + 1))
  done
}

assert_applied() { assert_names_match "$1"; }

echo "[migrations] running up"
run_migrate up
assert_applied "${#EXPECTED[@]}"

echo "[migrations] rolling back one step at a time"
rolled_back=0
while true; do
  applied_now="$(applied_names)"
  applied_now_count="$(printf '%s\n' "$applied_now" | grep -c . || true)"
  if [[ "$applied_now_count" -eq 0 ]]; then
    break
  fi
  if (( rolled_back >= 10 )); then
    fail "rollback loop exceeded 10 iterations with ${applied_now_count} migration(s) still applied"
  fi
  last_applied="$(printf '%s\n' "$applied_now" | tail -n 1)"
  expected_last="${EXPECTED[$(( ${#EXPECTED[@]} - 1 - rolled_back ))]}"
  if [[ "$last_applied" != "$expected_last" ]]; then
    fail "rollback target mismatch: expected '${expected_last}', got '${last_applied}'"
  fi
  run_migrate down
  applied_after="$(applied_names)"
  applied_after_count="$(printf '%s\n' "$applied_after" | grep -c . || true)"
  if [[ "$applied_after_count" -ne $((applied_now_count - 1)) ]]; then
    fail "rollback removed $((applied_now_count - applied_after_count)) migration(s); expected exactly 1 removal"
  fi
  rolled_back=$((rolled_back + 1))
done

users_exists="$(run_psql "$DB_NAME" -tA -c "SELECT to_regclass('public.users') IS NOT NULL;")"
if [[ "$users_exists" == "t" ]]; then
  fail "public.users still exists after full rollback"
fi
remaining_count="$(run_psql "$DB_NAME" -tA -c "SELECT count(*) FROM pgmigrations;" | tr -d '[:space:]')"
if [[ "$remaining_count" -ne 0 ]]; then
  fail "pgmigrations has ${remaining_count} row(s) after rollback; expected 0"
fi

echo "[migrations] running up (again)"
run_migrate up
assert_applied "${#EXPECTED[@]}"

echo "[migrations] roundtrip OK"
