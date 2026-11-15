# Database migrations (authoritative)

This directory contains **ordered, reviewed migrations** for AliAuction's PostgreSQL schema.

## Source of truth
- Migrations here are the intended schema source of truth for environments.
- `docs/05-postgresql-starter-schema.sql.md` remains a **draft** input only (not executable migration truth). The former local initdb bootstrap copy (`infra/docker/initdb/001_starter_schema.sql`) was removed after migration tooling became authoritative; do not reintroduce initdb auto-bootstrap as schema truth.

## Review process
1. Treat `docs/05-postgresql-starter-schema.sql.md` and related docs as draft inputs only; review naming, constraints, privacy, indexing, retention, and provider requirements before codifying.
2. Create one migration per logical change with clear up/down behavior where safe.
3. Prefer backward-compatible, ordered migrations; irreversible data migrations require explicit review and rollout notes.
4. Require code review for schema changes affecting users, auctions, bids, orders, payments, or audit data.
5. Test migrations against a fresh database and against an upgraded database before merge/release.
6. Record deviations from docs and unresolved decisions (see `docs/16-assumptions-decisions-and-open-questions.md`) in migration notes and `docs-implementation/PHASE1_STATUS.md`.

## Baseline
- `0001_baseline` is an **empty baseline** to establish migration history. Existing draft entities from docs must be introduced via subsequent reviewed migrations (not by initdb auto-apply).

## Tooling
- Tool: `node-pg-migrate` (simple, SQL/JS migrations, minimal lock-in). Justification recorded in `docs-implementation/PHASE1_STATUS.md`.
- Configure `DATABASE_URL` (see `.env.example`). Example commands from `apps/api`:
  - `pnpm migrate up`
  - `pnpm migrate down`
  - `pnpm migrate create <name>`
