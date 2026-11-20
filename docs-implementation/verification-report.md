# Verification report — AliAuction.ca Phase 1 at `3cee3e6`

Nothing here records a decision, changes a P0 status or count, or marks an approval, review, drill
or sign-off as done. No product code, test, config, migration, Docker file or decision-log row was
changed. No payment provider is named or chosen. Both feature flags remain false.

**Clean run at `5affe02` passed: exit 0, 48/48 API files and 396/396 API tests, 46/46 web tests,
1/1 shared test (1829.82s). This confirms the earlier failures below were environmental — a local
credential mismatch and a database that became unavailable — not code failures.**

## Failures first — step 1e

**First run FAILED.** `npx -y pnpm@9.15.4 -r test -- --reporter=verbose` exited **1**:
**16 failed | 32 passed (48 test files); 38 failed | 185 passed | 173 skipped (396 tests);
Duration 70.40s** (import 75%, tests 14%, transform 5%, setup 4%, worker 2%). Every API
integration suite failed in `beforeAll` with PostgreSQL **28P01 `password authentication failed
for user "aliauction"`**. The root `.env` `DATABASE_URL` password does not match
`docker/.env.example`, which is the env file the Compose database actually uses. **This was an
environment mismatch, not a code failure.** It is listed under Known issues below. No `.env` or
config file was edited to hide it. The web and shared test packages passed in that same run.

**Second run (diagnostic run made after an environment fix), also FAILED.** With the
container-matching `DATABASE_URL` supplied inline to the command (no file changed), the API suite
alone with the verbose reporter exited **1**:
**2 failed | 46 passed (48 test files); 3 failed | 375 passed | 18 skipped (396 tests);
1 error; Duration 1778.27s** (tests 97%, import 2%). The late failures were not code failures:
`integration-orders.test.ts` failed with **57P03 "the database system is shutting down"** and
`integration-search.test.ts` failed three tests with 57P03 plus an unhandled/uncaught
**57P01 "terminating connection due to administrator command"**. By the time this run ended,
`docker compose ps` listed no containers, although four containers (api, web, db, redis) had been
healthy at gate time. Nothing was stopped or started by me.

**Isolation check after the first failure:** `test/integration-orders.test.ts` run alone with the
matching `DATABASE_URL` exited **0** — 1 file passed, 18 tests passed, Duration **216.68s**
(tests 97%, import 2%); its slowest test took **24154ms**. This confirms the first run's mass
failure was environmental.

## Gate

- `git rev-parse HEAD` = `3cee3e6368ef03716af31fa7c61ac5d40593b6c0` — matched.
- `git status --short` showed only `?? docs/DESIGN-shopify.md` — no modified or staged files. That
  file was not touched or committed.
- At gate time a background API test process from an earlier session was still running
  (`pnpm --filter @aliauction/api test`, about 26 minutes old, with a live vitest worker), plus a
  `pnpm --filter @aliauction/web start` server process. Containers `ali_auction-api-1`,
  `ali_auction-web-1`, `aliauction-db` and `aliauction-redis` were all Up (healthy). Per the rule,
  I waited for the test process to finish; I did not kill anything. It finished with exit 1
  (1 failed | 47 passed files; 1 failed | 395 passed tests; 1757.21s) on a single 30000ms timeout
  in `integration-orders.test.ts`.

## Step 1 results (each command run once, in order)

| Step | Command | Exit | Totals / result |
|---|---|---|---|
| 1a | `npx -y pnpm@9.15.4 lint` | 0 | api, web, shared lint done; no errors |
| 1b | `npx -y pnpm@9.15.4 -r typecheck` | 0 | api, web, shared typecheck done; no errors |
| 1c | `npx -y pnpm@9.15.4 audit --prod --audit-level=high` | 0 | "No known vulnerabilities found" |
| 1d | `npx -y pnpm@9.15.4 --filter @aliauction/web test` | 0 | 46 tests, 46 pass, 0 fail, 0 skipped; 9653.42ms |
| 1e first | `npx -y pnpm@9.15.4 -r test -- --reporter=verbose` | **1** | 16 failed / 32 passed files; 38 failed / 185 passed / 173 skipped tests; 70.40s; DB auth 28P01 (see above) |
| 1e diagnostic | API suite only, matching `DATABASE_URL`, verbose reporter | **1** | 2 failed / 46 passed files; 3 failed / 375 passed / 18 skipped tests; 1 error; 1778.27s; late DB 57P03/57P01 (see above) |
| 1e isolation | `integration-orders.test.ts` alone, matching `DATABASE_URL` | 0 | 1 file, 18 tests passed; 216.68s |
| 1f build off | `npx -y pnpm@9.15.4 --filter @aliauction/web build` | 0 | demo off build succeeded |
| 1f build on | `NODE_ENV=production NEXT_PUBLIC_DEMO_MODE=true npx -y pnpm@9.15.4 --filter @aliauction/web build` | 1 | failed as designed: `DEMO_MODE_ENABLED_IN_PRODUCTION` |
| 1f leak | `npx -y pnpm@9.15.4 --filter @aliauction/web check:bundle-leak` | 0 | `[bundle-leak] OK: no demo-only strings in 214 production build files` |
| 1g flags | Default config probe | 0 | `liveBiddingEnabled=false`, `realMoneyPaymentsEnabled=false`, default guards do not throw |
| 1g guards | `FEATURE_LIVE_BIDDING_ENABLED=true` / `FEATURE_REAL_MONEY_PAYMENTS_ENABLED=true` probes | n/a | `assertSafeFeatureFlags()` threw for both with the matching message; flags restored to OFF (env only, no file changed) |

