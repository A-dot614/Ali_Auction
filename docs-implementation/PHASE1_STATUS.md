# Phase 1 — MVP Implementation Status

**Roadmap source:** `docs/15-delivery-roadmap.md`  
**Scope basis:** `docs/01-product-requirements-document.md`, `docs/02-epics-user-stories.md`  
**Last updated:** 2026-11-14 (Steps 1–4 of implementation continuation completed; stopped before auction/payment work)

## Phase 1 workstreams

| # | Workstream | Status | Notes |
|---|---|---|---|
| 1 | Identity and account management | In progress | Implemented: registration, login, logout, email verification, password reset (provider-agnostic email interface with dev console provider), bcrypt password hashing, DB-backed session tokens in HttpOnly/SameSite cookies with rotation and revocation on logout/reset, roles baseline (`buyer`,`seller`,`admin`), server-side GraphQL authz checks, audit logging helper + sensitive auth events, auth rate limiting, unit/integration/authz tests. Not yet: MFA (FR-008/P1, policy/open decisions), profile management UI/API, full account lifecycle, email delivery provider integration, production-grade session hardening/CSRF posture review for final deployment. |
| 2 | Seller profile and basic verification workflow | Not started | Identity roles seeded (`seller`), but seller profile/verification entities and workflows not migrated/implemented. Verification requirements/policies are open decisions. |
| 3 | Categories and listing management | Not started | No catalogue/listing migrations or APIs implemented in this slice. |
| 4 | Timed auction engine | Not started (blocked) | **No live bidding enabled.** Feature flag `FEATURE_LIVE_BIDDING_ENABLED` defaults to `false` and is enforced off at API startup. Auction rules/increments/close behavior require approved decisions. |
| 5 | Manual bidding and approved proxy-bidding baseline | Not started (blocked) | **No live bidding enabled.** Depends on approved bidding/proxy/tie/extension rules (`docs/07`, `docs/16`). |
| 6 | Search and browsing | Not started | No search/browse implementation; Postgres vs Elasticsearch for MVP is an open decision. |
| 7 | Checkout and selected payment provider | Not started (blocked) | **No real-money payments enabled.** Feature flag `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` defaults to `false` and enforced off. Provider/charge/capture/payout/escrow decisions open; sandbox-only future work required. |
| 8 | Orders and basic fulfilment | Not started | No order/fulfilment implementation in this slice. |
| 9 | Admin moderation and audit trail | In progress (foundation) | `audit_logs` table + `recordAudit` helper implemented; sensitive auth actions recorded (`user.registered`, `user.email_verified`, `user.login`, `user.login_failed`, `user.logout`, `user.password_reset_requested`, `user.password_reset`, `user.role_change`). Admin-only GraphQL resolver (`adminHealth`) protected by server-side role check. Moderation queues/admin UI/RBAC expansion pending. |
| 10 | Notifications | Not started | Notification domain not implemented; outbox/events pending reviewed migrations. |
| 11 | Responsive web/PWA | Started (scaffold) | Next.js scaffold remains; no identity UI flows wired yet. |
| 12 | Security, privacy, support and observability | In progress (foundation) | Env loading, secure cookie settings baseline, auth rate limiting, authz enforcement, audit logging for auth events, safe-by-default feature flags for live bidding/real-money. Pending: full threat model, CSRF strategy review, Redis-backed/distributed rate limits, structured logging/metrics/tracing/alerts, privacy workflows, support tooling, security/compliance reviews. |

## Step 1 — Scaffold verification (completed)

**Commands run (results):**
- `cp .env.example .env` (created `.env` for local run) — OK
- `docker compose -f infra/docker/docker-compose.yml up -d` — initially failed due to host ports `5432/6379` already allocated by other local containers; **fixed** by using non-conflicting host ports and bringing stack up on `5433` (Postgres) / `6380` (Redis) — OK
- `npx -y pnpm@9.15.4 install` — required workspace fixes (see deviations); after fixes, dependencies installed — OK
- `npx -y pnpm@9.15.4 -r typecheck` — OK
- `npx -y pnpm@9.15.4 lint` — OK (placeholder lint scripts)
- `npx -y pnpm@9.15.4 -r build` — OK
- `npx -y pnpm@9.15.4 dev` + endpoint checks — OK
  - `GET http://localhost:3000/` rendered (`200`, `AliAuction.ca`)
  - `GET http://localhost:4000/health` returned `200` OK
  - `POST http://localhost:4000/graphql` placeholder query responded (and after env-loading fix, `databaseConfigured`/`redisConfigured` reported `true`)

