# Restore-drill runbook (draft — not executed)

This is a documentation template only. No backup, restore, migration or verification step below has been executed. The drill, its cadence, RPO/RTO and the approving owner are **not decided**; see `docs-implementation/decision-log.md` (§9 #8) and `docs/16 §8`. No commands are run by this document.

## Step 1 — Take a backup

**Owner: operations** — **Status: not executed**

Identify the production PostgreSQL database from configuration (never hardcode credentials or hosts in this document). Take a consistent backup using the organisation-approved backup mechanism, recording the backup identifier, timestamp and checksum in the drill log. Confirm the backup completed successfully before proceeding.

## Step 2 — Restore to a scratch database

**Owner: operations** — **Status: not executed**

Create a separate scratch database with a distinct name, then restore the backup from Step 1 into it. Verify the restore completed without error and that the scratch instance is isolated from production traffic. Do not reuse a live database name.

## Step 3 — Run the migrations

**Owner: operations** — **Status: not executed**

Against the scratch database only, bring the schema to the current migration head using the repository's migration tooling (`apps/api/migrations`). Confirm the applied migration list matches the expected list in `scripts/test-migrations-roundtrip.sh`. Do not modify any applied migration.

## Step 4 — Verify row counts

**Owner: operations** — **Status: not executed**

Record row counts for the core tables (for example `users`, `listings`, `auctions`, `bids`, `orders`, `payment_transactions`, `audit_logs`, `notifications`) in the restored scratch database and compare them with the source database snapshot taken at backup time. Investigate and document any discrepancy before declaring the drill complete.

## Step 5 — Record the outcome

**Owner: operations** — **Status: not executed**

Write the drill outcome, timings, discrepancies and sign-off into the drill log. **No drill has been performed**, so no result, timing, RPO/RTO measurement or sign-off is recorded here.
