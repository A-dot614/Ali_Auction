# Migration roundtrip locally (no native psql install)

The roundtrip script `scripts/test-migrations-roundtrip.sh` requires `psql` on `PATH`. `psql` is not installed locally, so the roundtrip cannot be run on this machine. CI runs the same script against its Postgres service container (with the PostgreSQL client installed in the CI step), which covers the migration roundtrip.