**Scaffold fixes applied (minimal):**
- Added `pnpm-workspace.yaml` (pnpm did not use `package.json#workspaces` reliably in this setup).
- Updated `infra/docker/docker-compose.yml`, `.env.example`, `.env` to use host ports `5433:5432` and `6380:6379` to avoid conflicts with existing local services.
- Updated `apps/api/src/index.ts` to load env from package-local or monorepo-root `.env` (pnpm runs scripts from package dirs).
- Added `.npmrc` (`public-hoist-pattern[]=*graphql*`, `node-linker=hoisted`) to avoid duplicate `graphql` module instances encountered during test/runtime integration with `graphql-http`.

## Step 2 — Migrations source of truth (completed)

**Migration tool chosen:** `node-pg-migrate` (added to `apps/api`)
- **Justification:** simple, lightweight SQL/JS migration runner with ordered migrations and minimal framework lock-in; fits current Express/`pg` setup and "keep it simple" requirement. Can be revisited if ORM/query-builder adoption is approved later.

**Changes:**
- Removed initdb auto-bootstrap from `infra/docker/docker-compose.yml` (no `/docker-entrypoint-initdb.d` mount). Fresh local DB now starts empty.
- Kept `infra/docker/initdb/001_starter_schema.sql` as **non-authoritative local reference only** with explicit warning header.
- Added authoritative migration workspace/docs: `apps/api/migrations/` and `apps/api/MIGRATIONS.md` (review process, baseline notes, commands).
- Created migrations:
  - `apps/api/migrations/1700000000000_baseline.js` — **empty baseline** (migration history only).
  - `apps/api/migrations/1700000000100_identity_access.js` — minimal reviewed identity/access schema for Step 3 (`pgcrypto`, `account_status`, `users`, `roles` seed buyer/seller/admin, `user_roles`, `sessions`, `email_verification_tokens`, `password_reset_tokens`, `audit_logs`, indexes).
- Added scripts in `apps/api/package.json`: `migrate`, `migrate:up`, `migrate:down`, `migrate:create`.

**Verification:**
- Fresh DB reset + `DATABASE_URL='postgresql://aliauction:aliauction@localhost:5433/aliauction_dev' npx node-pg-migrate -m apps/api/migrations up` — OK (baseline and identity migrations applied).

## Step 3 — Identity & access slice (completed for requested scope)

**Implemented (API, `apps/api`):**
- Config/safety: `src/config.ts` (env-driven config), feature flags `FEATURE_LIVE_BIDDING_ENABLED` and `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` default `false` and enforced off at startup via `assertSafeFeatureFlags()`; `src/db.ts` (`pg` pool/query/transaction helpers).
- Auth primitives: `src/auth/password.ts` (bcrypt hashing/verify), `src/auth/tokens.ts` (secure random token + SHA-256 token hashing).
- Email: `src/email/index.ts` provider-agnostic interface + `ConsoleEmailProvider` dev implementation; verification/reset token send helpers.
- Audit: `src/audit.ts` `recordAudit` helper; sensitive auth events recorded in `audit_logs`.
- Identity service: `src/auth/service.ts` — register (buyer+seller role baseline by default assignment), email verification, login, logout, request password reset, reset password (revokes sessions), session creation/authentication with rotation, role grant helper for controlled/admin/test use. Normalized email, basic validation, enumeration-resistant responses for login/reset request.
- Sessions/cookies: DB-backed session records (hashed token, expiry, revocation, rotation linkage, metadata), HttpOnly cookie (`SameSite=Lax`, `Secure` in production), rotation on aged sessions.
- Authz/context: `src/auth/authz.ts` (`requireAuth`, `requireRole`), request context builder in `src/graphql/resolvers/identity.ts`.
- GraphQL: `src/graphql/schema.ts` + `src/graphql/resolvers/identity.ts` mutations/queries: `register`, `verifyEmail`, `login`, `logout`, `requestPasswordReset`, `resetPassword`, `me`, admin-only `adminHealth`. Dev-only `verificationToken` returned in non-production register response for verification without external inbox (tokens also emitted via console email provider).
- Rate limiting: `src/middleware/rateLimit.ts` and coarse `/graphql` auth-op limiting in `src/index.ts` (register/login/reset stricter). TODO for Redis-backed/distributed/per-operation limits.
- Server wiring: `src/index.ts` exports `createApp()` (testable), cookie parsing, CORS with credentials, `/health`, `/graphql`.

