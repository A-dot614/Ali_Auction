#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${MIGRATION_DB_HOST:-localhost}"
DB_PORT="${MIGRATION_DB_PORT:-5433}"
DB_USER="${MIGRATION_DB_USER:-aliauction}"
DB_PASSWORD="${MIGRATION_DB_PASSWORD:-aliauction}"
DB_NAME="${MIGRATION_DB_NAME:-aliauction_migrate_test}"
ADMIN_DB="${MIGRATION_ADMIN_DB:-postgres}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-apps/api/migrations}"
DOCKER_PG_CONTAINER="${MIGRATION_DOCKER_CONTAINER:-}"

export PGPASSWORD="$DB_PASSWORD"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

run_psql() {
  local db="$1"
  shift
  if command -v psql >/dev/null 2>&1; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 "$@"
  elif [[ -n "$DOCKER_PG_CONTAINER" ]]; then
    docker exec -e PGPASSWORD="$DB_PASSWORD" "$DOCKER_PG_CONTAINER" \
      psql -h localhost -p 5432 -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 "$@"
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'aliauction-postgres'; then
    docker exec -e PGPASSWORD="$DB_PASSWORD" aliauction-postgres \
      psql -h localhost -p 5432 -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 "$@"
  else
    echo "psql not found and no docker postgres container available" >&2
    exit 1
  fi
}

echo "[migrations] dropping/creating scratch database: ${DB_NAME}"
run_psql "$ADMIN_DB" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null
run_psql "$ADMIN_DB" -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
run_psql "$ADMIN_DB" -c "CREATE DATABASE \"${DB_NAME}\";"

run_migrate() {
  (cd apps/api && DATABASE_URL="$DATABASE_URL" npx node-pg-migrate -m migrations "$@")
}

echo "[migrations] up"
run_migrate up
echo "[migrations] down (all)"
run_migrate down --count 9999
echo "[migrations] up (again)"
run_migrate up

echo "[migrations] roundtrip OK"
