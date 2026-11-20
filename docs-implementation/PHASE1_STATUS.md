# Phase 1 — MVP Implementation Status

**Roadmap source:** `docs/15-delivery-roadmap.md`  
**Scope basis:** `docs/01-product-requirements-document.md`, `docs/02-epics-user-stories.md`  
**Last updated:** 2026-11-17 (Slices 0–9 complete for their scope; Slice 10 structured logging/redaction/metrics/health/privacy inventory/IDOR/scanning completed; stopped before Slice 11)

## Phase 1 workstreams

| # | Workstream | Status | Notes |
|---|---|---|---|
| 1 | Identity and account management | In progress | Implemented: registration, login, logout, email verification, password reset (provider-agnostic email interface with dev console provider), bcrypt password hashing, DB-backed session tokens in HttpOnly/SameSite cookies with rotation and revocation on logout/reset, roles baseline (`buyer`,`seller`,`admin`), server-side GraphQL authz checks, audit logging helper + sensitive auth events, auth rate limiting, unit/integration/authz tests. Not yet: MFA (FR-008/P1, policy/open decisions), profile management UI/API, full account lifecycle, email delivery provider integration, production-grade session hardening/CSRF posture review for final deployment. |
| 2 | Seller profile and basic verification workflow | Not started | Identity roles seeded (`seller`), but seller profile/verification entities and workflows not migrated/implemented. Verification requirements/policies are open decisions. |
| 3 | Categories and listing management | In progress (Slice 3a completed; Slice 3b moderation/public visibility completed for requested scope; auction scope pending) | Slice 3a implemented: placeholder categories (seeded `is_placeholder=true`, "PLACEHOLDER - NOT APPROVED"), listing drafts/create/update/submit, `myListings`, public `listing(slug)` (published-only, public-safe fields), listing state machine module, migration/tests/docs. Slice 3b added staff-only moderation mutations (approve/reject/pause/resume/remove) with `SELECT ... FOR UPDATE` concurrency control, audit logging decision (`listing.*` + `listing.transition_rejected`), self-moderation forbidden, and public visibility for all statuses. **No auctions/bids/scheduling enforcement** (requested times draft-only/non-binding). Moderation policy/UI/SLAs (docs/16 §8 #3, §8 #6, §7 #5, §7 #6) and seller notifications (Slice 8) remain open. |
| 4 | Timed auction engine | Partial (Slice 4a + 4b close/publisher; snipe/reserve/scheduler pending) | **Live bidding OFF by default.** Slice 4a added auctions/auction_events/outbox schema, auction state machine, and owner-only `createAuction`. Slice 4b adds server-authoritative `closeAuction`/`closeDueAuctions` (idempotent, transactional) and an outbox publisher with in-memory/console sinks; no production scheduler is added. Snipe protection and reserve enforcement remain pending. |
| 5 | Manual bidding and approved proxy-bidding baseline | Partial (Slice 4a manual bidding + 4b winner determination; proxy pending) | **Live bidding OFF by default; enabled for no user.** Slice 4a added flag-gated `placeBid` (server UTC window, idempotent `request_id`, transaction + row lock, minimum-bid placeholder increment, one outbox row per accepted bid) and public `auction`/`auctionForListing` queries. Slice 4b determines the winner at close from the highest accepted bid. Proxy bidding/tie-breaking not implemented (`proxy_bids` unused; `setProxyBid` → `NOT_IMPLEMENTED_PENDING_DECISION`). |
| 6 | Search and browsing | Partial (Slice 5 API complete; UI not built) | Slice 5 added published-only category browse and PostgreSQL FTS search (`searchListings`, `categoryListings`) with keyset pagination, sorts, filters, public-safe results and cursor unit/integration tests. Search is a derived projection over PostgreSQL (docs/03 §1/§7; docs/11 §5: PostgreSQL FTS for MVP). No Elasticsearch. UI/wireframes remain OPEN (docs/16 §8 #10). |
| 7 | Checkout and selected payment provider | Partial (Slice 6 sandbox only) | **No real-money payments enabled.** Flag `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` defaults OFF and is asserted OFF at production startup (incl. `assertMoneyFlagsOffForProduction`). Slice 6 adds fake-provider checkout, signed sandbox webhooks, payments/refunds behind the flag. No Stripe/PayPal, live capture, escrow or payouts. |
| 8 | Orders and basic fulfilment | Partial (Slice 6 manual fulfilment) | Slice 6 adds orders created from `auction.closed` outbox events, fee snapshots, participant-scoped order queries, manual shipping/pickup fulfilment and internal refunds. No carrier integrations, shipping rates or tax. |
| 9 | Admin moderation and audit trail | Partial (Slice 7 reports/queue/suspension/audit) | `audit_logs` + `recordAudit`; auth event audit; admin-only `adminHealth`. Slice 7 adds user reports, a staff-only moderation queue, manual report resolution, user suspension/reinstatement via state machines, and one-audit-row-per-privileged-mutation coverage with an append-only guard. **No UI (Slice 9), no appeal workflow (docs/16 §7 #6), no notifications (Slice 8), no automated moderation (docs/16 §8 #3).** |
| 10 | Notifications | Partial (Slice 8 outbox consumer + in-app/console) | Notification table, per-user preferences, delivery attempts and an idempotent outbox consumer are implemented. In-app and dev-console email sinks only. **No real email/SMS/push provider (docs/11 §6), no real-time delivery (docs/03 §5), no marketing category, no UI (Slice 9).** |
| 11 | Responsive web/PWA | Partial (Slice 9 responsive scaffold + PWA + security headers) | Public/auth/buyer/seller routes, mobile-first Tailwind layout, screen states, server-offset auction countdown, bid status, manifest/service worker/offline page and security headers implemented. Real-time flag OFF with refetch fallback; no Socket.io gateway. **No admin screens (deferred), no visual design (docs/16 §8 #6), no real-time delivery (docs/03 §5), Lighthouse result recorded below.** |
| 12 | Security, privacy, support and observability | Partial (Slice 10 local observability + security scaffolding) | Structured JSON logs with enforced redaction, requestId propagation, in-process Prometheus metrics, liveness/readiness, privacy data inventory, deletion **request** stub, dependency audit + secret scan in CI, IDOR suite, and a security test checklist. **No vendor monitoring, no alerting/routes, no distributed tracing, no real secret manager, no backup restore drill, no CSRF strategy review; retention OPEN (docs/16 §7 #7).** |

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
- (Slice 0 follow-up) Replaced placeholder lint/test scripts with real ESLint flat config and package-level tests where appropriate; added migration roundtrip validation and CI Postgres-backed checks. The former initdb bootstrap SQL copy was removed after confirming no runtime code depended on it.

## Step 2 — Migrations source of truth (completed)

**Migration tool chosen:** `node-pg-migrate` (added to `apps/api`)
- **Justification:** simple, lightweight SQL/JS migration runner with ordered migrations and minimal framework lock-in; fits current Express/`pg` setup and "keep it simple" requirement. Can be revisited if ORM/query-builder adoption is approved later.

**Changes:**
- Removed initdb auto-bootstrap from `infra/docker/docker-compose.yml` (no `/docker-entrypoint-initdb.d` mount). Fresh local DB now starts empty.
- Removed `infra/docker/initdb/001_starter_schema.sql` (former non-authoritative local reference) after migration tooling became authoritative and no runtime code depended on it; docs updated accordingly.
- Added authoritative migration workspace/docs: `apps/api/migrations/` and `apps/api/MIGRATIONS.md` (review process, baseline notes, commands).
- Created migrations:
  - `apps/api/migrations/1700000000000_baseline.js` — **empty baseline** (migration history only).
  - `apps/api/migrations/1700000000100_identity_access.js` — minimal reviewed identity/access schema for Step 3 (`pgcrypto`, `account_status`, `users`, `roles` seed buyer/seller/admin, `user_roles`, `sessions`, `email_verification_tokens`, `password_reset_tokens`, `audit_logs`, indexes).
- Added scripts in `apps/api/package.json`: `migrate`, `migrate:up`, `migrate:down`, `migrate:create`.

**Verification:**
- Fresh DB reset + `DATABASE_URL='postgresql://aliauction:aliauction@localhost:5433/aliauction_dev' npx node-pg-migrate -m apps/api/migrations up` — OK (baseline and identity migrations applied).

**Correction (migration roundtrip false positive):**
- Earlier reports marked the migration roundtrip as passing. That check had a false positive: the down step rolled back one migration, and the script printed success anyway.
- The corrected script (commit SHA `20e95b299e153873d8b18f9bf37be5ade3704dcb`) now asserts the expected migration list at every step.
- The migration gate is verified only after a green CI run on that SHA.

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
- **Auction/bidding (Slice 4a placeholder implemented behind an OFF flag):** auction format, bid semantics, increments, proxy max/tie-breaking, snipe protection/extension limits, reserves/visibility, cancellation-after-bids, non-payment outcomes, eligibility/payment-method requirements remain **OPEN** (`docs/07`, `docs/16` §3 #1–#9). Slice 4a implements English-ascending-only manual bidding placeholders only; `FEATURE_LIVE_BIDDING_ENABLED=false` enforced at startup and bidding enabled for no user.
- **Fees/payments/payouts/escrow (blocked, not implemented):** commission payer/base/rates/refunds, provider/charge/capture model, KYC/payout timing, escrow meaning/legal approval (`docs/16` §4, §5). `FEATURE_REAL_MONEY_PAYMENTS_ENABLED=false` enforced.
- **Shipping/fulfilment:** shipping/pickup rules, provinces, carriers, dispute/loss handling (`docs/16` §6).
- **Product/ops/legal/compliance:** categories/moderation model, support/SLA, RPO/RTO, rollout, analytics approvals, terms/privacy/auction-rules disclosures and required Canadian legal/privacy/payment/tax reviews (`docs/10`, `docs/16` §8, §10).
- **Implementation TODOs:** replace dev console email with configured provider; harden CSRF/session strategy as needed; Redis-backed/distributed rate limiting; full RBAC/object-level authz expansion; additional audit coverage; production migration/DB operational practices.

## Deviations from docs / scaffold notes

- **Local infra ports changed** from scaffold defaults to `5433/6380` to avoid host conflicts in this environment (dev-only operational adjustment).
- **Initdb bootstrap removed:** former `infra/docker/initdb/001_starter_schema.sql` reference copy was deleted after confirming no runtime code depended on it; ordered migrations in `apps/api/migrations` are authoritative.
- **Identity schema is a minimal reviewed subset** for Step 3 (not the full draft entity set in `docs/05`); additional domain tables must be added via reviewed migrations when their rules are approved.
- **Registration assigns `buyer` and `seller` roles by default** as a baseline to support future flows; this may need adjustment based on approved onboarding/verification policy (`docs/16`).
- **GraphQL over `/graphql`** retained from scaffold/spec direction; cookie/session auth implemented (docs allow secure server-managed sessions). Per-operation rate limiting/CSRF details need further hardening.
- **Package manager/tooling:** added `pnpm-workspace.yaml` and `.npmrc` (hoisted graphql) to make install/test reliable in this environment; no dependency lockfile strategy beyond current state finalized.
- **No real OAuth/social login, no live bidding, no real-money/escrow/payout flows** implemented or enabled.

## Slice 0 — Foundation fixes (completed in this session)

**Work done:**
- **ESLint (flat config):** added root `eslint.config.mjs` (flat config) covering `apps/api`, `apps/web`, `packages/shared` with TypeScript-aware linting and ignores for build artifacts (`dist`, `.next`, `node_modules`, generated files). Updated lint scripts: root and all packages now run real `eslint .` (replacing placeholders). Fixed lint issues found (removed unused `eslint-disable` directives in `apps/api/src/email/index.ts`, `apps/api/src/index.ts`). Lint is clean.
- **Tests for shared/web:** added real test scripts. `packages/shared` uses Node's built-in test runner (`node --test`) to validate source contract/exports (`packages/shared/test/shared.test.mjs`). `apps/web` uses Node's built-in test runner for scaffold presence checks (`apps/web/test/scaffold.test.mjs`) with explicit note that UI/component rendering tests are deferred until authenticated/buyer/seller flows and design-system components are implemented (per `docs/08`, `docs/12`).
- **Migration roundtrip:** added `scripts/test-migrations-roundtrip.sh` and root `pnpm migrate:test` to run `up`, `down` (all), `up` on a scratch database. Verified on local scratch DB (`aliauction_migrate_test`) against `apps/api/migrations` (baseline + identity/profile migrations). Script supports local `psql` or Docker exec fallback.
- **CI workflow:** updated `.github/workflows/ci.yml` to run install, typecheck, lint, test, build, `migrate:up` against a Postgres service container, and migration roundtrip (`pnpm migrate:test`). **Not claimed green in GitHub Actions** (not executed in this environment); equivalent local checks were run (see verification below), except where noted.
- **Initdb bootstrap removal:** deleted `infra/docker/initdb/001_starter_schema.sql` after confirming no runtime code depended on it (references were documentation/config comments only). Updated `apps/api/MIGRATIONS.md`, `infra/docker/docker-compose.yml`, `README.md`, and this status doc to reflect removal and migrations as the sole schema source of truth.

**Verification (local, 2026-11-15):**
- `npx -y pnpm@9.15.4 -r typecheck` — **OK**
- `npx -y pnpm@9.15.4 lint` — **OK** (all packages)
- `npx -y pnpm@9.15.4 -r test` — **OK** (`packages/shared`: 1 passed, `apps/web`: 1 passed, `apps/api`: 8 passed)
- `npx -y pnpm@9.15.4 --filter @aliauction/api build` and `--filter @aliauction/shared build` — **OK**. Full `pnpm -r build` was interrupted by harness execution timeout in one rerun attempt, but `apps/web` had a prior successful Next.js build and `.next` artifacts present; api/shared builds re-confirmed.
- `bash scripts/test-migrations-roundtrip.sh` — **OK** (scratch DB up/down/up)

**Could not verify:**
- GitHub Actions CI run/log (workflow updated but not executed here).
- A single uninterrupted `pnpm -r build` run in this pass due to harness timeout (components individually/prior-verified).

## Slice 1 — Complete identity and access (workstream 1, in progress/completed for requested scope)

**Work done:**
- **Migration:** `apps/api/migrations/1700000000200_identity_profile.js` adds `user_profiles` (display name, bio, province) for own-profile management.
- **Email verification enforcement:** added `requireVerified` authz guard and stable error code `EMAIL_NOT_VERIFIED` for protected mutations. Unverified users can still log in and read public/authenticated-allowed data (`me`, profile/session management as applicable), but cannot perform protected mutations. Added placeholder `protectedActionPing` mutation (no domain side effects) to enforce/test until bid/listing/checkout mutations exist; real protected mutations must reuse the same guard.
- **Profile management:** `myProfile` query and `updateMyProfile` mutation (display name, bio, province). Email change not supported without re-verification (not exposed). Profile updates audited (`user.profile_updated`).
- **Session management:** `mySessions` query and `revokeMySession` mutation for own sessions (current session marked). Password reset revokes all sessions (existing behavior retained/verified). Added `revokeAllUserSessions`/`suspendUser` helpers to revoke sessions on suspension; suspension action surface itself is an admin/moderation concern (future slice) but revocation behavior is implemented and audited.
- **Resend verification:** `resendVerification(email)` mutation, enumeration-safe response, rate-limited as auth-sensitive op.
- **Rate limiting & enumeration safety:** auth-sensitive GraphQL operations (`register`, `login`, `requestPasswordReset`, `resetPassword`, `resendVerification`) go through stricter limiter; general GraphQL limited; limits relaxed in `NODE_ENV=test` to allow deterministic test runs. Register/login/forgot-password/resend responses are enumeration-safe (generic errors/messages where applicable).
- **Audit logging:** sensitive auth actions recorded (including existing login success/failure-at-safe-level metadata, role change, password reset request/reset, registration/verification/logout, session revocations, profile updates, verification resend). No passwords, tokens, or raw session IDs logged.
- **Schema/API:** added `Profile`, `Session` types/queries/mutations and `protectedActionPing`; updated auth context to track current session id.

**Verification (local):**
- `npx -y pnpm@9.15.4 --filter @aliauction/api typecheck` — **OK**
- `npx -y pnpm@9.15.4 --filter @aliauction/api test` — **OK** (2 files, 8 tests passed), including required cases:
  - session revoked after password reset
  - unverified user blocked from protected mutation (`EMAIL_NOT_VERIFIED`)
  - enumeration-safe responses for register, login, forgot-password, resend-verification
  - audit row written for role change
  - existing register→verify→login and admin-authz tests still pass

**Open decisions / TODOs (Slice 1 relevant, not invented):**
- Verification/MFA enforcement details and protected-function policy timing remain open (`docs/16` §3/#3, §7/#3, FR-008/P1) — current guard enforces email verification for protected mutations as requested.
- Registration currently seeds `buyer`+`seller` roles by default (baseline assumption) — may change with approved onboarding/verification policy (`docs/16` §7).
- Suspension/appeals workflow, admin UX, and staff RBAC are future slices; only session revocation/audit helpers added here.
- Redis-backed/distributed/per-operation rate limiting, CSRF hardening, and production email provider integration remain TODOs (`docs/10`, `docs/11`).

## Workstream status update (summary)

| # | Workstream | Status |
|---|---|---|
| 1 | Identity and account management | In progress (Slice 1 core requirements implemented: verification enforcement guard, profile, session mgmt, resend verification, rate-limit/enumeration-safe auth flows, auth audit coverage, tests). MFA/UI/policy decisions pending. |
| 9 | Admin moderation and audit trail | In progress (audit helper/events expanded; admin-only resolver/authz baseline; moderation queue/actions pending). |
| 12 | Security, privacy, support and observability | In progress (lint/CI foundation improved, rate limiting/authz/feature-flag safety maintained; broader observability/privacy/support/compliance pending). |
| Others | 2,3,4,5,6,7,8,10,11 | Not started / scaffold or blocked as previously noted (live bidding and real-money payments remain **OFF** by enforced defaults). |

**Stopped after Slice 1 for review as requested. No auction/payment/escrow/payout work started.**

## Pre-slice fixes for Slice 2 (completed)

- **(a) Web build verification (background/logged):** ran `pnpm --filter @aliauction/web build` redirected to `logs/web-build.log` and polled to completion (see report for tail). Re-ran after lint config fix to obtain warning-free build output (`logs/web-build-fix2.log`).
- **(b) Next.js ESLint warning:** added `@next/eslint-plugin-next` (available in workspace deps/node_modules) and wired into flat ESLint config; added `apps/web/eslint.config.mjs` with Next plugin rules so `next build` linting no longer reports "Next.js plugin was not detected". Web lint passes; warning-free build confirmed in `logs/web-build-fix2.log`.
- **(c) Workspace coverage ("3 of 4 projects"):** `pnpm-workspace.yaml` defines 3 workspace packages (`apps/api`, `apps/web`, `packages/shared`). Root `package.json` orchestrates recursive scripts but is not a recursive workspace target; pnpm reports `Scope: 3 of 4 workspace projects` in this environment. Added `pnpmWorkspaceNote` in root `package.json` and this note in status docs. All 3 workspace packages have lint/typecheck/test/build scripts and pass checks.
- **(d) Rate-limit test:** added `apps/api/test/rate-limit.test.ts` asserting N+1th request returns `429` with stable error code `RATE_LIMITED` under explicit low limits, and asserting production-intended limits (30 general / 10 strict auth) are not relaxed to test values.

## Slice 2 — Seller profile and verification (workstream 2, completed for requested scope)

**Migration (reviewed):** `apps/api/migrations/1700000000300_seller_profile_verification.js`
- `seller_profiles` (id, user_id unique FK users, `seller_type` enum individual/business/institutional, display_name, public_store_name nullable, legal_name nullable restricted, province_code, timestamps). Separate from account status.
- `seller_verifications` (id, seller_profile_id FK, status enum `not_submitted|submitted|under_review|approved|rejected|more_info_requested`, submitted_at, reviewed_at, reviewed_by FK users nullable, decision_reason nullable, `document_storage_key` nullable placeholder — **no identity documents stored**, TODO docs/16 §7 #1,#2, timestamps).
- Index `seller_verifications_profile_created_idx` on `(seller_profile_id, created_at DESC)`.
- Seeds staff roles `moderator`, `support` if missing (docs/09 baseline). Working down migration; verified via roundtrip script.

**State machine:** `apps/api/src/seller/verificationStateMachine.ts` (single transition table/module)
- Allowed: `not_submitted→submitted`, `submitted→under_review`, `under_review→approved|rejected|more_info_requested`, `more_info_requested→submitted`.
- `rejected→submitted` (re-application) behind config flag `SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED = false` (OFF by default, TODO docs/16 §7 #6).
- Disallowed transitions throw `INVALID_VERIFICATION_TRANSITION`.
- Unit tests cover every allowed and disallowed pair (`apps/api/test/seller-verification-state.test.ts`).

**Service/operations:** `apps/api/src/seller/service.ts`, resolvers `apps/api/src/graphql/resolvers/seller.ts`, schema/types in `apps/api/src/graphql/schema.ts`
- `createSellerProfile` / `updateSellerProfile`: owner-only, requires verified email (`requireVerified`), validates `seller_type` and `province_code`, does not change verification status. Profile creation initializes `not_submitted` verification record.
- `submitSellerVerification`: owner-only, requires profile, moves to `submitted`, records `submitted_at`; accepts no documents; re-submit while already `submitted` rejected cleanly.
- `reviewSellerVerification`: staff roles `moderator|support|admin` (permission concept `seller.verify`, docs/09), reviewer cannot be seller, `rejected`/`more_info_requested` require non-empty reason, `approved` reason optional, records `reviewed_by`/`reviewed_at`.
- `requireApprovedSeller` guard on placeholder `sellerActionPing` (no real listing/bid mutations) returns `SELLER_NOT_APPROVED` for non-approved statuses; seller role alone insufficient.
- GraphQL: `SellerProfile`, `SellerVerification`, enums, `mySellerProfile`, `mySellerVerification`, `pendingSellerVerifications` (cursor pagination, staff-only), mutations as specified. **Never exposes** `legal_name`, `document_storage_key`, or reviewer identity to seller/public.
- Audit rows written for privileged operations with actor/action/target and before/after status where applicable (profile create/update, verification status changes/submission/review).

**State diagram:** `docs-implementation/seller-verification-state-diagram.md` (linked here).

**Verification (local):**
- `pnpm lint` — **OK** (Scope 3 of 4 workspace projects)
- `pnpm -r typecheck` — **OK** (Scope 3 of 4)
- `pnpm -r test` — **OK** (Scope 3 of 4; 5 test files, 19 tests passed in API incl. state/identity/seller/rate-limit; shared 1, web 1)
- `pnpm -r build` — **OK** (logged to `logs/full-build-slice2.log`; api/shared/web completed)
- `bash scripts/test-migrations-roundtrip.sh` — **OK** (includes `1700000000300_seller_profile_verification` up/down/up)

**Open decisions (docs/16, recorded):**
- **§7 #1** Seller verification requirements/thresholds: **OPEN**. State machine implemented; thresholds/doc checks/SLAs not invented (TODOs in code/docs).
- **§7 #2** Professional/business seller document requirements: **OPEN**. `document_storage_key` is placeholder only; **no identity documents stored** (TODO docs/16 §7 #1,#2).
- **§7 #5** Prohibited/restricted items policy: **OPEN** (relevant to review/moderation reasons and future listing controls; not enforced in this slice).
- **§7 #6** Appeals process and whether rejected sellers may re-apply: **OPEN**. `rejected→submitted` gated OFF by default (`SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED=false`, `INVALID_VERIFICATION_TRANSITION`).
- Related: **§7 #7-#10** retention/privacy/legal counsel approvals remain **OPEN**; staff RBAC/permission granularity (`seller.verify`) and reviewer workflows may need refinement per docs/09/10.

**Workstream status:** #2 Seller profile and basic verification workflow — **In progress/completed for Slice 2 scope** (state machine, profile/verification APIs, staff review, guards, tests, migrations). Document collection/storage, thresholds, SLAs, appeals UX, and full moderation tooling remain pending/open decisions.

## Slice 3a — Categories and listing management (workstream 3, partial)

**Migration (reviewed, applied to dev DB):** `apps/api/migrations/1700000000400_catalogue_listings_slice3a.js`
- `categories` (id, parent_id self-FK nullable, name, slug unique, is_active, sort_order, `is_placeholder` boolean default/seeded true, timestamps). Seeded placeholder rows all named **"PLACEHOLDER - NOT APPROVED..."** and `is_placeholder=true` (TODO docs/16 §8 #1: replace with approved taxonomy/attributes).
- `listings` (id, seller_profile_id FK, category_id FK, title, slug, description, `condition` enum `new|like_new|used|for_parts|unspecified`, `fulfilment_option` enum `shipping|local_pickup|both`, currency `char(3)` default CAD, `starting_price_minor bigint > 0`, `requested_starts_at`/`requested_ends_at` nullable draft-intent-only/non-binding, `status` enum `draft|pending_review|published|rejected|paused|removed`, rejection_reason nullable, published_at nullable, timestamps).
- `listing_media` metadata only (id, listing_id FK cascade, `storage_key` placeholder, media_type image-only, alt_text, sort_order, created_at). **No media files stored** (TODO docs/13, docs/16 §5/#8 storage provider/upload/access). **No max media count enforced** (TODO docs/16 §8).
- Indexes: `listings(category_id,status,published_at DESC)`, `listings(seller_profile_id,status,created_at DESC)`, `listing_media(listing_id,sort_order)`.
- Constraints: `CHECK (starting_price_minor > 0)`, `CHECK (ends_at > starts_at)` when both requested times set.
- **Slug uniqueness (documented choice):** globally unique listing slugs (for public URL stability/simplicity).
- Working down migration; verified with roundtrip script.

**Listing state machine:** `apps/api/src/catalogue/listingStateMachine.ts` (single module)
- Allowed: `draft→pending_review`, `pending_review→published|rejected|draft`, `published→paused|removed`, `paused→published|removed`, `rejected→draft`.
- All other transitions throw `INVALID_LISTING_TRANSITION`. Unit tests cover every allowed/disallowed pair.
- Moderation actions beyond approve/reject/pause/remove (reports, user suspension) are **Slice 7** (not implemented).

**Service/operations & GraphQL:** `apps/api/src/catalogue/service.ts`, `apps/api/src/graphql/resolvers/catalogue.ts`, schema/types in `apps/api/src/graphql/schema.ts`
- `categories` (public): active categories only, includes `isPlaceholder` for UI labeling.
- `createListingDraft`: requires verified email (`requireVerified`) AND approved seller (`SELLER_NOT_APPROVED` otherwise), validates fields, status starts `draft`, audit `listing.created`.
- `updateListingDraft(id,input)`: owner only, editable only in `draft|rejected` (rejected revision moves to `draft`), non-owner returns `NOT_FOUND` (no existence leak), other states `LISTING_NOT_EDITABLE`, audit `listing.updated`.
- `submitListingForReview(id)`: owner only, from `draft` only, re-submit while `pending_review` returns clean `VALIDATION_ERROR` (no duplicate), audit `listing.submitted_for_review`.
- `myListings(status,first,after)`: owner-only, cursor paginated.
- `listing(slug)` (public): returns **only `published`** else `NOT_FOUND`; public-safe fields only (title, description, category incl. placeholder flag, condition, fulfilment_option, currency, starting_price_minor, published_at, media **alt text/sort only**). Never exposes seller legal_name/verification details, rejection_reason, storage keys, or owner internal IDs.
- **Validation (implemented, placeholders noted):** title trimmed 3–120 chars (TODO docs/16 §8), description 1–5000 (TODO), category must exist+active, enum checks, currency **CAD only**, `starting_price_minor` positive integer (no floats), `requested_ends_at > requested_starts_at` when both set (UTC). **No future-start check** in 3a (TODO Slice 4/docs/16 §3). No max media count enforced (TODO docs/16 §8).
- Audit rows for create/update/submit with actor/target/before-after status metadata (no seller-private fields beyond required).

**State diagram:** `docs-implementation/listing-state-diagram.md` (linked here).

**Tests (API, Vitest):**
- `apps/api/test/listing-state.test.ts`: listing state machine — allowed/disallowed transitions per state and every pair.
- `apps/api/test/integration-listing.test.ts`: Slice 3a integration cases — categories placeholder flags/labels, unverified create blocked (`EMAIL_NOT_VERIFIED`), non-approved seller blocked (`SELLER_NOT_APPROVED`), create/update/submit flow, non-owner update `NOT_FOUND`, draft/pending visibility `NOT_FOUND` to public `listing(slug)`, submit-twice clean error/no duplicate, `myListings`, validations (non-ASCII trim, non-CAD rejected, float price rejected, requested_ends_at <= requested_starts_at rejected), audit rows for create/update/submit, seeded categories `is_placeholder=true`.

**Verification (local):**
- `pnpm lint` — **OK** (Scope 3 of 4 workspace projects)
- `pnpm -r typecheck` — **OK** (Scope 3 of 4)
- `pnpm -r test` — **OK** (Scope 3 of 4; API includes Slice 3a tests: `test/listing-state.test.ts`, `test/integration-listing.test.ts`; shared/web pass)
- `pnpm -r build` — **OK** (logged `logs/full-build-slice3a.log`; api/shared/web completed)
- `bash scripts/test-migrations-roundtrip.sh` — **OK** (includes `1700000000400_catalogue_listings_slice3a` up/down/up)
- Migration applied to dev DB (`aliauction_dev`, port 5433).

**Open decisions / TODOs (Slice 3a relevant, docs/16):**
- **§8 #1** Approved categories and attributes/taxonomy: **OPEN**. Seeded categories are **PLACEHOLDER - NOT APPROVED** (`is_placeholder=true`); replace via reviewed migration/config when approved.
- **§8 #6** UI/wireframes for listings/catalogue: **OPEN** (no UI implemented).
- **§8 #3** Moderation manual/automated/hybrid: **OPEN**. Slice 3b implemented **manual staff moderation** actions via staff-reviewed GraphQL mutations; automated/hybrid policy, thresholds, queue and SLA decisions remain open (`docs/16` §8 #2 decision pending, §8 #5 SLA).
- **§7 #5** Prohibited/restricted items policy: **OPEN** (needed for moderation/review reasons and listing controls).
- **§3 #1** Auction format/rules: **OPEN** — affects requested schedule semantics/enforcement (Slice 4).
- **§3 #2** Bid input semantics (next bid vs maximum/proxy): **OPEN** — affects future bidding UX/validation (not in 3a).
- **Title/description length limits:** placeholder values (3–120 / 1–5000) — **TODO docs/16 §8**.
- **Media count limit:** **OPEN** (docs/16 §8) — not enforced; `listing_media` metadata-only, storage/upload provider TODO (docs/13, docs/16 §5/#8).
- **Slug uniqueness scope:** implemented as globally unique (documented); revisit if per-seller policy approved.
- Requested start/end remain draft-only/non-binding in 3a; no future-start validation (Slice 4 server-time logic).

## Slice 3b — Listing moderation, audit, public visibility (workstream 3, partial)

**Migration:** No new migration in Slice 3b — `listings.status` enum / `rejection_reason` / `published_at` already introduced in `apps/api/migrations/1700000000400_catalogue_listings_slice3a.js`. No DB changes.

**Service/operations & GraphQL:** `apps/api/src/catalogue/service.ts`, `apps/api/src/graphql/resolvers/catalogue.ts`, schema/types in `apps/api/src/graphql/schema.ts`
- `pendingListingReviews(first, after)`: staff-only (`admin|moderator`, docs/09 moderation concept) cursor-paginated queue over `listings WHERE status='pending_review'`, ordered by `created_at DESC`, minimal cursor (`created_at` ISO of last item), LIMIT clamped 1–100.
- `approveListing(id)`: staff-only; transitions `pending_review → published` via state machine `assertTransition` inside `withTransaction`; sets `published_at=now()` (server UTC) on success; audit `listing.approved` (actor/action/target/before/after; reason null). Invalid transition (e.g. already published) → `INVALID_LISTING_TRANSITION`, audit `listing.transition_rejected` (proposed decision — recorded as such, not settled policy) with attempted action metadata.
- `rejectListing(id, reason)`: staff-only; requires non-empty trimmed reason (`VALIDATION_ERROR` if empty/whitespace); `pending_review → rejected`, sets `rejection_reason`; audit `listing.rejected` with reason; invalid transition audited as `listing.transition_rejected`.
- `pauseListing(id, reason)`: staff-only; requires non-empty trimmed reason; `published → paused`; audit `listing.paused` with reason.
- `resumeListing(id)`: staff-only; `paused → published`; audit `listing.resumed`; sets `published_at=now()`.
- `removeListing(id, reason)`: staff-only; requires non-empty trimmed reason; `published|paused → removed` (terminal); audit `listing.removed` with reason.
- All moderation transactions: `SELECT … FOR UPDATE` on listing row, read current status, validate via `listingStateMachine.assertTransition`, update, single audit write. Concurrent approves serialize on the row lock → exactly one success / one `INVALID_LISTING_TRANSITION`.
- Self-moderation forbidden: moderator cannot act on a listing owned by their own seller profile → `FORBIDDEN` (checked in resolver + service).
- Reviewer identity appears only in `audit_logs` (actor_user_id), never in seller-facing/public responses.
- Seller notification on reject/pause/remove: **implemented in Slice 8 (D2)** — the moderation code paths emit `listing.rejected`/`listing.paused`/`listing.removed` outbox events consumed by the notifications consumer; no inline email.

**Public visibility:** `listing(slug)` returns **published only** (all other statuses incl. draft/pending_review/rejected/paused/removed → same `NOT_FOUND`); public-safe fields only (title, description, category incl. placeholder flag, condition, fulfilment_option, currency, starting_price_minor, published_at, media alt_text/sort only); no storage_key/rejection_reason/moderation fields/legal_name/verification status/internal IDs beyond allowed public fields; `ListingPublic` schema test asserts no private field names.

**Audit decision (recorded, not settled policy):** successful moderation writes exactly one `audit_logs` row (actor, action, target_type `listing`, target_id, before_status, after_status, reason). FORBIDDEN attempts write **no** audit row. Invalid transitions write **one** row with action `listing.transition_rejected` carrying the attempted action — recorded as a **proposed decision** pending moderation policy approval (`docs/16` §8 #2 decision pending).

**Tests (API, Vitest):**
- `apps/api/test/listing-state.test.ts` (Slice 3a) + `apps/api/test/integration-listing.test.ts` — Slice 3b integration cases under `catalogue/listings (Slice 3b) — moderation`: moderator approves pending_review listing; one audit row written; reject without reason → VALIDATION_ERROR; reject with whitespace-only reason → VALIDATION_ERROR; pause requires reason; resume returns to published; remove works from published and from paused; seller cannot call any moderation mutation (FORBIDDEN); buyer cannot call any moderation mutation (FORBIDDEN); moderator cannot moderate own seller listing (FORBIDDEN); concurrent approve of same listing: one success, one INVALID_LISTING_TRANSITION; approve already published listing → INVALID_LISTING_TRANSITION, no duplicate audit row; listing(slug) returns NOT_FOUND for draft/pending_review/rejected/paused/removed; returns data for published; ListingPublic schema contains no private fields; pendingListingReviews is staff-only; two pages have no duplicate IDs; every moderation resolver writes an audit row on success (all resolvers enumerated).

**Verification (local, 2026-11-16):**
- `npx -y pnpm@9.15.4 lint` — **OK**
- `npx -y pnpm@9.15.4 -r typecheck` — **OK**
- `npx -y pnpm@9.15.4 -r test` — **OK** (Scope 3 of 4 workspace projects; API: 7 files, 41 tests passed incl. Slice 3a/3b listing suites; shared/web pass)
- `npx -y pnpm@9.15.4 -r build` — **OK** (logged to `logs/full-build-slice3b.log`; api/shared/web completed)
- `bash scripts/test-migrations-roundtrip.sh` — **OK** (incl. listing migration up/down/up; no new migration)

**Open decisions / TODOs (Slice 3b relevant, docs/16):**
- **§8 #3** Moderation manual/automated/hybrid: **OPEN** — Slice 3b implemented **manual staff moderation** actions only (via staff-reviewed GraphQL mutations); automated/hybrid policy, thresholds, queue and SLA decisions remain open (docs/16 §8 #2 decision pending, §8 #5 SLA).
- **§7 #5** Prohibited/restricted items policy: **OPEN** — reject reasons/approvals must align with approved list later (not invented in 3b).
- **§8 #6** Moderation UI: **OPEN** — no UI implemented (listings UI remains docs/16 §8 #6).
- **§7 #6** Rejection appeal path: **OPEN** — rejected→draft owner revision implemented; formal appeal workflow remains future slice (`docs/16` §7 #6).
- **Slice 8** Seller notifications on reject/pause/remove: **implemented via D2 outbox events** (no inline email in 3b; consumer produces neutral notices).

**Workstream status:** #3 Categories and listing management — **In progress (Slice 3a + Slice 3b completed for requested scope)**. Slice 4a subsequently added auction schema + manual bidding behind an OFF flag (see below); auction close/proxy/snipe/reserve remain pending. Live bidding and real-money payments remain **OFF** by enforced defaults.

## Slice 4a — Auction creation and manual bidding behind flag (workstreams 4 & 5, partial)

**Scope:** auction creation and manual bidding only. **Not implemented:** auction close/winner determination, outbox publisher, proxy bidding, snipe protection, reserve enforcement, real-time events (Slice 4b+).

**Migration (reviewed):** `apps/api/migrations/1700000000500_auctions_bids_slice4a.js`
- `auctions`: id, `listing_id` unique FK listings, `status` enum `scheduled|active|closed_sold|closed_unsold|cancelled` (no `extended`), `currency char(3)` default/CHECK CAD, `starting_price_minor bigint > 0`, `reserve_price_minor bigint` nullable **unused**, `current_price_minor bigint >= 0`, `starts_at`/`ends_at timestamptz` with `CHECK (ends_at > starts_at)`, `winning_bid_id`, `closed_at`, timestamps; index `(status, ends_at DESC)`.
- `bids`: id, auction FK, bidder user FK, `amount_minor bigint > 0`, CAD check, `bid_type` enum `manual` only, `request_id uuid UNIQUE NOT NULL`, `accepted_at` from the injected server clock (DB `now()` default is fallback only), `created_at`; indexes `(auction_id, accepted_at DESC)` and `(auction_id, amount_minor DESC)`. No update/delete path in the service. Accepted-bid outbox payload carries the post-bid snapshot (`currentPriceMinor`, `statusAfter`, `updatedAt`) used for idempotent replay.
- `proxy_bids`: created but **unused** in 4a; unique `(auction_id, bidder_user_id)`.
- `auction_events`: id, auction FK, `from_status` nullable / `to_status` text, `actor_user_id` nullable, `created_at`.
- `outbox_events`: id, `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb`, `created_at`, `published_at` nullable. Written transactionally in 4a; **published in 4b**.
- Working down migration; verified by the roundtrip script (expected list updated to include `1700000000500_auctions_bids_slice4a`).

**State machine:** `apps/api/src/auction/auctionStateMachine.ts` (single module; no resolver writes status)
- Allowed: `scheduled → active` (first accepted bid at/after `starts_at`). Every transition writes one `auction_events` row.
- `active → closed_sold | closed_unsold` **deferred to Slice 4b**; all other pairs throw `INVALID_AUCTION_TRANSITION`.
- Cancel: `canCancel(from, hasBids)` allows only `scheduled` with **no bids** (staff action, reason required by policy). Cancel-after-bids is **OPEN** (TODO docs/16 §3 #9); no cancel mutation is exposed in 4a.
- State diagram: `docs-implementation/auction-state-diagram.md`.

**Service/operations & GraphQL:** `apps/api/src/auction/service.ts`, `apps/api/src/auction/minimumBid.ts`, `apps/api/src/graphql/resolvers/auction.ts`, schema/types in `apps/api/src/graphql/schema.ts`
- `createAuction(listingId, startsAt, endsAt, startingPriceMinor)`: one transaction locks the listing row (`SELECT … FOR UPDATE`), then checks owner of the listing's seller profile only (non-owner → `NOT_FOUND`), listing must be `published` (`LISTING_NOT_PUBLISHED`), one auction per listing (`AUCTION_ALREADY_EXISTS`; unique violation mapped), `startsAt` strictly after injected server clock (`INVALID_SCHEDULE`), `endsAt > startsAt`, integer minor units > 0. Writes one audit row (`auction.created`) and the creation `auction_events` row in one transaction.
- `getAuction(id)` / `auctionForListing(slug)`: public-safe auction fields only (including `startsAt` and paginated accepted bid history); non-published listings → `NOT_FOUND`. No bidder user ids, proxy rows, reserve, or internal fields exposed.
- `placeBid(auctionId, amountMinor, requestId)`: requires verified email and `FEATURE_LIVE_BIDDING_ENABLED` (otherwise `LIVE_BIDDING_DISABLED`; fail-closed unless explicitly enabled by injected config in tests). One transaction reads the clock once, then `SELECT … FOR UPDATE` on the auction; idempotent `request_id` returns the original bid and the auction snapshot captured immediately after that bid, writing nothing new (conflicting reuse → `REQUEST_ID_CONFLICT`); seller cannot bid (`SELLER_CANNOT_BID`); open only if status `scheduled|active` and `starts_at <= server now < ends_at` (`AUCTION_NOT_OPEN`); minimum is starting price for the first bid, else `current_price + increment` (`BID_TOO_LOW`). On success: insert bid, update `current_price_minor`, transition `scheduled→active` via the state machine + event row, insert exactly one `outbox_events` row (`auction.bid.accepted`). The injected clock value is persisted for `accepted_at`, `updated_at`, and the `auction_events`/`outbox_events` `created_at` values. Rejected bids write nothing.
- **Audit decision (documented, Slice 4a):** accepted bids write **no** audit row; the immutable `bids` ledger plus `outbox_events` is the record. Revisit if the audit policy changes.
- `setProxyBid`: always throws `NOT_IMPLEMENTED_PENDING_DECISION` (TODO docs/16 §3 #4).
- GraphQL: `AuctionStatus`, `Money`, `Auction` (public, includes `startsAt` and `bids(first, after)` returning `BidConnection`), `Bid` (amount, acceptedAt, opaque `bidderLabel`; no bidder id), `BidError`, `BidResult`; queries `auction(id)`, `auctionForListing(slug)`; mutations `createAuction`, `placeBid`; `setProxyBid` reserved and throwing. `bidderLabel` = `bidder-<first 16 hex of sha256(userId)>`. Bid history is public (docs/16 §2) and cursor-paginated by `accepted_at` + `id` (limit 1–100).

**Post-verification close-out (G1–G4, 2026-11-16):**
- **G1 done:** service-level `createAuction` tests for `startingPriceMinor` `0`, `-100`, and `12.5` assert `VALIDATION_ERROR` with no auctions row and no `auction.created` audit row; a GraphQL-level test confirms `GraphQLInt` rejects `12.5` before the service runs. The pre-existing GraphQL `0` test is retained.
- **G2 done:** the boundary test asserts the persisted `accepted_at`, activation `auction_events.created_at`, bid `outbox_events.created_at`, and `auctions.updated_at` all equal the injected clock value exactly.
- **G3 done:** a boundary test with an incrementing clock asserts `placeBid` calls the injected clock exactly once and persists that first tick; no service signature change was needed.
- **G4 done:** the `createAuction` unique-violation catch now maps only `auctions_listing_id_key` to `AUCTION_ALREADY_EXISTS`; other `23505` errors rethrow unchanged. No second caller-reachable unique constraint exists in the create path, so the code comment records this instead of an extra test.

**Known limitations (unchanged in Slice 4a):**
- Idempotent replay rebuilds immutable auction fields (`startsAt`, `endsAt`, `listingId`, `currency`, `createdAt`, `winningBidId`, `closedAt`) from the live auction row; only mutable fields (`currentPriceMinor`, `status`, `updatedAt`) come from the outbox snapshot. Harmless in 4a (no close path).
- Money is exposed as GraphQL `Int` / JS `Number`; values above 2^31 (GraphQL Int) or 2^53 (Number) are unsupported in 4a.
- `bidderLabel` is an unsalted sha256 prefix of the user id (linkable across auctions); privacy review remains TODO (docs/16 §7).
- Cancel reason enforcement is not implemented in 4a: `canCancel` gates only status/bids and no cancel mutation is exposed.

**Config/placeholders (NOT FOR PRODUCTION; docs/16 §3):**
- **§3 #1** Auction format: assumed **English ascending only**; not approved.
- **§3 #2** Bid input: placeholder = submitted amount is the **next bid amount**; proxy/maximum input not accepted.
- **§3 #3** Increments: placeholder single `AUCTION_BID_INCREMENT_MINOR`, default `100` minor units (CAD $1.00); no band/category schedule; not hardcoded in the resolver.
- **§3 #4** Proxy tie-breaking: not implemented; `proxy_bids` exists unused; proxy path throws `NOT_IMPLEMENTED_PENDING_DECISION`.
- **§3 #5** Snipe window: disabled; no extension logic; no `extended` status.
- **§3 #6** Extension cap: not implemented (snipe disabled).
- **§3 #7** Reserve: disabled; `reserve_price_minor` nullable and unused.
- **§3 #8** Reserve visibility: not implemented.
- **§3 #9** Cancel after first bid: OPEN; only no-bid `scheduled` cancellation allowed by policy.

**Tests (API, Vitest):**
- `apps/api/test/auction-state.test.ts`: state machine exposes allowed transitions per state, allows every allowed pair, disallows every disallowed pair, cancel only with no bids; minimum-bid calculation for first vs subsequent bids using the placeholder increment (and an injected custom increment).
- `apps/api/test/integration-auction.test.ts` (flag enabled via injected config, injected clock): owner creates auction for own published listing + non-owner `NOT_FOUND`; unpublished listing rejected; `startsAt` not after server now (`INVALID_SCHEDULE`); second create for one listing (`AUCTION_ALREADY_EXISTS`); service-level `startingPriceMinor` `0`/`-100`/`12.5` and GraphQL non-integer rejection (no auction or audit row), `endsAt <= startsAt` (`VALIDATION_ERROR`); two concurrent creates yield exactly one auction; bid before `starts_at` rejected / at `starts_at` accepted (persisted `accepted_at`, activation event, outbox event, and `updated_at` equal injected clock) / at `ends_at` rejected / 1 ms before `ends_at` accepted; incrementing-clock boundary test asserts exactly one clock read per `placeBid`; bid after `ends_at` rejected and writes no bid row; seller cannot bid (`SELLER_CANNOT_BID`); unverified bidder (`EMAIL_NOT_VERIFIED`); below-minimum `BID_TOO_LOW` leaves price/rows unchanged; same `request_id` twice returns the original bid and post-bid auction snapshot with unchanged bid/outbox/event counts even after a later bid; different `request_id` same amount creates a new bid; 20 parallel distinct bids record exactly the accepted bids with `current_price_minor = max accepted` (no lost update); accepted bid writes exactly one outbox row and a forced post-insert failure rolls it back; GraphQL `placeBid` success uses `config.auction.bidIncrementMinor`; flag OFF returns `LIVE_BIDDING_DISABLED` and writes nothing; GraphQL `setProxyBid` returns `NOT_IMPLEMENTED_PENDING_DECISION`; public queries never expose bidder user ids or proxy rows; public auction queries return `startsAt` and cursor-paginated `Auction.bids`; paused/removed listings return `NOT_FOUND`.

**Verification (local, 2026-11-16):**
- `npx -y pnpm@9.15.4 lint` — **OK** (`Scope: 3 of 4 workspace projects`; api/web/shared Done)
- `npx -y pnpm@9.15.4 -r typecheck` — **OK** (`Scope: 3 of 4`)
- `npx -y pnpm@9.15.4 -r test -- --reporter=verbose` — **OK** (Scope 3 of 4; API **9 files / 75 tests passed**, incl. 2 Slice 4a files / 34 tests; shared/web pass)
- `npx -y pnpm@9.15.4 -r build` — **OK** (logged to `logs/full-build-slice4a.log`; api/shared/web Done)
- `bash scripts/test-migrations-roundtrip.sh` — **OK** (`[migrations] roundtrip OK`; includes `1700000000500_auctions_bids_slice4a` up/down/up)
- Migration applied to dev DB (`aliauction_dev`, port 5433).

**Workstream status:** #4 Timed auction engine and #5 Manual bidding — **partial** (Slice 4a close/publisher added in 4b). Live bidding is **code-complete behind `FEATURE_LIVE_BIDDING_ENABLED` but enabled for no user**; the flag stays OFF by default and is asserted OFF at production startup. Proxy bidding, snipe protection, reserve enforcement, and real-time events remain pending. **Stopped before Slice 4b at this checkpoint; see 4b section below.**

## Slice 4b — Auction close job and outbox publisher (workstreams 4 & 5, partial)

**Scope:** server-authoritative single-auction close, due-auction close job, and transactional-outbox publisher. **Not implemented:** orders/payments/payouts (Slice 6+), proxy bidding, snipe protection, reserve enforcement, real-time/Socket.io events, production scheduler, GraphQL close/publish mutations (job + callable functions only). No new migration was needed; `1700000000500` already provides `winning_bid_id`, `closed_at`, `published_at`, and audit columns.

**Decisions (proposed placeholders, NOT FOR PRODUCTION; every item remains OPEN in docs/16 §3):**
- **D1 Outcome:** with accepted bids, close `closed_sold` and set `winning_bid_id` to the highest `amount_minor`; with no bids, close `closed_unsold`. Because each accepted bid must exceed the current price by a strictly positive increment, two accepted bids cannot tie on amount, so no tie-break is needed in 4b. Proxy tie-breaking stays OPEN (docs/16 §3 #4). Implemented in `determineAuctionOutcome` (`apps/api/src/auction/service.ts`) and `closeAuction`.
- **D2 Expired without activation:** a `scheduled` auction past `ends_at` has no bids (a bid would have moved it to `active`); allow `scheduled → closed_unsold` for this case only. Added to `auctionStateMachine.ts` ALLOWED set and unit-tested; proposed placeholder citing docs/16 §3.
- **D3 Reserve:** disabled; `reserve_price_minor` is never read when closing (TODO docs/16 §3 #7, §3 #8).
- **D4 Order intent:** no orders table in 4b (Slice 6). Each close writes exactly one `outbox_events` row with `event_type='auction.closed'` and payload `{ auctionId, status, winningBidId, winningAmountMinor, winnerBidderLabel }` — a public label, not a user id. Slice 6 will consume this event to create the order.
- **D5 Close trigger:** `closeDueAuctions(opts)` closes all auctions with `ends_at <= now` and status `scheduled|active`, each in its own transaction, returning `{ closed, skipped, failed, errors }`. Exposed through `apps/api/src/auction/closeJob.ts` and `pnpm --filter @aliauction/api auction:close-due`. No production scheduler is added: scheduling (cron/worker) is a deployment decision (TODO docs/16 §10 / docs/13).
- **D6 Publisher:** `publishOutbox(sink, opts)` reads unpublished rows in `created_at, id` order, marks each `published_at` only after the sink succeeds, and stops the batch on failure. Sinks in 4b: `InMemoryOutboxSink` (tests) and `consoleSink` (dev). Real-time delivery is a TODO for workstream 11 / docs/03 §5; no Socket.io or external broker.
- **D7 Audit:** each close writes one `audit_logs` row with `actor_user_id NULL`, `action='auction.closed'`, `target_type='auction'`, `target_id`, `reason='system_close'`, and `metadata { beforeStatus, afterStatus }`. System actions use a NULL actor.

**Operations:** `closeAuction(auctionId, opts)` locks the auction row with `SELECT … FOR UPDATE`, re-reads status, returns the existing outcome and writes nothing if already closed, throws `AUCTION_NOT_DUE` before `ends_at`, then (in one transaction) determines the outcome, asserts the state-machine transition, updates `status`/`winning_bid_id`/`closed_at`/`updated_at`, and inserts the event, audit, and outbox rows. All timestamps are bound to the injected clock; no SQL `now()` or `Date.now()` is used in 4b code. Re-running a close is a no-op; a forced in-transaction failure rolls back all close writes. `placeBid` still rejects at/after `ends_at` with `AUCTION_NOT_OPEN`.

**Tests (API, Vitest):**
- `apps/api/test/auction-state.test.ts`: every allowed/disallowed pair including `scheduled → closed_unsold`, `active → closed_sold`, `active → closed_unsold`; outcome function for no bids, one bid, several bids (highest wins), and bigint-string max bid id.
- `apps/api/test/integration-auction-close.test.ts`: `AUCTION_NOT_DUE` before `ends_at` writes nothing; boundary at/1 ms before `ends_at`; active close writes one close event/audit/outbox row with injected `closed_at` and highest bid; no-bid and expired-scheduled close to `closed_unsold`; idempotent second close; forced post-status-update rollback; post-close bid rejected `AUCTION_NOT_OPEN`; parallel place/close race; `closeDueAuctions` counts, second run, and per-auction failure isolation; publisher success/idempotency, failure/retry ordering; source grep for `SQL now()`/`Date.now()`.

**Known TODOs:** real-time delivery (workstream 11, docs/03 §5); production scheduler (docs/16 §10 / docs/13); order consumer in Slice 6 (D4); reserve (docs/16 §3 #7/#8); proxy bidding and tie-breaking (docs/16 §3 #4); snipe protection/extensions (docs/16 §3 #5/#6). **Publisher concurrency:** `publishOutbox` has no row lock, so two concurrent publishers can deliver the same row twice before one marks it published; a later slice should use `SELECT … FOR UPDATE SKIP LOCKED` in the batch read (docs/03 §5).

**Status:** workstreams 4 and 5 remain **partial**; no Slice 5 work started.

## Slice 5 — Category browse and PostgreSQL FTS search (workstream 6, partial)

**Scope:** public, published-only category browse and keyword search over listings. No Elasticsearch (PostgreSQL FTS for MVP: docs/11 §5); PostgreSQL is the source of truth and the GIN index is a derived projection (docs/03 §1, §7). No new mutations. **Not implemented:** search/browse UI (workstream 11, docs/16 §8 #10), expiry filter, approved categories/attributes, proxy/snipe/reserve, orders/payments.

**Migration (reviewed, applied to dev DB):** `apps/api/migrations/1700000000600_listings_search_slice5.js`
- Generated `listings.search_vector` tsvector column: `setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', description), 'B')`. Placeholder: `'simple'` config and the title/description field set are **NOT FOR PRODUCTION** (TODO docs/16 §8).
- GIN index on `search_vector`; partial index `listings (category_id, published_at DESC, id DESC) WHERE status = 'published'`. Working down migration (indexes then column, reverse order). Migration roundtrip script expected list updated with `1700000000600`.

**Operations (`apps/api/src/catalogue/search.ts`):**
- `searchListings(input)`: trims query (max length `config.search.maxQueryLength`, default 200, TODO docs/16 §8); sorts `NEWEST | PRICE_ASC | PRICE_DESC | RELEVANCE` (only RELEVANCE uses `ts_rank`); optional category slug, condition, fulfilment filters; keyset pagination `first` 1–100 (default 20), opaque validated cursor; **only `status='published'` with non-null `published_at`**; all SQL uses parameter binding; no `now()`/`Date.now()`.
- `listPublishedByCategory(slug, input)`: thin wrapper with category filter; unknown/inactive slug → `NOT_FOUND`.
- `noResultsReason` codes: `NONE` (items exist), `NO_MATCHES` (query/filter returned nothing in a non-empty category/global search), `CATEGORY_EMPTY` (category has no published listings at all).
- Public result reuses `PublicListing` type: title, description, category, condition, fulfilment_option, currency, starting_price_minor, published_at, media alt text only. No seller legal name, verification status, rejection reason, reviewer, storage keys, or seller internal IDs.

**Config (`apps/api/src/config.ts`):** `config.search.maxQueryLength` (env `SEARCH_MAX_QUERY_LENGTH`, default 200, TODO docs/16 §8), `defaultPageSize=20`, `maxPageSize=100`.

**GraphQL:** added queries `searchListings(input: SearchListingsInput!)` and `categoryListings(slug: String!, input: CategoryListingsInput)`; `SearchResult` type with `items`, `endCursor`, `hasMore`, `noResultsReason`; enums `SearchSort`, `NoResultsReason`; reused `ListingCondition` / `ListingFulfilmentOption` enums and `PublicListing` type. **No mutations added.**

**State diagram:** `docs-implementation/search-state-diagram.md` (query flow, sort keys, cursor format, reason codes).

**Tests (API, Vitest):**
- `apps/api/test/search-cursor.test.ts`: cursor encode/decode round-trips for each sort; malformed/tampered/wrong-sort cursor → `VALIDATION_ERROR`; over-length query → `VALIDATION_ERROR`; empty/whitespace query treated as no query.
- `apps/api/test/integration-search.test.ts`: unpublished states never returned; published hit / `NO_MATCHES`; `CATEGORY_EMPTY`; unknown/inactive category → `NOT_FOUND`; NEWEST/price sort and id tie-breaks; RELEVANCE title > description; condition/fulfilment filters; full keyset walk (no duplicates); cursor stability when a new listing is published between pages; paused listing absent on next page; public-field schema introspection + runtime check; source grep for `now()`/`Date.now()`; GraphQL query smoke test.

**Placeholders / TODOs (NOT FOR PRODUCTION, docs/16 §8):**
- `to_tsvector('simple', …)` avoids a language assumption; approved text-search configuration is OPEN (docs/16 §8).
- Search field set is title (A) + description (B); attributes/fields are OPEN (docs/16 §8 #1).
- Query length limit (default 200) and page-size limits are config placeholders; approved limits are OPEN (docs/16 §8).
- **Known limitation:** no "expired" listing status exists in the schema, so no expiry filter is implemented (docs/16 §8 open).
- Approved categories/attributes remain PLACEHOLDER (docs/16 §8 #1); UI/wireframes remain OPEN (docs/16 §8 #10).

**Status:** workstream 6 — **partial** (API/search complete, UI not built). No Slice 6 work started.

## Slice 6 — Checkout, sandbox payments, orders and fulfilment (workstreams 7 & 8, partial)

**Scope:** orders created from `auction.closed` outbox events, server-computed totals, a fake payment provider, signed sandbox webhooks, manual fulfilment and internal refunds. **All money-moving paths are behind `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` (default OFF, asserted OFF at production startup).** No Stripe/PayPal adapters, live payments, escrow, payouts, provider refunds, carrier APIs, real-time events, proxy/snipe/reserve or Elasticsearch. **Sandbox only.**

**Migration (reviewed, applied to dev DB):** `apps/api/migrations/1700000000700_orders_payments_slice6.js` — `fee_rules` (seed 800 bps buyer fee placeholder), `orders`, `order_fee_lines`, `order_events`, `processed_events` (unique consumer/event_id), `payment_transactions` (partial unique provider/provider_payment_id), `webhook_events` (unique provider/event), `refunds`, `shipments`; CHECK constraints and partial index via createTable/createIndex options; working down migration. Roundtrip expected list updated with `1700000000700`.

**Decisions (proposed placeholders; all OPEN in docs/16 §4/§5/§6):**
- **D1 Flags (docs/16 §5):** `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` defaults OFF; when OFF `createCheckout`, webhook state changes and `refundPayment` return `REAL_MONEY_DISABLED` and write nothing. Fake adapter only reachable via injected test config. `assertSafeFeatureFlags()` plus new `assertMoneyFlagsOffForProduction()` run at startup.
- **D2 Order creation (docs/07 §8):** `consumeAuctionClosedEvents` reads unprocessed `auction.closed` outbox rows in `created_at,id` order; `closed_sold` creates one `awaiting_payment` order (unique on `auction_id`), buyer from winning bid (internal only), seller profile from listing, fee snapshot; `closed_unsold` creates nothing; `processed_events(consumer='orders',event_id)` recorded in the same transaction — replay creates no second order.
- **D3 Fees (docs/16 §4 #1–#4):** `fee_rules` 800 bps (8%) buyer fee from source plan, **NOT APPROVED**; `calculateFeeMinor` uses integer round-half-up `(subtotal*bps+5000)/10000`; snapshot written once to `order_fee_lines`, never recalculated. Payer/base/tax OPEN; buyer-facing payer is a placeholder.
- **D4 Checkout (docs/16 §5):** `createCheckout(orderId, acceptedTotalMinor, fulfilmentChoice, requestId)` — buyer-only (else `NOT_FOUND`); client total compared to server total (`TOTAL_MISMATCH` on mismatch, no writes); idempotent `requestId`; creates one `payment_transactions` row in `created` status; order stays `awaiting_payment`.
- **D5 Provider (docs/16 §5):** interface `PaymentProvider { createPaymentIntent, verifyWebhook }`; only `FakePaymentProvider` implemented (HMAC-SHA256 over raw body in `x-fake-signature`, secret `config.payments.fakeWebhookSecret`, placeholder). Webhook `POST /webhooks/payments/fake` mounted with `express.raw` before `express.json`; invalid signature → 401 `INVALID_SIGNATURE` with no writes; `webhook_events` dedupe by `(provider,provider_event_id)`; processing in one transaction.
- **D6 Payment state (docs/16 §5):** `payment.succeeded` → payment `captured`, order `paid`; `payment.failed` → payment `failed`, order unchanged; unknown payment stored unprocessed (`processed_at NULL`); no redirect endpoint changes state (test asserts success query string does nothing).
- **D7 Fulfilment (docs/16 §6):** manual only; seller records `start_processing`, `mark_shipped` (carrier/tracking), `ready_for_pickup`; buyer or seller confirms `complete`; manual `shipments` rows, no carrier API.
- **D8 Refunds (docs/16 §5 #8 OPEN):** `refundPayment` staff-only and behind the flag; amount >0 and ≤ captured − prior refunds; reason required; internal `refunds` row with actor/reason; fake provider only, nothing sent externally.
- **D9 Access / privacy (docs/10 §5):** buyers only own orders, sellers only their profile's orders, staff all; non-participant → `NOT_FOUND`; `shipping_address_snapshot` returned only to buyer/seller; participant GraphQL types expose no provider IDs, webhook payloads, staff notes or other-party user IDs.

**State machines:** `apps/api/src/orders/orderStateMachine.ts` and `apps/api/src/payments/paymentStateMachine.ts`; every order transition writes `order_events`; payment transitions write `audit_logs`. Resolvers and consumer never write status directly.

**Operations / API:** `consumeAuctionClosedEvents`, `createCheckout`, `handleWebhook`, `recordFulfilment`, `refundPayment`, `getMyOrders`, `getOrder`, `sellerOrders`, `ordersAll` (cursor pagination 1–100). GraphQL queries `myOrders`, `order`, `sellerOrders`, `ordersAll`; mutations `createCheckout`, `recordFulfilment`, `refundPayment`; HTTP webhook endpoint (not GraphQL). All timestamps from the injected clock; no SQL `now()`/`Date.now()` in new source.

**State diagram:** `docs-implementation/orders-payments-state-diagram.md`.

**Tests (API, Vitest):** `apps/api/test/order-payment-state.test.ts`, `apps/api/test/fee-calculation.test.ts`, `apps/api/test/integration-orders.test.ts` (names in report). 18 unit + 18 integration tests pass.

**Known limitations / TODOs (NOT FOR PRODUCTION, docs/16 §4, §5, §6):** no real payment provider (fake only), no capture at real providers, no escrow/payouts, no refunds to providers, no shipping rates or tax, no carrier integrations, no seller KYC/onboarding. Fee payer/base/tax, capture timing, provider selection, shipping obligations and refund policy remain OPEN.

**Status:** workstreams 7 and 8 — **partial** (sandbox-only development complete; no real provider/carrier). Slice 7 not started.

## Slice 7 — Reports, staff moderation queue, suspension and audit coverage (workstream 9, partial)

**Scope:** FR-070/071/073/074; US-H01/H02/J01. User reporting of listings/users, a staff-only manual moderation queue, report resolution, user suspension/reinstatement, the suspended-account auth gate, and audit coverage for every privileged mutation. **Not implemented (by design):** notifications (Slice 8), UI/PWA (Slice 9), real payment providers, Elasticsearch, proxy bidding, snipe, reserve enforcement, real-time events, appeal workflow, automated moderation, or any change to `docs/16`. No applied migration was modified; no listing columns were changed.

**Migration (reviewed):** `apps/api/migrations/1700000000800_reports_moderation_slice7.js`
- `reports`: id, `reporter_user_id` FK users (internal only), `target_type` enum (`listing`,`user`), `target_id`, `category` enum (D1), `details` nullable text (placeholder max 2000), `status` enum (`open`,`actioned`,`dismissed`), `resolved_by_user_id` FK users nullable, `resolution_reason`, `resolved_at`, timestamps. `target_id` is an untyped uuid: no FK to listings/users (target may be either type).
- Partial unique index `reports_open_dedup_uq` on `(reporter_user_id, target_type, target_id) WHERE status = 'open'` (D4). Queue index `reports_queue_idx` on `(status, created_at, id)` (D5). Constraints via `createTable` options; working down migration drops indexes, then table, then enums in reverse order. Roundtrip expected list updated with `1700000000800`.

**State machines:** `apps/api/src/accounts/accountStateMachine.ts` (`active → suspended`, `suspended → active`; all other pairs throw `INVALID_ACCOUNT_TRANSITION`) and `apps/api/src/reports/reportStateMachine.ts` (`open → actioned|dismissed`; all other pairs throw `INVALID_REPORT_TRANSITION`). The listing state machine is reused unchanged. Resolvers never write status directly. `docs-implementation/moderation-state-diagram.md` documents both flows and the permission matrix.

**Decisions (proposed placeholders citing docs/16; NOT FOR PRODUCTION where noted):**
- **D1 Report categories:** `reports.category` enum `prohibited_item | counterfeit | misleading_listing | harassment | spam | other`. Placeholder list, **NOT FOR PRODUCTION**, TODO `docs/16 §7 #5`.
- **D2 Who may report:** active + email-verified users only; a user cannot report their own listing or themselves. Unverified → `EMAIL_NOT_VERIFIED`; suspended → `ACCOUNT_SUSPENDED`; denied calls write nothing.
- **D3 Storage & privacy:** `reporter_user_id` is stored internally; `ReportStaffType` (staff-only) is the only type with `reporterUserId`. Reporter-facing `ReportReceipt` has no identity/reported-party fields. No seller-facing or public response exposes reporter identity.
- **D4 Deduplication:** at most one open report per `(reporter_user_id, target_type, target_id)`, enforced by partial unique index + `ON CONFLICT DO NOTHING`. A duplicate returns the existing id and writes no new report/audit row.
- **D5 Queue:** `pendingReports(first, after)` lists open reports, cursor `(created_at, id)`, limit 1–100; staff roles `moderator|admin|support` only. `reportForStaff(id)` is staff-only.
- **D6 Permission matrix (`docs/09`):** moderator/admin may resolve reports, suspend/reinstate, hide/remove/approve/reject/pause/resume listings; support may read the queue and reports only; buyer/seller have no staff permission. Every denial is `FORBIDDEN` with no audit row; role checked in resolver and service.
- **D7 Hide listing:** `resolveReport(action=hide_listing)` calls the existing `pauseListing` (published → paused via listing state machine) with a required reason inside the resolution transaction. It does not delete. Writes one listing audit row plus one report audit row.
- **D8 Suspension:** `suspendUser(userId, reason)` moves `active → suspended` via `accountStateMachine.ts`, revokes all sessions in the same transaction, and writes one audit row. `requireVerified` (and therefore `placeBid`, `createCheckout`, `createListingDraft`) rejects suspended accounts with `ACCOUNT_SUSPENDED`. Already-suspended → `INVALID_ACCOUNT_TRANSITION`, writes nothing. **Suspension while bidding is OPEN — placeholder citing `docs/16 §3 #14`.** No new policy invented.
- **D9 Reinstatement:** `reinstateUser(userId, reason)` moves `suspended → active`, reason required, one audit row. Sessions are not restored; the user logs in again. **Appeal workflow is OPEN — placeholder citing `docs/16 §7 #6`.**
- **D10 Resolution:** `resolveReport(reportId, decision, reason, action)` with `decision = actioned|dismissed`, `action = none|hide_listing|suspend_user`; reason required; `actioned` takes a target action in the same transaction or `none` (no_action_needed). Sets `resolved_by`, `resolved_at`, `status`, `resolution_reason`, one audit row. A second resolution → `INVALID_REPORT_TRANSITION`, writes nothing. `hide_listing` is listing-only; `suspend_user` is user-only (mismatch → `VALIDATION_ERROR`).
- **D11 Audit coverage:** every privileged mutation writes exactly one audit row on success (actor, action, target type/id, before/after status metadata, reason); denied calls write none. `audit_logs` has no update/delete path — a source-guard test asserts no `UPDATE audit_logs` / `DELETE FROM audit_logs` anywhere in `apps/api/src`. A test enumerates all ten privileged mutations by name.
- **D12 Notifications:** none sent inline in Slice 7. Seller/reporter notices are produced in Slice 8 by the outbox consumer (D2); no inline email.

**Operations / GraphQL:** mutations `reportListing`, `reportUser`, `resolveReport`, `suspendUser`, `reinstateUser`; queries `pendingReports`, `reportForStaff`. Types `ReportStaffType` (reporter id + internal status, staff only), `ReportReceipt` (minimal, reporter-facing), `ReportConnection`, `AccountStatusResult`, enums `ReportCategory`/`ReportTargetType`/`ReportStatus`/`ReportDecision`/`ModerationAction`. No query or mutation exposes `audit_logs` rows. All timestamps come from the injected clock; no SQL clock functions or `Date.now()` in new source.

**Tests (API, Vitest):** `account-state.test.ts` (every allowed/disallowed account pair), `report-state.test.ts` (every allowed/disallowed report pair), `permission-matrix.test.ts` (moderator/admin/support/buyer/seller × each privileged operation, role check only), `integration-reports.test.ts` (injected clock/config: unverified/self-report denials, dedup, reporter-privacy schema + runtime, staff-only queue, support read-only, hide-via-report audit rows, suspension + session revocation, suspended-account gate on all three protected mutations, double-suspend, reinstatement, double-resolution, action/target mismatch, denied-call audit counts, all ten privileged mutations audited), `source-guard.test.ts` (append-only audit grep + clock grep).

**Verification (local):** see final report in this session's handover for command exit codes and full test-name list. Build logged to `logs/full-build-slice7.log`. Migration roundtrip script expected to fail locally with `psql not found` (no PostgreSQL client in this environment); `1700000000800` added to the expected list only.

**Open decisions / placeholders (NOT invented; recorded above with docs/16 references):** §3 #14 suspension while bidding (D8), §7 #5 prohibited/restricted items and report categories (D1), §7 #6 appeals (D9), §8 #3 manual moderation only (D10/D11). Notifications Slice 8; UI/PWA Slice 9.

**Workstream status:** #9 Admin moderation and audit trail — **partial** (API-only reports, manual moderation, suspension and audit coverage). No UI, no appeal workflow, no notifications. Slice 8 not started.

## Slice 8 — Notifications from the outbox (workstream 10, partial)

**Scope:** US-I01 / Epic I. Notifications are produced by an idempotent outbox consumer from committed events, never inline in request handlers. **Not implemented:** real email/SMS/push providers (docs/11 §6), Socket.io/real-time delivery (docs/03 §5), UI/preferences screens and PWA (Slice 9), proxy bidding, snipe, reserve enforcement, or any new order/payment behaviour. `docs/16` unchanged; no applied migration modified.

**Migration (reviewed):** `apps/api/migrations/1700000000900_notifications_slice8.js`
- `notifications`: id, `user_id` FK users (cascade), `category` enum, title, body, `resource_type`/`resource_id` nullable, `source_event_id` (outbox event id), `created_at` (injected clock), `read_at` nullable; unique `(user_id, source_event_id, category)` so one event yields at most one notification per recipient/category.
- `notification_preferences`: PK `(user_id, category, channel)`, `enabled` boolean. `notification_deliveries`: id, `notification_id` FK (cascade), `channel`, `status` enum (`pending`,`sent`,`failed`), `attempts`, `last_error_category` (fixed category only, no raw text), `sent_at`, timestamps; unique `(notification_id, channel)`.
- Indexes `notifications(user_id, created_at DESC, id DESC)` and partial `notifications(user_id) WHERE read_at IS NULL`. Constraints via `createTable` options; working down migration in reverse order. Roundtrip expected list updated with `1700000000900`.

**Decisions (proposed placeholders; NOT FOR PRODUCTION where noted):**
- **D1 Consumer framework:** generic `consumeOutbox(consumerName, handler, opts)` in `apps/api/src/outbox/consumer.ts` reads unprocessed rows in `created_at, id` order in batches; `processed_events` marker and handler writes share one transaction; a handler failure leaves the row unprocessed and stops the batch; replays are no-ops. Reuses the Slice 6 `processed_events` table.
- **D2 Notification producer:** consumer `notifications` (`apps/api/src/notifications/consumer.ts`) maps committed events to notification rows. Handled: `auction.bid.accepted` (seller + previous high bidder, opaque labels only), `auction.closed` (winner + seller on `closed_sold`, seller only on `closed_unsold`), `order.created` (buyer), `order.paid` (seller), `order.shipped`/`order.ready_for_pickup` (buyer), `listing.rejected`/`listing.paused`/`listing.removed` (seller), `account.suspended` (affected user, neutral text), `report.resolved` (reporter gets outcome category only, never target identity; reported party gets a neutral notice only when an action was taken). Missing event writes were added to the existing transition paths in the same transaction (orders, payments, catalogue, accounts, reports), each marked `Slice 8 (D2)`. No new business behaviour.
- **D3 Preferences:** `notification_preferences` per user/category/channel; transactional categories are always delivered and cannot be disabled (placeholder list pending docs/16 §7 #3 review). Marketing and watch-style categories are opt-in default OFF; no marketing message is produced in this slice.
- **D4 Delivery:** `notification_deliveries` with attempts/status/last-error-category/sent_at (injected clock). `deliverPending(sinks, opts)` uses a `NotificationSink` interface; sinks: `InAppSink` (the notification row is the in-app delivery) and `ConsoleEmailSink` (wraps the existing dev-console provider). Failures increment attempts, store only a fixed error category, and retry until the configured cap (placeholder default 5).
- **D5 Authenticated links:** notification data carries only resource IDs; the GraphQL `Notification.link` is a relative path resolved for the authenticated owner. No unauthenticated link exists.
- **D6 Read state:** `markNotificationRead(id)` is owner-only (others get `NOT_FOUND`) and idempotent; `read_at` set once from the injected clock.
- **D7 Queries:** `myNotifications(first, after, unreadOnly)` cursor-paginated by `created_at, id` (limit 1–100) and `unreadCount`, both scoped to the authenticated caller.
- **D8 Gaps closed:** the former 3b (seller notice on reject/pause/remove), Slice 6 (order/payment notices) and Slice 7 (reporter/reported-party notices) TODOs now point to D2; the events are emitted and the consumer produces the notices. Source and status-doc TODO markers removed.
- **Templates (all NOT FOR PRODUCTION, pending copy review; docs/16 §8 #6, §7 #3):** neutral copy only. `New bid on your auction` / `You were outbid` (auction), `You won an auction` / `Your auction closed` (auction result), `Order created`, `Order paid`, `Order shipped`, `Order ready for pickup`, `Listing update`, `Account update`, `Report outcome`, `Report resolved`. No template contains a reporter id, provider id, payment detail, or staff moderation reason (unit grep + runtime tests).

**Operations / GraphQL:** `consumeOutbox`, `consumeNotifications`, `handleNotificationEvent`, `deliverPending`, `myNotifications`, `unreadCount`, `markNotificationRead`. Queries `myNotifications`, `unreadCount`; mutation `markNotificationRead`; type `Notification` (id, category, title, body, createdAt, readAt, resourceType, resourceId, link) — no `source_event_id`, delivery status, or other user's data. No query or mutation exposes delivery internals. All timestamps from the injected clock; no SQL clock functions or `Date.now()` in new source.

**State diagram:** `docs-implementation/notifications-state-diagram.md` (event-to-category mapping, consumer flow, delivery retry flow).

**Tests (API, Vitest):** `notification-mapping.test.ts` (every D2 event maps to the expected category/recipients, no recipient outside spec, template safety grep + runtime, placeholder category list), `source-guard-notifications.test.ts` (clock discipline, former TODO markers gone, D2 pointers present), `integration-notifications.test.ts` (consumer idempotency/failure, outbid notices, replay, auction close sold/unsold, listing moderation notices, order/payment/fulfilment notices, suspension notice, report-resolution notices, transactional preferences, sink retry cap and sent_at, owner scoping, read marking, unreadCount, Notification schema/runtime privacy).

**Known limitations:** no real provider (docs/11 §6), no SMS or push, no marketing category, no real-time delivery (docs/03 §5), no UI/preferences screens (Slice 9). Copy is neutral placeholder text pending review (docs/16 §8 #6). Consumer has no dead-letter queue/operator visibility beyond failed delivery rows (docs/03 §6).

**Workstream status:** #10 Notifications — **partial** (outbox consumer, in-app + console delivery). Slice 9 not started.

## Slice 9 — Responsive web, PWA, security headers, real-time fallback (workstream 11, partial)

**Scope:** Phase 1 workstream 11. Scaffold-level public, auth, buyer and seller routes, mobile-first Tailwind layout, data-driven screen states, server-offset auction countdown, text-based bid status, PWA manifest/service worker/offline page, and security headers. **Not implemented:** Socket.io server/gateway or real-time delivery (docs/03 §5), native mobile app, admin/staff screens (deferred, docs/09), real email/payment providers, Elasticsearch, proxy/snipe/reserve, new API business rules, or visual design. `docs/16` and all applied migrations unchanged. Copy and visual design are placeholders pending review (docs/16 §8 #6); every placeholder string carries the comment `PLACEHOLDER COPY (docs/16 §8 #6)`.

**Minimal API addition:** `serverTime: DateTime!` on the `Query` type (`apps/api/src/graphql/resolvers/system.ts`, `apps/api/src/graphql/schema.ts`), resolved from an injectable context clock (`serverClock` in `GraphQLContext`) and serialized as an ISO-8601 instant. No mutations changed; no business rules added. Integration test asserts the injected clock value.

**Decisions (proposed placeholders):**
- **D1 Routes:** implemented public/auth/buyer/seller routes in `apps/web/src/app`: `/`, `/categories/[slug]`, `/search`, `/listings/[slug]`, `/auth/{register,login,verify-email,forgot-password,reset-password}`, `/account`, `/buyer/bids`, `/buyer/orders`, `/buyer/orders/[orderId]`, `/buyer/notifications`, `/seller/onboarding`, `/seller/dashboard`, `/seller/listings`, `/seller/listings/new`, `/seller/listings/[listingId]/edit`, `/seller/orders`. **Admin routes `/admin/*` are DEFERRED** (docs/09: separate admin navigation, explicit role permissions, MFA) — no admin screens in this slice.
- **D2 Screen states:** `apps/web/src/components/ScreenState.tsx` + `apps/web/src/lib/states.ts` provide loading, empty, error, permission-denied, stale and offline states; error copy is mapped from stable API codes (`apps/web/src/lib/errors.ts`), raw server text is never rendered.
- **D3 Auction UI:** `apps/web/src/components/AuctionPanel.tsx` shows price, bid count, server-provided end time and a countdown computed as `endsAt - (clientNow + serverOffset)` (`apps/web/src/lib/countdown.ts`, one clock read). Bid form shows "Submitted, waiting for confirmation" until `accepted: true`; rejected bids map stable codes to neutral copy; bid history shows `bidderLabel` only.
- **D4 Real-time flag:** `FEATURE_REALTIME_UI` (`NEXT_PUBLIC_FEATURE_REALTIME_UI`, default OFF) is a web config value, not a user toggle. OFF: refetch on focus, every 15 s (NOT FOR PRODUCTION placeholder) and after a bid. ON: no gateway exists, so it logs a TODO and uses the same refetch fallback (`apps/web/src/lib/realtime.ts`). Real-time delivery is docs/03 §5 and a later slice.
- **D5 Auth UI:** `apps/web/src/components/AuthForm.tsx` calls existing register/login/verifyEmail/requestPasswordReset/resetPassword/resendVerification mutations with credentials included; the UI only reads `me` and never stores a token. Forgot/resend show a neutral response regardless of account existence (enumeration-safe). Tokens are entered in a labelled field, not placed in URLs.
- **D6 Accessibility:** semantic landmarks, labelled controls, visible focus, 44 px touch targets, reduced-motion support, text-not-colour status and skip link. axe-core was added as a web devDependency; a full browser-based axe run is not part of node:test here, so an automated static check of landmarks/labels on the key pages is used (`apps/web/test/accessibility-static.test.mjs`) and the browser-based axe/Lighthouse result is recorded separately.
- **D7 Responsive layout:** mobile-first Tailwind utilities plus custom CSS; bidding controls usable at 320 px; tables become stacked cards below `md`.
- **D8 PWA:** `apps/web/public/manifest.webmanifest` (name AliAuction.ca, short_name AliAuction, start_url/scope `/`, standalone, placeholder colours/icons marked for design review). `apps/web/public/sw.js` caches only the shell, static build assets and public category/listing/search pages with a 5-minute NOT FOR PRODUCTION TTL; it never caches `/graphql`, credentialed/cookie responses, or `/auth`, `/account`, `/buyer`, `/seller`, `/admin`. Offline page at `/offline` shows neutral copy with no account data.
- **D9 Security headers:** `apps/web/next.config.ts` exports `securityHeadersFor(env, origin)` — CSP (`default-src 'self'`, script/connect/img/style restricted, `frame-ancestors 'none'`), HSTS only in production, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, minimal `Permissions-Policy`. Applied to all routes via `headers()`. `script-src` includes `'unsafe-inline'` as a placeholder required by Next.js inline bootstrap scripts; a nonce-based CSP is pending review (docs/16 §8 #6).
- **D10 Frontend privacy:** no analytics, no personal data in URLs/query strings, no sensitive values in forms' URLs, no browser logging of personal data. No secrets in `apps/web` source or bundle config (grep test).

**State diagram:** `docs-implementation/web-pwa-state-diagram.md` (route map, auction bid state flow, real-time flag fallback, service worker caching rules).

**Tests (web + API):** `apps/web/test/*`: countdown, bid status mapper, error code mapper, real-time flag, manifest, service worker, security headers, source greps (no token storage / secrets / countdown clock), accessibility static landmarks+labels; `apps/api/test/integration-server-time.test.ts`: injected-clock `serverTime`.

**Lighthouse (measured locally against the built app, Chrome available):** homepage `/` — accessibility **100**, best-practices **96**, performance **86**; `/auth/login` accessibility **100**. Lighthouse 13 has no PWA category, so no PWA score is claimed; manifest/service-worker rules are covered by unit tests instead. The first run exposed a CSP issue (inline Next.js bootstrap scripts blocked, breaking hydration); CSP `script-src` now includes `'unsafe-inline'` as a documented placeholder until nonce-based CSP is implemented.

**Known limitations:** no admin/staff screens (deferred, docs/09); no real-time gateway (docs/03 §5); no visual design/wireframes (docs/16 §8 #6); participant pages are scaffold-level with shared screen states rather than fully wired data; Lighthouse a11y/PWA scores reflect a scaffold, not production UI.

**Workstream status:** #11 Responsive web/PWA — **partial**. Slice 10 not started.

## Slice 10 — Observability, privacy inventory and security scaffolding (workstream 12, partial)

**Scope:** workstream 12. Local structured logging with enforced redaction, request id propagation, in-process metrics, dependency-aware health checks, a privacy data inventory, an account-deletion **request** stub, dependency/secret scanning in CI, an IDOR suite and a security test checklist. **Not added:** monitoring vendor, alerting service, external SaaS, tracing, real secret manager, new business rules, end-user GraphQL mutations, or payment/auction/notification behaviour. `docs/16` and all applied migrations unchanged; one new migration added after them.

**Migration (reviewed):** `apps/api/migrations/1700001000000_account_deletion_stub.js` — `account_deletion_requests` (id, user_id FK, status `requested`, reason, `requested_at` from injected clock; no SQL default) with partial unique index on user_id while status is `requested`; working down migration. Roundtrip expected list updated. Retention/fulfilment OPEN (docs/16 §7 #7).

**Decisions (proposed placeholders):**
- **D1 Structured logs:** `apps/api/src/logging/logger.ts` emits one JSON object per line with level, msg, injected-clock `time`, `requestId` and a bounded field set. Request ids come from a valid-UUID `x-request-id` header or a generated UUID (`apps/api/src/middleware/requestContext.ts`); the value is echoed in the response header. Default sink is console (no-op in tests; tests inject a sink).
- **D2 Redaction:** enforced recursively in the logger before serialisation, with a case-insensitive normalised deny-list (password/token/secret/authorization/cookie/session/webhook/card/email/phone/address/legal_name/storage_key and variants). Nested objects and arrays are covered; values become `[REDACTED]`.
- **D3 Request logging:** middleware logs method, query-free path, status, `duration_ms`, requestId and GraphQL operation name only; never bodies, variables, query strings or other headers. A login-password test confirms the secret never appears in captured log lines.
- **D4 Metrics:** `apps/api/src/observability/metrics.ts` in-process registry — `http_requests_total{method,route,status_class}`, `http_request_duration_ms` buckets, `bid_outcomes_total{outcome:accepted|rejected}`, `consumer_batch_failures_total{consumer}`, `outbox_unpublished_rows` and `outbox_oldest_unpublished_age_seconds` (DB read + injected clock on scrape). `GET /metrics` serves Prometheus text behind `Authorization: Bearer <METRICS_TOKEN>`; 401 without. `METRICS_TOKEN` required in production. Labels reject IDs/emails/free text. No vendor.
- **D5 Health:** `GET /health/live` (process up only, no dependencies) and `GET /health/ready` (PostgreSQL `SELECT 1` + Redis `PING`, 2000 ms NOT FOR PRODUCTION timeout) at `apps/api/src/observability/health.ts`. Bodies contain only `ok|fail` per check — no error text, hosts or connection strings. Existing `/health` unchanged.
- **D6 Privacy inventory:** `docs-implementation/privacy-data-inventory.md` lists personal/sensitive columns from all migrations with classification (docs/04 §6), purpose, readers, `retention: OPEN` (docs/16 §7 #7) and `In logs: No`. Tests cross-check the doc against migration columns.
- **D7 Deletion request stub:** `apps/api/src/accounts/deletion.ts` records intent only (one row, one audit row, injected-clock `requested_at`), no deletion/anonymisation/session revocation. Duplicate open request returns the existing id and writes nothing; suspended users may request; closed accounts record nothing. No end-user GraphQL mutation (scope restriction).
- **D8 Dependency/secret scanning in CI:** steps added to `.github/workflows/ci.yml` — `Dependency audit` (`npx -y pnpm@9.15.4 audit --prod --audit-level=high`) and `Secret scan` (`bash scripts/scan-secrets.sh`), no `continue-on-error`. The grep-based script excludes `.env.example` and explicit test fixtures via `scripts/secret-scan-allowlist.txt`. CI install remains `--frozen-lockfile`.
- **D9 IDOR suite:** `apps/api/test/integration-security.test.ts` asserts user B cannot read/update/act on user A's orders, payments, bids, notifications, listing drafts, seller verification, reports, account sessions, profile or deletion request, with `NOT_FOUND`/`FORBIDDEN` consistent with existing rules and no audit/event writes for denials.
- **D10 Security test checklist:** rate limiting on register/login/password reset/resend verification/placeBid/createCheckout/reportListing (route-level strict limiter with injectable low limits); secure cookie attributes via `apps/api/src/auth/cookies.ts`; placeholder GraphQL depth limit 10 (`apps/api/src/graphql/limits.ts`, NOT FOR PRODUCTION, docs/16 does not cover it); production GraphQL error formatter strips stack/exception data; no stack traces in Express error responses.

**State diagram:** `docs-implementation/observability-security-state-diagram.md`.

**Dependency audit result (recorded, not fixed — stop for review):** `npx -y pnpm@9.15.4 audit --prod --audit-level=high` exited **1**: `4 vulnerabilities found — Severity: 2 moderate | 2 high`, all `postcss` via `apps/web > next@15.5.29 > postcss@8.4.31`. High: GHSA-6g55-p6wh-862q (arbitrary file read via sourceMappingURL, `<=8.5.11`, patched `>=8.5.12`); GHSA-r28c-9q8g-f849 (path traversal in previous source map auto-loading, `<=8.5.17`, patched `>=8.5.18`). Moderate: GHSA-qx2v-qp2m-jg93 (XSS via unescaped `</style>`, `<8.5.10`, patched `>=8.5.10`); GHSA-fxqj-rqcc-2cmp (incomplete fix of GHSA-6g55-p6wh-862q, `<=8.5.22`, patched `>=8.5.23`). Patched versions exist for all four; no downgrade or unrelated package change was made. **The CI Dependency audit step will therefore fail until this is reviewed.**

**Known gaps:** retention and privacy request workflows OPEN (docs/16 §7 #7, §7 #8); legal counsel approval OPEN (docs/16 §7 #10); no monitoring vendor, alerts/alert routes or on-call (docs/13 §6); no backup/restore drill or RPO/RTO (docs/13 §8); no distributed tracing or Redis-backed rate limits; no real secret manager; no CSRF strategy review; depth limit and health timeout are placeholders; in-app metrics are per-process and not persisted.

**Workstream status:** #12 Security, privacy, support and observability — **partial**. Slice 11 not started.

## Test hygiene — fixed-date time bomb in GraphQL auction test (2026-11-17)

- **Time bomb:** `apps/api/test/integration-auction.test.ts` case "seller creates an auction for their own published listing; a non-owner cannot (NOT_FOUND)" derived `startsAt`/`endsAt` from the fixed `FIXED_NOW = 2026-11-16T12:00:00Z`, but sent them through the GraphQL `createAuction` mutation. That resolver validates the schedule against the **real** server clock (`{ now: () => new Date() }`), so once wall time passed `FIXED_NOW + 1 day` (2026-11-17T12:00:00Z) the case failed deterministically with `INVALID_SCHEDULE`. Every other `FIXED_NOW` use in `apps/api/test` is safe: it is either injected via `{ now: () => FIXED_NOW }` into service-level `createAuction`/`placeBid`/`closeAuction`/`publishOutbox`, or written directly as a timestamp with no clock validation.
- **Fix (test code only):** the GraphQL-driven case now computes `startsAt`/`endsAt` from `Date.now()` at runtime, keeping the same 1-day / 8-day relative offsets; all assertions and expected outcomes are unchanged. The existing separate `INVALID_SCHEDULE` case now uses an explicit fixed **past** date (`2020-01-01T00:00:00Z`) so past-date rejection remains proven without adding a test.
- **Rule going forward:** time-dependent GraphQL tests must use runtime-relative dates; a fixed date is only safe when a clock is injected or when the timestamp is deliberately in the past.

## Slice 12 — Order disputes, staff assignment and resolution (workstream 9, partial)

**Scope:** closes the buildable part of FR-072 (support request / dispute tied to an order) and FR-073 (staff review and resolution with audit). No evidence uploads/object storage, no provider-level chargebacks (FR-044 stays open), no real payment providers, no notifications beyond existing outbox events, no new UI, and no change to auction, bidding or fee rules. `docs/16` and all applied migrations (`1700000000000`–`1700001000000`) are unchanged.

**FR status:** FR-072 — **partial** (participant dispute creation and messages exist; no evidence attachments/object storage and no separate support-request workflow — docs/16 §8 #4, docs/13). FR-073 — **partial** (staff queue, assignment, resolution and audit exist; reason codes, outcomes and evidence window are placeholders — docs/16 §8 #4). FR-044 — **partial** (internal refunds/failures only; provider-level chargebacks and negative balances absent — docs/16 §5 #8). FR-051 — **partial** (flat placeholder estimate only, no carrier rates — docs/16 §6 #1–#6). FR-074 — extended with dispute audit events.

**Migration (new, applied after `1700001000000`):** `apps/api/migrations/1700001100000_disputes_slice12.js` — `disputes`, `dispute_messages`, `dispute_requests`; enums for reason code/status/outcome/message role; partial unique index on `(order_id) WHERE status='open'`; queue index `(status, created_at, id)`; CHECK constraints via createTable options; working down migration. Roundtrip expected list updated with `1700001100000` only.

**State machine:** `apps/api/src/disputes/disputeStateMachine.ts` — `open → resolved → closed`; every other pair throws `INVALID_DISPUTE_TRANSITION`. No resolver writes status.

**Permissions:** `apps/api/src/disputes/permissions.ts` — deny by default; buyer/seller participant access; support sees assigned cases only; moderator/admin full; finance read-only financial fields. Role checks repeat in resolver and service.

**Decisions (all proposed placeholders, NOT FOR PRODUCTION unless noted):**

- **D1 Open a dispute:** `openDispute(orderId, reasonCode, description, requestId)` — order buyer/seller only (non-participant `NOT_FOUND`); eligible order states `paid|processing|shipped|ready_for_pickup|completed`, otherwise `INVALID_DISPUTE_STATE`; idempotent on `requestId` (`dispute_requests` unique index); one open dispute per order returns the existing id with no writes. `apps/api/src/disputes/service.ts` `openDispute`.
- **D2 Reason codes:** exactly `item_not_as_described|item_not_received|damaged|other`; description required/trimmed, capped by `config.disputes.maxDescriptionLength` (default 2000). **NOT FOR PRODUCTION; TODO docs/16 §8 #4** (approved dispute policy).
- **D3 Evidence window:** `config.disputes.evidenceWindowDays` default 30, measured from the order's `paid_at` (order_events paid transition) or `created_at`, using the injected clock; outside → `INVALID_DISPUTE_STATE`. **NOT FOR PRODUCTION; TODO docs/16 §8 #4** (evidence window OPEN).
- **D4 Messages:** `dispute_messages` with `author_role` buyer/seller/staff, `internal_only` flag, body; participants post only while open; staff posts with `author_role=staff`. **No file uploads — TODO(docs/13, docs/16 §8 #4): evidence attachments need object storage.**
- **D5 Visibility:** participants see the dispute and non-internal messages only; staff (support when assigned, moderator/admin) see all including reporter identity and internal notes; participant types never expose `internal_only`, staff user IDs, provider IDs or payment payloads. Finance receives a separate `DisputeFinanceType` (order total, refunds, payment status) with no description/messages.
- **D6 Staff review:** `disputesQueue(first, after)` cursor-paginated by `created_at, id`, limit 1–100; support (assigned only), moderator, admin, finance (financial view only). `disputeForStaff(id)` enforces the same scope.
- **D7 Assignment:** `assignDispute(disputeId, staffUserId)` — admin/moderator only; target must hold a staff role; one audit row; support cannot see unassigned cases.
- **D8 Resolution:** `resolveDispute(disputeId, outcome, reason, amountMinor?)` — `no_action`, `refund_full`, `refund_partial`, `order_cancelled`; reason required; `refund_*` goes through the Slice 6 `refundPayment` path (no bypass, fake provider only); `order_cancelled` requires `awaiting_payment` and writes the order status only via `orderStateMachine`; sets `resolved`/`resolved_by`/`resolved_at` from the injected clock; second resolution → `INVALID_DISPUTE_TRANSITION`. **Outcomes are placeholders; TODO docs/16 §8 #4.**
- **D9 Close:** `closeDispute(disputeId, reason)` — staff only, `no_action` disputes only, reason required, one audit row; `resolved → closed` only.
- **D10 Notifications via outbox:** `dispute.opened` (other participant), `dispute.message_posted` (other participant, no body in payload), `dispute.resolved` (both participants, outcome code only) mapped by the existing notifications consumer. Templates are neutral placeholders — **TODO docs/16 §8 #6** (copy review); nothing removed from earlier slices.
- **D11 Money flag:** refund outcomes call the existing flag-guarded refund path; with `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` OFF they return `REAL_MONEY_DISABLED` and write nothing; `no_action`/`order_cancelled`/messaging work with the flag OFF.

**Not implemented / TODO:** evidence attachments and object storage (docs/13, docs/16 §8 #4); provider-level chargebacks/disputes and negative balances (docs/16 §5 #8, FR-044); approved reason codes, evidence window and outcomes (docs/16 §8 #4); approved notification copy (docs/16 §8 #6); support-request workflow and appeal path; real payment providers; UI screens. Note: D1 and D8 intentionally differ — a dispute cannot be opened on an `awaiting_payment` order, so `order_cancelled` is only reachable for a fixture/legacy dispute; this tension is recorded for policy resolution (docs/16 §8 #4).

**State diagram:** `docs-implementation/disputes-state-diagram.md`.

**Workstream status:** #9 Admin moderation and audit trail — **partial** (dev-complete for disputes; no evidence uploads, no provider chargebacks, placeholder policy). No production claim.

## Phase 1 closeout (final session)

**A1 — FR-051 fulfilment estimate (done, placeholder only).** Added `config.fulfilment.flatShippingEstimateMinor` (`FULFILMENT_FLAT_ESTIMATE_MINOR`, default 0), labelled NOT FOR PRODUCTION with TODO docs/16 §6 #1–#3 and #6. Added `estimatedShippingMinor` and `estimateBasis = PLACEHOLDER_FLAT` to the participant-scoped order view (`apps/api/src/orders/service.ts` `mapOrderView`; `apps/api/src/graphql/schema.ts` `EstimateBasisEnum` / `OrderType`). No address- or carrier-derived computation; `total_minor` is unchanged. Tests: `estimate is returned to the buyer`, `NOT_FOUND for a non-participant`, `estimate is never added to total_minor` (`apps/api/test/integration-fulfilment-estimate.test.ts`).

**A2 — FR-060 seller outcomes (done).** Added read-only `getSellerListingOutcome` (`apps/api/src/catalogue/service.ts`) and `Listing.auctionOutcome { status, finalPriceMinor }` on the seller's own listing view (`apps/api/src/graphql/resolvers/catalogue.ts`, `apps/api/src/graphql/schema.ts` `SellerAuctionOutcomeType`), enforcing the same ownership rule; `closed_unsold` reports final price 0. Tests: `seller sees own closed_sold outcome; another seller gets NOT_FOUND`, `seller sees own closed_unsold outcome with final price` (`apps/api/test/integration-seller-outcome.test.ts`).

**A3 — traceability (done).** `docs-implementation/phase1-traceability.md`: one row per P0 FR-001…FR-074 with implementation file:line, evidence test name, and status (met / partial / NOT MET). Rows that cannot be cited are marked NOT MET. Built from the code, not memory.

**A4 — deferral register (done).** `docs-implementation/phase1-deferral-register.md`: every NOT MET or PARTIAL item with what is missing, the docs/16 or docs/01 §9 reference, the deciding owner role, and the earliest slice after the decision.

### Final 12 workstream statuses

| # | Workstream | Status | Slices | Open items |
|---|---|---|---|---|
| 1 | Identity and account management | partial | 0,1,3 | FR-004 email change/re-verification; MFA (P1); production email provider |
| 2 | Seller profile and basic verification | partial | 2 | document storage, thresholds, SLAs, appeals (docs/16 §7) |
| 3 | Categories and listing management | partial | 3a,3b | approved taxonomy, moderation UI/policy, automated moderation |
| 4 | Timed auction engine | partial | 4a,4b | snipe, reserve, production scheduler; flag OFF for all users |
| 5 | Manual bidding / proxy baseline | partial | 4a,4b | proxy + tie-breaking; flag OFF for all users |
| 6 | Search and browsing | partial | 5 | UI/wireframes, approved config/attributes |
| 7 | Checkout and selected payment provider | partial | 6 | real hosted provider, capture, payouts, escrow; flag OFF |
| 8 | Orders and basic fulfilment | partial | 6, A1 | real rates/carriers/tax; estimate is a flat placeholder |
| 9 | Admin moderation and audit trail | partial | 3b,7,12 | evidence uploads, provider chargebacks, approved dispute policy, appeals |
| 10 | Notifications | partial | 8 | real email/SMS/push, real-time delivery, preferences UI |
| 11 | Responsive web/PWA | partial | 9 | admin screens, real-time gateway, visual design |
| 12 | Security, privacy, support and observability | partial | 10 | external review, backup/restore drill, alert routes/on-call, retention, legal approvals |

No workstream is marked done for development or done for production at this closeout.

### Verdict

**Phase 1 not complete for development. Unmet P0 items: FR-042.**

FR-042 is the only NOT MET row (fake payment adapter only; no hosted/tokenized collection). FR-044 and FR-051 are PARTIAL (provider chargebacks absent; flat estimate placeholder only), and FR-072 and FR-073 are PARTIAL (core dispute workflows implemented in Slice 12; evidence uploads and approved policy/outcomes missing). Because each has a cited partial implementation, none of these four is in the unmet list. The launch criteria in docs/01 §9 items 6–10 are also not met; see the deferral register. No production-readiness claim is made.

## Reconciliation (final pass)

**Corrections made (docs only; no product code, tests, migrations or docs/16 changed):**

- `docs-implementation/phase1-traceability.md`: 12 rows had wrong or incomplete citations and were corrected from the source — FR-005 (`1700000000100_identity_access.js:17`, `:28-29`), FR-013 (`catalogue/service.ts:476`, `:517`, `:574`, `:635`, `:675` instead of `:453/:494/:551/:612/:652`), FR-014 (exact passing test names `a published listing matching the query is returned; a non-matching query returns NO_MATCHES` and `category slug with no published listings returns CATEGORY_EMPTY` instead of the informal "published hit / NO_MATCHES / CATEGORY_EMPTY cases"), FR-023 (`1700000000500_auctions_bids_slice4a.js:50`), FR-040 (`orders/service.ts:84` instead of `:80`), FR-041 (`orders/service.ts:200`), FR-045 (`orders/service.ts:163`), FR-050 (`orders/service.ts:299` instead of `:292`), FR-051 (`config.ts:97`, `orders/service.ts:216`), FR-060 (`catalogue/service.ts:355`, `graphql/resolvers/catalogue.ts:142`), FR-071 (`accounts/service.ts:91`) and FR-074 (`audit.ts:15`, `source-guard.test.ts:33`). All 35 cited test names were confirmed present and passing in the verbose output.
- FR-072 and FR-073 are **partial**, not NOT MET: Slice 12 implemented `openDispute`, `disputesQueue`, `assignDispute`, `resolveDispute`, `closeDispute` and dispute messages with audit. FR-072 gaps: no evidence uploads/object storage and no separate support-request workflow (docs/16 §8 #4; docs/13). FR-073 gaps: reason codes, outcomes and evidence window are placeholders (docs/16 §8 #4); refund/chargeback policy remains OPEN (docs/16 §5 #8) — that last gap belongs to FR-044, not to FR-073. The closeout verdict was corrected to stop listing either as unmet.
- The only remaining NOT MET row, FR-042, has a cited code path (`payments/service.ts:60`) that is a **fake/sandbox adapter behind an OFF flag**, not a hosted/tokenized provider integration; it therefore stays NOT MET. No other NOT MET row exists to downgrade.
- No unsupported "done"/"met" claim was found: every such word in this file is tied to a slice section with file/test evidence, or to a traceability row with a file:line and a passing test name.

**Completion figures (estimates from the 31-row P0 list in `phase1-traceability.md`, not measured coverage):**

| Status | Count |
|---|---:|
| met | 24 |
| partial | 6 |
| not met | 1 |
| total P0 | 31 |

**24 of 31 P0 requirements met with evidence; 6 partial; 1 not met; 0 production-ready.**

No P0 item is production-ready: none has a non-placeholder approved policy value, a passing external review and a named owner sign-off together. The approval log (docs/16 §10) is entirely Open, there is no external security review, and no named sign-off exists. These counts are estimates derived from the P0 traceability classification, not measured test or code coverage, and they are not a production-readiness claim.

**Verdict:** **Phase 1 not complete for development. Unmet P0 items: FR-042.**

## Slice 13 — Provider-neutral hosted-checkout contract (fake adapter only)

**Scope:** added a provider-neutral hosted-session contract (`apps/api/src/payments/hostedSession.ts`, `apps/api/src/payments/fakeProvider.ts`), a service operation `startHostedCheckout` and a neutral `payment.session_completed` webhook event (`apps/api/src/payments/service.ts`). **FR-042 stays NOT MET**: this slice adds only the neutral contract plus its fake implementation; no hosted real-money collection and no real provider exists. `FEATURE_REAL_MONEY_PAYMENTS_ENABLED` remains OFF by default and is asserted OFF at production startup. No provider name, SDK or network call was added; no applied migration was changed and no new migration was added.

**Decisions (all proposed placeholders, NOT FOR PRODUCTION):**
- **Hosted session:** `createHostedSession({ paymentId, amountMinor, currency, returnUrl, cancelUrl, at, ttlMinutes })` returns `{ sessionId, redirectUrl, expiresAt }`. `returnUrl`/`cancelUrl` must be allowlisted relative paths (`/checkout/return`, `/checkout/cancel`); anything else → `VALIDATION_ERROR` with no writes. `expiresAt` derives from the injected clock plus `config.payments.hostedSessionTtlMinutes` (default 30) — **TODO docs/16 §5 #5** (capture timing OPEN). The fake `redirectUrl` is an internal test route; nothing leaves the process.
- **startHostedCheckout:** buyer-only, flag-guarded (`REAL_MONEY_DISABLED` when OFF, no writes), reuses the `createCheckout` payment row, stores the session reference against it (outbox event, no schema change) and is idempotent on `requestId`.
- **Webhook:** `payment.session_completed` is handled by the existing verified/signature-checked webhook path; payment status moves `created → captured` through the payment state machine and the order `awaiting_payment → paid` through the order state machine, and only within the placeholder session window. Duplicate delivery is deduped by `(provider, provider_event_id)`. Browser redirects/return URLs never change state.

**Link to docs/16:** §5 #1 (which provider is the MVP primary processor) and §5 #2 (account type/charge model) remain OPEN; the contract exists so a real adapter can be added later without changing order or payment logic. See the FR-042 entry in `docs-implementation/phase1-decision-pack.md` — the provider choice is still pending, with no recommendation made.

**Tests (all passing):** the nine Slice 13 names in `apps/api/test/integration-hosted-checkout.test.ts`, covering neutral redirect/expiresAt, URL rejection, flag OFF, buyer-only and idempotency, verified session completion with dedupe, expiry, return-URL no-op, and the two source guards.

**Workstream status:** #7 Checkout and selected payment provider — **partial** (neutral contract + fake implementation; no real provider). FR-042 unchanged: **NOT MET**.

**Slice 13 verification pass (post-commit):**

- **Completion-lookup finding:** `payment.session_completed` locates the payment by reading the `payment.hosted_session_started` outbox row (`apps/api/src/payments/service.ts:237-244`) via `payload->>'sessionId'`, then loading `payment_transactions` by that row's `aggregate_id`. The **sessionId is not recoverable from `payment_transactions` alone** — there is no session column. This is a design gap. No migration was added. Test added: `session completion webhook: payment is located only through the outbox session link` (asserts no session column exists and that completion succeeds via the outbox link).
- **Known limitation (recorded, not fixed):** session reference lives in `outbox_events`; a dedicated column needs a new migration, which requires an owner decision on migration policy.
- **Flag gating confirmed:** `handleWebhook` calls `requireMoneyEnabled` before any write; test added `session completion webhook: flag OFF returns REAL_MONEY_DISABLED and changes no state`. Existing `startHostedCheckout: flag OFF returns REAL_MONEY_DISABLED and writes nothing` covers the start path.
- **Allowlist confirmed:** `HOSTED_URL_ALLOWLIST` and `isAllowedHostedUrl` are in `apps/api/src/payments/hostedSession.ts:11`, `:13`; test `hosted session: external or absolute returnUrl and cancelUrl return VALIDATION_ERROR and write nothing` passes.
- **Manual grep (Step 2):** `grep -rniE 'stripe|paypal|authorize\.net|braintree|fetch\s*\(|axios|node-fetch|https?\.request' apps/api/src/payments` → no matches (exit 1). No provider name, SDK package name or network call exists in the payments module.
- **Traceability row corrected:** Slice 13 supporting-evidence citations now carry exact file:line references; FR-042 status was not changed.

## Slice 14 — Decision intake and no-decision hardening

**Baseline (before any change):** clean tree at `fa7035013bb2f693fe400e3d497beea5afda0ffa`; lint, typecheck, test (361 API / 15 web / 1 shared), build and dependency audit all exit 0. Decision-log re-read: 35 rows, **0 VALID, 0 INCOMPLETE, 35 BLANK** — no decision-gated work was implemented.

**Work done (no-decision hardening only):**
- Partial P0 items FR-004, FR-021, FR-044, FR-051, FR-072 and FR-073 were re-checked. All remaining gaps are **POLICY-DEPENDENT**; none is a purely technical gap. Labelling and the deciding Decision ID for each were recorded in `phase1-deferral-register.md`. No code was changed for these items.
- Added `apps/api/test/integration-slice14-boundaries.test.ts` (6 tests): a **characterization** test explicitly marked "current behaviour, pending owner decision" for support-role refunds (behaviour unchanged); buyer/other-buyer address and seller/other-seller order boundaries; no fee-mutation and no role-assignment GraphQL surface; and webhook **replay after success**.
- Authorization cases already covered were confirmed (IDOR suite, suspended-user bid/list rejection, proxy non-exposure). **MFA is not implemented in code (FR-008, P1)** — recorded as a P1 gap; no MFA test added.
- Webhook contract: replay after success added; existing invalid-signature, duplicate-delivery, out-of-order-unknown and redirect-no-op tests confirmed. The "payment succeeded but local processing failed" reconcile case is **skipped — the fake adapter has no such mode**.
- Added `docs-implementation/migration-roundtrip-local.md`: how to run `npx -y pnpm@9.15.4 migrate:test` locally when `psql` is absent, using the repository's Docker Postgres service (container `aliauction-postgres`, host port `5433`). CI was not changed.
- **Slice 11 clarification:** Slice 11 is **simply unstarted**, not blocked by any recorded decision. No work was started.

**Needs an owner decision (not done):** support-role refund permission differs from the docs/09 "No by default" baseline. A deferral-register entry was added; a **new decision-log row is required** (the owner must add it — the 35-entry pack and the log were not edited).

`docs-implementation/phase1-traceability.md` was not changed: no requirement status or implementation changed in this slice, only tests and documentation. P0 counts remain **24 met / 6 partial / 1 not met / 0 production-ready**. FR-042 remains **NOT MET**. No production-readiness claim is made.

## No-decision work completed

Owner decisions were neither made nor inferred; no decision-log row, approval, legal/security review, restore drill or sign-off is recorded as done. `docs/16` and migrations were unchanged.

1. **Test baseline:** `npx -y pnpm@9.15.4 -r test -- --reporter=verbose` run once — API **367 passed** (41 files), web **15 passed**, shared **1 passed**, exit 0.
2. **Lint and typecheck:** `npx -y pnpm@9.15.4 lint` and `npx -y pnpm@9.15.4 -r typecheck` both exit 0.
3. **Dependency audit:** `npx -y pnpm@9.15.4 audit --prod --audit-level=high` exit 0 — `No known vulnerabilities found`.
4. **Restore-drill runbook:** created `docs-implementation/restore-drill-runbook.md` as a draft. Every step is marked `Owner: operations` / `Status: not executed`; nothing was executed. Drill cadence and RPO/RTO remain OPEN (decision-log §9 #8).
5. **Alert/on-call template:** created `docs-implementation/alert-routes-template.md` listing only metrics and health checks that exist in `apps/api/src/observability` (plus gauges set in `apps/api/src/index.ts`). On-call contact column is blank and each row states `Decision: pending (decision-log: FR-???, operations)`; no contacts invented (decision-log §9 #9).
6. **Sandbox config placeholders:** `apps/api/src/config.ts` now includes empty/false, NOT FOR PRODUCTION sandbox placeholders (`sandboxEnabled`, `sandboxMerchantId`, `sandboxApiKey`, `sandboxWebhookSecret`). No provider chosen, no SDK, no network call.
7. **Decision-log cross-check:** every one of the **35** entries in `docs-implementation/phase1-decision-pack.md` has a matching row in `docs-implementation/decision-log.md` (35/35, no gaps). No row was filled or changed.

P0 status is unchanged: **24 met / 6 partial / 1 not met / 0 production-ready**; FR-042 remains NOT MET. This section adds no production-readiness claim.

## Owner decisions recorded

One decision-log row is now recorded. No P0 status or count is changed by this section.

- **FR-021 — Eligible buyer bids while open (flag OFF for all users):** option A — "Keep flag OFF — cost: no user can bid; risk: MVP bidding requirement stays partial." Live bidding flag stays OFF. Decided 2026-11-19. Source: `docs-implementation/decision-log.md`.
- Counts from `docs-implementation/decision-log.md`: 35 rows total — **1 decided / 34 pending**. By owner role: product owner 1 decided / 17 pending; finance 0 decided / 9 pending; engineering lead 0 decided / 3 pending; operations 0 decided / 3 pending; counsel 0 decided / 2 pending.

FR-021 remains partial. Live bidding stays OFF until the auction-rule decisions in §3 are made.

## Remaining work classification

Read-only classification from `docs-implementation/phase1-traceability.md` and this status document. P0 counts are unchanged: **24 met / 6 partial / 1 not met / 0 production-ready**. No item in this table was started.

| Item | Status | Classification | Decision ID (`docs-implementation/decision-log.md`) |
|---|---|---|---|
| FR-004 profile / contact management | partial | blocked | FR-004 — Email change / re-verification (product owner) |
| FR-021 eligible buyer bids while open | partial | blocked | §3 #1–#9 and §3 #14 auction-rule decisions (product owner); the recorded FR-021 option A keeps the flag OFF |
| FR-042 hosted/tokenized payment collection | NOT MET | blocked | FR-042 — Hosted/tokenized payment collection (NOT MET) (engineering lead) |
| FR-044 refunds/failures/chargebacks recorded | partial | blocked | FR-044 — Provider-level chargebacks / disputes / negative balances (finance) |
| FR-051 fulfilment options and estimates | partial | blocked | FR-051 — Real shipping rates and estimates (operations) |
| FR-072 support request / dispute tied to order | partial | blocked | FR-072 — Evidence uploads / separate support-request workflow (product owner) |
| FR-073 staff dispute review/resolution + audit | partial | blocked | FR-073 — Approved dispute outcomes and evidence window (product owner) |

Every gap above is policy-dependent (Slice 14 classification in `docs-implementation/phase1-deferral-register.md`), not a code-only change. No P0 status or count was changed by this section.

## Decision-independent structure built

No owner decision was made, inferred or pre-filled. No capability was enabled: every new flag defaults to `false` and is covered by the existing startup guards in `apps/api/src/index.ts`. P0 status is unchanged (**24 met / 6 partial / 1 not met / 0 production-ready**); FR-042 remains NOT MET.

- **FR-042 — hosted payment collection:** `apps/api/src/payments/adapter.ts` adds a provider-neutral hosted-session adapter contract (`createSession`, `confirmSession`, `verifyWebhook`, `recordRefund`), a deterministic in-memory fake, an interface-only real-adapter slot, and a required adapter-kind input with no default. `apps/api/test/payment-adapter-contract.test.ts` covers idempotency, signature verification and the unimplemented slot; the existing provider-neutral session/service code was reused, not duplicated. Still needs: **FR-042 — Hosted/tokenized payment collection (NOT MET)** and **§5 #1–#10 — Payment architecture**.
- **FR-044 — refunds/failures/chargebacks:** `apps/api/src/payments/providerEvents.ts` adds neutral event kinds, validated state transitions, an idempotent in-memory record store and a required chargeback-treatment input with no default; no fee, payout or tax rule is hard-coded. `apps/api/test/provider-events.test.ts` exercises the fake adapter. Still needs: **FR-044 — Provider-level chargebacks / disputes / negative balances** (and FR-042 for provider events).
- **FR-051 — shipping:** `apps/api/src/shipping/rateQuote.ts` adds a rate-quote interface, a fake quoter, an interface-only real quoter, and required currency/carriers/scope/cost inputs with no defaults. `apps/api/src/payments/service.ts` now calls the guard so checkout refuses real-rate mode while unset. `apps/api/test/shipping-rate-quote.test.ts` covers the flag, missing config and checkout refusal. Still needs: **FR-051 — Real shipping rates and estimates** and **§6 #1–#9 — Shipping and fulfilment rules**.
- **FR-072 / FR-073 — disputes:** `apps/api/src/disputes/decisionIndependent.ts` adds an in-memory evidence record store, an audit-entry builder, a workflow check that reuses the existing dispute state machine, required approved-outcome/reason-code/evidence-window/storage inputs with no defaults, and a staff-review placeholder. `apps/api/src/index.ts` exposes `/admin/disputes/review-placeholder`, which returns only `NOT_ENABLED` and no dispute data. `apps/api/test/dispute-decision-independent.test.ts` covers these paths. **No migration was created:** the existing dispute schema has no evidence table, and `docs/16 §8 #4` leaves storage and retention OPEN; persistent evidence storage would require a migration that this decision-independent scope does not authorize. Still needs: **FR-072 — Evidence uploads / separate support-request workflow** and **FR-073 — Approved dispute outcomes and evidence window**.
- **FR-004 — profile/contact:** `apps/api/src/auth/emailChange.ts` states the existing no-policy profile-edit field set, adds a required re-verification input with no default, and keeps `requestEmailChange`/`confirmEmailChange` returning `NOT_ENABLED` with no token flow. `apps/api/test/email-change-not-enabled.test.ts` covers these paths. Still needs: **FR-004 — Email change / re-verification**.
- **FR-021 — bidding:** no auction-rule behaviour was added. `apps/api/test/live-bidding-startup-guards.test.ts` additionally pins all decision-dependent flags to `false`, checks that both startup guards are invoked, and verifies the production-only money guard. FR-021 option A (recorded 2026-11-19) keeps the flag OFF. Still needs: **§3 #1–#9 and §3 #14 — auction-rule decisions** before enablement could be considered.

Real bidding and real-money payments stay OFF until every required decision-log row is filled and signed off. No approval, legal review, security review, restore drill or sign-off was marked done.

## Frontend built

The complete Phase 1 web navigation is in place, with a web-only build-time demo setting
(`NEXT_PUBLIC_DEMO_MODE=true`, equivalent name `VITE_DEMO_MODE=true`). Demo data is in memory and
uses the API's provider-neutral fake response shapes. A production build with demo mode on fails.
Every demo screen shows the exact banner `DEMO: not real, nothing is charged, no decision made`.
Real-mode screens show `Not enabled yet`, `Bidding is not enabled` or `Payments not enabled`
instead of an error and make no bidding or payment request. P0 status is unchanged
(**24 met / 6 partial / 1 not met / 0 production-ready**); FR-042 remains NOT MET. No decision-log
row, `docs/16`, migration, approval or sign-off was changed.

| Page / path | Built or reused | Decision-log ID still needed before it can be switched on |
|---|---|---|
| App shell, navigation, banner, not-enabled state | Reused `PageShell`, `ScreenState`; added `DemoBanner`, `NotEnabled`, responsive styles | None for the shell itself; per-feature IDs below |
| Browse / search / filter (`/search`, `/demo/listings`) | Reused search route; in-memory filtering in demo | §8 #1–#10 — Product and operations (category/moderation policy) |
| Listing detail (`/listings/[slug]`, `/demo/listings/[slug]`) | Reused listing route and server-authoritative countdown; added photos and seller panel | §8 #1–#10 — Product and operations |
| Bidding (`/buyer/bids`, `/demo/bidding`, shared `AuctionPanel`) | Real mode disabled; demo simulation uses local state only | FR-021 and §3 #1–#9, §3 #14 — auction-rule decisions (FR-021 option A keeps the flag OFF) |
| Checkout / payments (`/checkout`, `/demo/checkout`) | Provider-neutral fake hosted session, success, failure and refund states; no provider named | FR-042 — Hosted/tokenized payment collection; §5 #1–#10 — Payment architecture |
| Orders (`/buyer/orders`, `/demo/orders`, `/demo/orders/[orderId]`) | Added demo list, status, payment-event records and timeline | FR-044 — Provider-level chargebacks / disputes / negative balances |
| Shipping (`/shipping`, `/demo/shipping`) | Fake quoter display; real mode shows `Not enabled yet` while inputs are unset | FR-051 — Real shipping rates; §6 #1–#9 — Shipping and fulfilment rules |
| Disputes (`/disputes`, `/demo/disputes`) | Buyer dispute, in-memory evidence list and status view | FR-072 — Evidence uploads / support-request workflow |
| Staff review (`/staff/disputes`, `/demo/staff/disputes`) | Real mode `Not enabled yet`; demo simulation with no outcome decided | FR-073 — Approved dispute outcomes and evidence window |
| Account (`/account`, `/demo/account`) | Profile edit limited to the API allowlist; no email field edited | None for the allowlisted fields |
| Email change (`/account/email`, `/demo/account/email`) | `Not enabled yet` in both modes | FR-004 — Email change / re-verification |
| Admin status (`/admin/status`) | Read-only flags table and decision-log table parsed at build time (1 decided / 34 pending) | All pending rows listed in the table before any capability is enabled |

Local commands, demo URLs and what each screen proves are documented in
`docs-implementation/demo-guide.md`.

Real bidding and real-money payments stay OFF until every required decision-log row is filled and
signed off. No approval, legal review, security review, restore drill or sign-off was marked done.