Source evidence for the flag defaults and guards: `apps/api/src/config.ts:22-23` (defaults
`"false"`), `:159-188` (`assertSafeFeatureFlags`), `:195-201`
(`assertMoneyFlagsOffForProduction`), `apps/api/src/index.ts:38-39` (both guards called at
startup), `docker/.env.example:33-34` and `docker-compose.yml:49-50,65-66,109-110` (all false).

## Step 2 — timing diagnosis (from the diagnostic run's verbose output)

### Ten slowest test files by summed test duration

| # | Test file | Summed test time | Tests | Slowest single test |
|---|---|---:|---:|---:|
| 1 | `test/integration-auction.test.ts` | 236146ms | 29 | 13095ms |
| 2 | `test/integration-reports.test.ts` | 227099ms | 23 | 15189ms |
| 3 | `test/integration-auction-close.test.ts` | 190667ms | 17 | 22778ms |
| 4 | `test/integration-listing.test.ts` | 177057ms | 19 | 40507ms |
| 5 | `test/integration-notifications.test.ts` | 168640ms | 17 | 17973ms |
| 6 | `test/integration-disputes.test.ts` | 152187ms | 15 | 21120ms |
| 7 | `test/integration-search.test.ts` | 129294ms | 11 | 13774ms |
| 8 | `test/integration-security.test.ts` | 123679ms | 25 | 14513ms |
| 9 | `test/integration-hosted-checkout.test.ts` | 85101ms | 11 | 15962ms |
| 10 | `test/integration-seller.test.ts` | 50389ms | 5 | 14764ms |

Totals from that run: 48 files, 396 tests, 1778.27s. Durations are the sum of the per-test `ms`
values printed by the verbose reporter, so they exclude import/setup/worker time.

### Spread or concentration

**Concentrated, not even.** The ten files above total **1540259ms (about 86.6% of 1778270ms)** of
measured test time. All ten are database-backed integration files. By contrast, source-guard and
pure-unit tests report single- or double-digit milliseconds (for example
`test/dispute-reasons.test.ts` at 6ms and 1ms, and `source-guard-disputes.test.ts` at 7ms and 5ms
in the same run). The cost follows database work and password hashing, not test count.

### Likely causes, each backed by a duration or a config line

- **Serial file execution.** `apps/api/vitest.config.ts:20` sets `fileParallelism: false`, so the
  48 files do not run concurrently. Vitest also reported `48 workers spawned · ~457ms startup
  each (spawn + environment, per file)` and `at least ~21.49s faster with isolate: false`.
- **Database reset per test.** At least ten integration files define `beforeEach(async () =>
  await resetDb())` with `TRUNCATE TABLE … RESTART IDENTITY CASCADE` (for example
  `apps/api/test/integration-identity.test.ts:17-20,37-39`; the same pattern appears in the
  auction, auction-close, listing, notifications, orders, reports, search, security and seller
  files). The ten slowest files are exactly these files.
- **Password hashing cost.** `apps/api/src/auth/password.ts:3` sets `const ROUNDS = 12;` and `:6`
  calls `bcrypt.hash(password, ROUNDS)`. Test code calls `register` at roughly 159 sites, so each
  fresh user in each reset database pays a cost-12 hash.
- **Tight timeouts are a symptom, not the cause.** `apps/api/vitest.config.ts:18-19` sets
  `testTimeout: 30000` and `hookTimeout: 30000`. The earlier session's full run failed
  `recordFulfilment…` with `Test timed out in 30000ms`; the isolated rerun of that file passed with
  an individual test at **24154ms**, close to the 30000ms limit.
- **No fixed sleeps found.** A search of `apps/api/src` and `apps/api/test` found no `setTimeout`,
  `sleep`, `delay` or `await new Promise` sleep in tests; the only `setTimeout` is
  `apps/api/src/observability/health.ts:20`, a readiness timeout. Fixed sleeps are therefore not a
  supported explanation for the 1778s duration.

Nothing in this diagnosis was changed.

## Possible speed-ups — all need engineering review

Each item below is an untested possibility, not a recommendation or decision.

1. Set `fileParallelism: true` so integration files run concurrently — needs engineering review
   (shared database and `TRUNCATE` may make this unsafe).
2. Set `isolate: false` to reuse workers; vitest estimated at least ~21.49s saved — needs
   engineering review.
3. Reduce the bcrypt cost only in the test environment — needs engineering review (must not change
   production behaviour).
