# Docker guide — AliAuction.ca

DEV ONLY, NOT FOR PRODUCTION. These commands run the database, Redis, migrations, API and web
from one Compose file. The default target is **REAL mode**; demo routes are not built or served.
Demo mode is a separate profile and a separate non-production image target.

All credentials and feature flags come from `docker/.env.example`, which contains dev-only
placeholders only. Both `FEATURE_LIVE_BIDDING_ENABLED` and `FEATURE_REAL_MONEY_PAYMENTS_ENABLED`
are `false` there and in the Compose overrides. No payment provider is named, contacted or
configured. No `.env` file is copied into any image; `.dockerignore` files exclude them.

## First run / real mode

From the repository root:

```bash
docker compose up -d --build
```

This builds the images, waits for Postgres and Redis health, runs the existing ordered migrations
once, waits for API health, then starts the real web app. No prior database setup is needed.

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

To rebuild after changing a Dockerfile:

```bash
docker compose up -d --build
```

## Demo mode (side-by-side with real mode)

The demo profile adds a separate web service on host port 3001. It uses a dedicated
`web-demo` image target with `NEXT_PUBLIC_DEMO_MODE=true`; it is never the production image.

```bash
docker compose --profile demo up -d --build
```

- Real web: http://localhost:3000
- Demo web: http://localhost:3001/demo

Expect the demo banner text on the demo page:
`DEMO: not real, nothing is charged, no decision made`.

You can compare real and demo in two browser tabs. Stopping the profile leaves the real stack
running if you stop only the demo service:

```bash
docker compose stop web-demo
docker compose start web-demo
```

## Viewing logs

```bash
docker compose logs -f
docker compose logs -f api
docker compose logs -f web web-demo
docker compose logs -f migrate
```

## Running migrations again

Migrations run automatically on first start through the `migrate` service, which exits when done.
To run the existing migration command again:

```bash
docker compose run --rm migrate
```

The service uses the repo's `pnpm migrate:up` script (`node-pg-migrate up`) and the existing files
in `apps/api/migrations`. No migration was added or changed.

## Stopping

```bash
docker compose down
```

If the demo profile is active, use the same command with the profile so its service is included:

```bash
docker compose --profile demo down
```

## Resetting the database volume

This is destructive and removes all local data:

```bash
docker compose down -v
docker compose up -d --build
```

The named volumes `aliauction_pgdata` and `aliauction_redisdata` are recreated empty, and the
migration service applies the ordered migrations again on startup.

## Notes

- Every pnpm invocation inside the images uses `npx -y pnpm@9.15.4`; no shims are installed.
- The web and demo containers share the API network namespace so Next.js server components can
  reach the API at the same `http://localhost:4000` origin used by the browser.
- The real web image is built with `NEXT_PUBLIC_DEMO_MODE=false` and the demo image with
  `NEXT_PUBLIC_DEMO_MODE=true`. The build guard that rejects demo mode with
  `NODE_ENV=production` is unchanged; the demo target is deliberately a non-production target.

Real bidding and real-money payments stay OFF until every required decision-log row is filled and signed off.
