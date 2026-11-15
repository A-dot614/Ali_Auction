# Phase 1 — MVP Implementation Status

**Roadmap source:** `docs/15-delivery-roadmap.md`  
**Scope basis:** `docs/01-product-requirements-document.md`, `docs/02-epics-user-stories.md`  
**Last updated:** 2026-11-15 (Slice 3a catalogue/listings partial completed; stopped before Slice 3b moderation/public completion)

## Phase 1 workstreams

| # | Workstream | Status | Notes |
|---|---|---|---|
| 1 | Identity and account management | In progress | Implemented: registration, login, logout, email verification, password reset (provider-agnostic email interface with dev console provider), bcrypt password hashing, DB-backed session tokens in HttpOnly/SameSite cookies with rotation and revocation on logout/reset, roles baseline (`buyer`,`seller`,`admin`), server-side GraphQL authz checks, audit logging helper + sensitive auth events, auth rate limiting, unit/integration/authz tests. Not yet: MFA (FR-008/P1, policy/open decisions), profile management UI/API, full account lifecycle, email delivery provider integration, production-grade session hardening/CSRF posture review for final deployment. |
| 2 | Seller profile and basic verification workflow | Not started | Identity roles seeded (`seller`), but seller profile/verification entities and workflows not migrated/implemented. Verification requirements/policies are open decisions. |
| 3 | Categories and listing management | In progress (Slice 3a partial) | Slice 3a implemented: placeholder categories (seeded `is_placeholder=true`, "PLACEHOLDER - NOT APPROVED"), listing drafts/create/update/submit, `myListings`, public `listing(slug)` (published-only, public-safe fields), listing state machine module, migration/tests/docs. **No auctions/bids/scheduling enforcement** (requested times draft-only/non-binding); moderation actions/UI completion and some public behaviors deferred to **Slice 3b**. |
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
- **§8 #3** Moderation manual/automated/hybrid: **OPEN**. Moderator approve/reject/pause/remove GraphQL actions and public completion deferred to **Slice 3b** (state model supports transitions).
- **§7 #5** Prohibited/restricted items policy: **OPEN** (needed for moderation/review reasons and listing controls).
- **§3 #1** Auction format/rules: **OPEN** — affects requested schedule semantics/enforcement (Slice 4).
- **§3 #2** Bid input semantics (next bid vs maximum/proxy): **OPEN** — affects future bidding UX/validation (not in 3a).
- **Title/description length limits:** placeholder values (3–120 / 1–5000) — **TODO docs/16 §8**.
- **Media count limit:** **OPEN** (docs/16 §8) — not enforced; `listing_media` metadata-only, storage/upload provider TODO (docs/13, docs/16 §5/#8).
- **Slug uniqueness scope:** implemented as globally unique (documented); revisit if per-seller policy approved.
- Requested start/end remain draft-only/non-binding in 3a; no future-start validation (Slice 4 server-time logic).

**Workstream status:** #3 Categories and listing management — **In progress (Slice 3a partial complete; Slice 3b moderation/public completion not started)**. No auctions/bids/scheduling enforcement implemented. Live bidding and real-money payments remain **OFF** by enforced defaults.