4. Replace per-test `TRUNCATE … RESTART IDENTITY CASCADE` with a per-test transaction rollback —
   needs engineering review.
5. Split unit/source-guard tests from database integration tests so the fast subset can run
   without a database — needs engineering review.
6. Raise `testTimeout` / `hookTimeout` above 30000ms — needs engineering review (could mask the
   observed 24154ms test and the 30000ms timeout failure).
7. Align the root `.env` `DATABASE_URL` with `docker/.env.example` for local test runs — needs
   engineering review (environment fix, not a code change).
8. Give the suite a dedicated, persistent test database service rather than relying on ad-hoc
   containers — needs engineering review.

## Known issues, needs engineering review

- **Root `.env` / Docker DB password mismatch:** the first full-suite run failed with 28P01 for
  every API integration suite because the root `.env` `DATABASE_URL` password does not match
  `docker/.env.example` used by the Compose database. Left exactly as found.
- **Database unavailable late in the diagnostic run:** 57P03 "database system is shutting down"
  and 57P01 "terminating connection due to administrator command"; `docker compose ps` reported no
  containers afterwards although four were healthy at gate time. No container was stopped or
  started by me.
- **Flaky 30000ms timeout:** `recordFulfilment shipping: paid -> processing -> shipped…` timed out
  in the earlier session's full run and in no later isolated run; it needs engineering review.
- **Full API suite duration:** 1778.27s in the diagnostic run and 1757.21s in the earlier session's
  run; allow for roughly 1600–1800s rather than a short CI timeout.
- **Decision and readiness gaps are unchanged:** 34 of 35 decision rows remain empty, FR-021 still
  needs confirmation by the product owner of record, FR-042 is NOT MET, and no approval, legal
  review, security review, restore drill or sign-off is recorded as done.

## Clean-run attempt at 5affe02

Goal: one clean, honest full-suite result on commit `5affe02f79b2c672024d530439deb1541da243d4`,
obtained by fixing only the local environment. No committed file was edited to hide the credential
mismatch; no `.env.example`, Docker file, test, config or decision-log row was changed.

Values below are masked as `dev-only` placeholders. The literal values were taken from
`docker/.env.example` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) and passed only as an
inline `DATABASE_URL`; no URL was written to a tracked file. Inline form used throughout:

`DATABASE_URL='postgresql://aliauction:<dev-only password from docker/.env.example>@localhost:5433/aliauction_dev'`

### Gate and environment

- `git rev-parse HEAD` = `5affe02f79b2c672024d530439deb1541da243d4` — matched.
- `git status --short` showed only `?? docs/DESIGN-shopify.md` — untouched and not committed.
- No test process was running. Containers at gate time were `aliauction-postgres` (host port 5435)
  and `aliauction-redis` (host port 6382), both healthy, from a different Compose service set.
- `docker compose up -d db redis` was run once. Compose recreated `aliauction-redis` and created
  `aliauction-db`; it reported `aliauction-postgres` as an orphan and left it untouched. Both `db`
  and `redis` then reported healthy (`5433->5432`, `6380->6379`).

### Connectivity and migrations

- Connectivity through the project's own `pg` tooling:
  `DATABASE_URL='…' npx -y pnpm@9.15.4 exec tsx -e 'import { query } from "./src/db.ts"; query("SELECT 1 AS ok") …'`
  → `CONNECT_OK=1`, exit 0.
- Migration command, run once:
  `DATABASE_URL='…' npx -y pnpm@9.15.4 --filter @aliauction/api migrate:up`
  → `No migrations to run!` / `Migrations complete!`, exit 0.

### Full-suite result

One command, alone, with the maximum timeout, output redirected to the git-ignored
`logs/clean-run-5affe02.log` (not `/tmp`, not committed):

`DATABASE_URL='…' npx -y pnpm@9.15.4 -r test -- --reporter=verbose > logs/clean-run-5affe02.log 2>&1`

**Exit 0 — clean pass.** Totals:

| Package | Result | Duration |
|---|---|---|
| API (vitest) | 48 passed (48 files); 396 passed (396 tests) | 1829.82s (tests 98%, import 2%) |
| Web (node:test) | 46 tests, 46 pass, 0 fail, 0 skipped | 12538.78ms |
| Shared (node:test) | 1 test, 1 pass, 0 fail, 0 skipped | 933.78ms |

The log contains no `FAIL` lines, no `28P01`, `57P01` or `57P03` database errors, and no
`ERR_PNPM` failure. No container was stopped, restarted or recreated while the suite ran; no other
heavy command was started during the run. After the run completed, a server restart changed the
visible Compose set to api/redis/web plus the untouched orphan `aliauction-postgres`; this is
recorded for accuracy and required no action.

### Conclusion

The earlier full-suite failures were environmental: the root `.env` credential mismatch (28P01)
and the database becoming unavailable mid-run (57P03/57P01). With only the inline environment
corrected, the full suite passes on this commit. No source, test, config or flag was changed.

Real bidding and real-money payments stay OFF until every required decision-log row is filled and signed off.
