# AliAuction.ca

Implementation workspace for the AliAuction.ca Canadian auction marketplace, bootstrapped from the planning pack in [`docs/`](docs/).

## Current status

- **Phase 1 (MVP) foundation started** — see [`docs-implementation/PHASE1_STATUS.md`](docs-implementation/PHASE1_STATUS.md) for workstream status, completed scaffolding, and next steps.
- Product/architecture/database/delivery specs live in [`docs/`](docs/) (start at [`docs/00-implementation-document-index.md`](docs/00-implementation-document-index.md)).

## Repository structure

- `apps/web` — Next.js web app (public + authenticated routes scaffold)
- `apps/api` — Node.js/Express GraphQL API scaffold (`/health`, `/graphql`)
- `packages/shared` — shared types/constants placeholder
- `infra/docker` — local PostgreSQL + Redis for development (no initdb auto-bootstrap)
- `docs-implementation` — implementation tracking and notes
- `.github/workflows/ci.yml` — CI workflow

## Local development (foundation)

Prerequisites: Node.js >= 20, pnpm, Docker.

```bash
# 1) Configure environment
cp .env.example .env

# 2) Start local data services
# Default local ports: PostgreSQL 5433, Redis 6380 (mapped to avoid conflicts with common local services)
docker compose -f infra/docker/docker-compose.yml up -d

# 3) Install dependencies
pnpm install

# 4) Apply authoritative database migrations
cd apps/api
DATABASE_URL='postgresql://aliauction:aliauction@localhost:5433/aliauction_dev' pnpm migrate:up
cd ../..

# 5) Run apps in parallel
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- API GraphQL: http://localhost:4000/graphql

> Database schema source of truth is ordered migrations in `apps/api/migrations/` (see `apps/api/MIGRATIONS.md`). `docs/05-postgresql-starter-schema.sql.md` is a draft input only. The former initdb bootstrap SQL copy was removed once migration tooling became authoritative.

## Important caveats

- This is a **planning-aligned scaffold**, not a launch-ready or legally reviewed marketplace.
- Many core rules (auction mechanics, fees, payment/payout architecture, escrow meaning, shipping, verification, retention) require approval in [`docs/16-assumptions-decisions-and-open-questions.md`](docs/16-assumptions-decisions-and-open-questions.md).
- Payment, privacy, consumer, auction, and marketplace obligations require qualified Canadian legal/tax/payment/compliance review before real-money launch.
