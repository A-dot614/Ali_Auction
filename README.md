# AliAuction.ca

Implementation workspace for the AliAuction.ca Canadian C2C/B2C auction marketplace. The planning
specs are in [`docs/`](docs/); implementation notes, status and owner packs are in
[`docs-implementation/`](docs-implementation/).

## Current status

- **Phase 1 is incomplete.** Status: **24 met / 6 partial / 1 not met / 0 production-ready** across
  the 31 tracked P0 requirements; FR-042 (hosted/tokenized payment collection) remains **NOT MET**.
- **1 of 35 decisions is recorded** in [`decision-log.md`](docs-implementation/decision-log.md).
  The remaining rows are empty. No approval, legal review, security review, restore drill or
  sign-off is recorded as done.
- `FEATURE_LIVE_BIDDING_ENABLED` and `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` are `false` in every
  configuration and stay OFF. The startup guards are unchanged.

Real bidding and real-money payments stay OFF until every required decision-log row is filled and signed off.

## Repository layout

| Path | Contents |
|---|---|
| `apps/api` | Node.js/Express GraphQL API, ordered migrations, `/health` |
| `apps/web` | Next.js web app; demo routes use the `.demo.tsx` page extension |
| `packages/shared` | Shared types and constants |
| `infra/docker` | Earlier local PostgreSQL + Redis compose file (no initdb bootstrap) |
| `docker-compose.yml`, `docker/` | One-command local stack, dev-only env template |
| `docs` | Product, architecture, database, security and open-question specs |
| `docs-implementation` | Status, traceability, deferrals, decision pack and guides |
| `.github/workflows` | CI workflow |

The database schema source of truth is the ordered migrations in `apps/api/migrations/`
(see `apps/api/MIGRATIONS.md`). `docs/05-postgresql-starter-schema.sql.md` is a draft input only.

## Run with Docker (one command)

All commands below are copied from [`docker-guide.md`](docs-implementation/docker-guide.md).

From the repository root:

```bash
docker compose up -d --build
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- Postgres: localhost:5433 (container port 5432)
- Redis: localhost:6380 (container port 6379)

Check that real mode is active:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/demo
```

Expect `200` for `/` and `404` for `/demo`.

Demo mode is a separate profile and a separate non-production image target:

```bash
docker compose --profile demo up -d --build
```

- Real web: http://localhost:3000
- Demo web: http://localhost:3001/demo — expect `DEMO: not real, nothing is charged, no decision made`.

Logs, migrations, stopping and database reset:

```bash
docker compose logs -f
docker compose logs -f api
docker compose logs -f web web-demo
docker compose logs -f migrate
docker compose run --rm migrate
docker compose stop web-demo
docker compose start web-demo
docker compose down
docker compose --profile demo down
docker compose down -v
```

`docker compose down -v` is destructive: it removes the local database and Redis volumes.

## Run without Docker

The exact commands below are copied from [`demo-guide.md`](docs-implementation/demo-guide.md).

```bash
npx -y pnpm@9.15.4 install
npx -y pnpm@9.15.4 --filter @aliauction/api dev
NEXT_PUBLIC_DEMO_MODE=true npx -y pnpm@9.15.4 --filter @aliauction/web dev
```

The demo pages are on the default web port 3000; every one shows
`DEMO: not real, nothing is charged, no decision made`. To check the real (non-demo) screens,
stop the demo web process and run:

```bash
npx -y pnpm@9.15.4 --filter @aliauction/web dev
```

A production build with demo mode on fails on purpose (`DEMO_MODE_ENABLED_IN_PRODUCTION`).

## Checks

These run the scripts defined in `package.json` and `apps/web/package.json` through
`npx -y pnpm@9.15.4`:

```bash
npx -y pnpm@9.15.4 lint
npx -y pnpm@9.15.4 typecheck
npx -y pnpm@9.15.4 test
npx -y pnpm@9.15.4 --filter @aliauction/web check:bundle-leak
```

`check:bundle-leak` is the bundle audit: it fails if demo-only strings appear in a non-demo web
build. The read-only audit of the two newest design commits is recorded in
[`handoff.md`](docs-implementation/handoff.md) under "Design commit audit".

## Feature flags

Both flags below default to `false` in `apps/api/src/config.ts`, `docker/.env.example` and the
Compose overrides, and stay OFF:

- `FEATURE_LIVE_BIDDING_ENABLED`
- `FEATURE_REAL_MONEY_PAYMENTS_ENABLED`

Related decision-dependent flags (shipping rates, dispute evidence uploads, approved dispute
outcomes and email change) also default to `false`. No flag is enabled by any documentation here.

## Documentation index

- [Phase 1 status](docs-implementation/PHASE1_STATUS.md)
- [Docker guide](docs-implementation/docker-guide.md)
- [Local demo guide](docs-implementation/demo-guide.md)
- [Handoff notes](docs-implementation/handoff.md)
- [Plain-language decision briefing](docs-implementation/decision-briefing.md)
- [Decision log](docs-implementation/decision-log.md)
- [Owner decision pack](docs-implementation/phase1-decision-pack.md)
- [Owner decision forms](docs-implementation/owner-decision-forms.md)
- [Owner review pack](docs-implementation/owner-review-pack.md)
- [P0 traceability](docs-implementation/phase1-traceability.md)
- [Deferral register](docs-implementation/phase1-deferral-register.md)
- [Implementation document index](docs/00-implementation-document-index.md)