**Tests added (`apps/api`):**
- `test/unit-auth.test.ts`: hashing/token unit tests.
- `test/integration-identity.test.ts`: integration `register -> verify -> login` and authz assertion that a buyer cannot call `adminHealth` (and can after admin role grant in controlled test setup).
- `vitest.config.ts`, `test/setup.ts`, `pnpm --filter @aliauction/api test` script.

**Verification (results):**
- `npx -y pnpm@9.15.4 --filter @aliauction/api typecheck` — OK
- `npx -y pnpm@9.15.4 --filter @aliauction/api build` — OK
- `npx -y pnpm@9.15.4 --filter @aliauction/api test` — **OK** (`2` test files passed, `4` tests passed: 2 unit, 2 integration)

## How to verify (current state)

```bash
cp .env.example .env
# local dev ports: Postgres 5433, Redis 6380 (adjusted to avoid host conflicts)
docker compose -f infra/docker/docker-compose.yml up -d

# apply migrations (authoritative)
cd apps/api
DATABASE_URL='postgresql://aliauction:aliauction@localhost:5433/aliauction_dev' npx node-pg-migrate -m migrations up

# from repo root
npx -y pnpm@9.15.4 install
npx -y pnpm@9.15.4 -r typecheck
npx -y pnpm@9.15.4 lint
npx -y pnpm@9.15.4 -r build
npx -y pnpm@9.15.4 --filter @aliauction/api test
npx -y pnpm@9.15.4 dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000/health`, `http://localhost:4000/graphql`
- Example GraphQL ops: `register`, `verifyEmail`, `login`, `me`, `logout`, `requestPasswordReset`, `resetPassword`, admin-only `adminHealth`.

## Open decisions / TODOs left (not invented)

References: `docs/16-assumptions-decisions-and-open-questions.md` (and related docs).

- **Identity/verification/policy:** email verification enforcement timing for protected actions, MFA requirements/enforcement (FR-008/P1), buyer/seller/business verification requirements, age/access policies, retention/deletion/privacy request workflows, suspension/appeals effects (`docs/16` §3, §7).
- **Auction/bidding (blocked, not implemented):** auction type/increments, bid semantics, proxy max/tie-breaking, snipe protection/extension limits, reserves/visibility, cancellation/non-payment outcomes, eligibility/payment-method requirements (`docs/07`, `docs/16` §3). `FEATURE_LIVE_BIDDING_ENABLED=false` enforced.
- **Fees/payments/payouts/escrow (blocked, not implemented):** commission payer/base/rates/refunds, provider/charge/capture model, KYC/payout timing, escrow meaning/legal approval (`docs/16` §4, §5). `FEATURE_REAL_MONEY_PAYMENTS_ENABLED=false` enforced.
- **Shipping/fulfilment:** shipping/pickup rules, provinces, carriers, dispute/loss handling (`docs/16` §6).
- **Product/ops/legal/compliance:** categories/moderation model, support/SLA, RPO/RTO, rollout, analytics approvals, terms/privacy/auction-rules disclosures and required Canadian legal/privacy/payment/tax reviews (`docs/10`, `docs/16` §8, §10).
- **Implementation TODOs:** replace dev console email with configured provider; harden CSRF/session strategy as needed; Redis-backed/distributed rate limiting; full RBAC/object-level authz expansion; additional audit coverage; production migration/DB operational practices.

## Deviations from docs / scaffold notes

- **Local infra ports changed** from scaffold defaults to `5433/6380` to avoid host conflicts in this environment (dev-only operational adjustment).
- **Initdb no longer source of truth:** `infra/docker/initdb/001_starter_schema.sql` retained as non-authoritative reference only; ordered migrations in `apps/api/migrations` are authoritative.
- **Identity schema is a minimal reviewed subset** for Step 3 (not the full draft entity set in `docs/05`); additional domain tables must be added via reviewed migrations when their rules are approved.
- **Registration assigns `buyer` and `seller` roles by default** as a baseline to support future flows; this may need adjustment based on approved onboarding/verification policy (`docs/16`).
- **GraphQL over `/graphql`** retained from scaffold/spec direction; cookie/session auth implemented (docs allow secure server-managed sessions). Per-operation rate limiting/CSRF details need further hardening.
- **Package manager/tooling:** added `pnpm-workspace.yaml` and `.npmrc` (hoisted graphql) to make install/test reliable in this environment; no dependency lockfile strategy beyond current state finalized.
- **No real OAuth/social login, no live bidding, no real-money/escrow/payout flows** implemented or enabled.
