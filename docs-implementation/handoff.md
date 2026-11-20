# Handoff notes — AliAuction.ca Phase 1

Nothing here records a decision. Decisions are recorded only in
[`decision-log.md`](decision-log.md) by the named owner. Status counts are unchanged:
**24 met / 6 partial / 1 not met / 0 production-ready**; **1 of 35 decisions recorded**; FR-042
remains **NOT MET**. No approval, legal review, security review, restore drill or sign-off is done.

## What is built

- **API** (`apps/api`): Express GraphQL endpoint at `/graphql`, `/health`, session/auth, identity,
  seller profile and verification, catalogue and moderation, auctions and bids (flag OFF), orders,
  provider-neutral fake checkout, notifications, reports, disputes, audit and metrics. The ordered
  migrations in `apps/api/migrations` are the schema source of truth.
- **Web** (`apps/web`): all real-mode routes and all demo-only routes, shared page shell, loading,
  empty, error, offline and not-enabled states, PWA shell and service worker. Demo routes use the
  `.demo.tsx` page extension and are excluded from non-demo builds.
- **One-command local stack**: root `docker-compose.yml` runs Postgres, Redis, one-shot migrations,
  API and web in real mode; the `demo` profile adds a separate non-production web image on port
  3001. See [`docker-guide.md`](docker-guide.md).
- **Owner material**: [`decision-log.md`](decision-log.md),
  [`phase1-decision-pack.md`](phase1-decision-pack.md),
  [`owner-decision-forms.md`](owner-decision-forms.md),
  [`owner-review-pack.md`](owner-review-pack.md),
  [`phase1-traceability.md`](phase1-traceability.md) and
  [`phase1-deferral-register.md`](phase1-deferral-register.md).
- **Visual system**: the web shell and shared UI primitives now use a two-track visual language —
  cinematic black for marketing surfaces and light/cream for transactional screens — with pill
  buttons, thin display type, global `ss03`, and aloe/pistachio accents on light surfaces only.

## What is demo-only

- Every path under `/demo` and every component whose name starts with `Demo`; all use `.demo.tsx`
  pages or demo-only modules.
- The in-memory catalogue, mock bids, fake hosted checkout states, fake shipping quote, mock
  disputes and mock seller/staff queues. No demo data reaches a real endpoint.
- The exact banner `DEMO: not real, nothing is charged, no decision made`.
- Demo mode is a build-time setting (`NEXT_PUBLIC_DEMO_MODE`). A production build with it on fails
  on purpose. The Compose demo profile uses a separate non-production image target.

## What is blocked, and by which decision-log IDs

- **Live bidding for real users:** FR-021, FR-025, §3 #1, §3 #2, §3 #3, §3 #4, §3 #5, §3 #6,
  §3 #7, §3 #8, §3 #9, §3 #14. FR-021 is recorded as option A by Bilal on 2026-11-19 and still
  needs confirmation by the product owner of record; its flag stays OFF.
- **Real money:** FR-042, FR-044, FR-045, §3 #10, §3 #11, §3 #12, §3 #13, §4 #1–#11, §5 #1–#10,
  §9. FR-042 is NOT MET; only a provider-neutral fake adapter exists.
- **Public launch:** FR-004, FR-051, FR-072, FR-073, §9 #6, §9 #7, §9 #8, §9 #9, §9 #10,
  §6 #1–#9, §7 #1–#10, §8 #1–#10, §10.
- **Additional register gap:** the deferral register lists a "Support-refund permission" row that
  has no decision-log row yet; it needs a product owner / finance decision.

The full P0 gap list is in [`phase1-traceability.md`](phase1-traceability.md); the policy-dependent
gaps and earliest slices are in [`phase1-deferral-register.md`](phase1-deferral-register.md).

## Known issues

- The full test suite has a long reported runtime of about **1600 seconds**; allow that time in CI
  rather than treating a short timeout as a failure. Integration tests require a reachable local
  database with the credentials expected by the repo `.env`.
- FR-042 remains NOT MET: no real provider integration, contract or credential exists.
- 34 of 35 decision rows are empty; FR-021 needs confirmation by the product owner of record.
- No approved legal text, external security review, backup/restore drill evidence, alert routes,
  on-call roster or final sign-off exists. These are not marked done anywhere.
- Both feature flags stay false. The startup guards and the production demo-build guard are
  unchanged.

## Design commit audit

Read-only audit of commits `7900771` and `4908fb1`; nothing was changed as a result.

| Check | Finding |
|---|---|
| Files changed | `7900771`: `apps/web/src/app/globals.css`, `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/Card.tsx`, `apps/web/tailwind.config.ts`. `4908fb1`: `apps/web/src/components/PageShell.tsx`, `apps/web/src/components/HomeSections.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/demo/page.demo.tsx`. |
| Demo-only strings, mock data or `/demo` references in non-demo code | None added. The only demo-side change was a `tone="cinematic"` prop. |
| Provider name, SDK or non-localhost URL added | None. |
| Feature flag, startup guard, config default or decision-log row changed | None. No flag set to `true`; `apps/api/src/config.ts`, `apps/api/src/index.ts`, `apps/web/next.config.ts`, `apps/web/src/lib/demo.ts`, Docker files and the decision log are untouched. |
| Brand name, logo or copied brand-specific design from `docs/DESIGN-shopify.md` | No brand name, logo, trademark or proprietary font asset added. Generic design tokens from the reference (black/cream canvases, aloe/pistachio fills, pill radius, thin display weight, global `ss03`) are implemented in CSS/Tailwind; no brand-specific copy or imagery was copied. The reference document was not touched or committed. |
| Web build, demo mode off | Passed (exit 0). |
| Web build, demo mode on with `NODE_ENV=production` | Failed as designed (exit 1) with `DEMO_MODE_ENABLED_IN_PRODUCTION`; the guard is unchanged. |
| Bundle leak check | Passed (exit 0): no demo-only strings in 214 production build files. |

## Collection order by number of items unblocked

This is an ordering of **which decisions to collect**, not a choice among options. The counts come
from the block indexes in [`phase1-decision-pack.md`](phase1-decision-pack.md) and the deferral
rows in [`phase1-deferral-register.md`](phase1-deferral-register.md), cross-checked against the P0
statuses in [`phase1-traceability.md`](phase1-traceability.md).

1. **Public-launch set — 13 decisions:** FR-004, FR-051, FR-072, FR-073, §9 #6, §9 #7, §9 #8,
   §9 #9, §9 #10, §6 #1–#9, §7 #1–#10, §8 #1–#10, §10. The pack lists §10 and §9 #10 first in
   its critical path, followed by the legal/compliance and operations items.
2. **Live-bidding set — 12 decisions:** FR-021, FR-025, §3 #1, §3 #2, §3 #3, §3 #4, §3 #5,
   §3 #6, §3 #7, §3 #8, §3 #9, §3 #14. These cover the auction-rule prerequisites for any
   live-bidding work.
3. **Real-money set — 10 decisions:** FR-042, FR-044, FR-045, §3 #10, §3 #11, §3 #12, §3 #13,
   §4 #1–#11, §5 #1–#10, §9. These cover the payment architecture, fee model and finance policy.

An item can appear in more than one block; the counts above are the pack's block-index counts, not
a sum of unique decisions. No option in any row is marked preferred or selected here.

Real bidding and real-money payments stay OFF until every required decision-log row is filled and signed off.
