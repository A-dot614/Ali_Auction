# Local demo guide — AliAuction.ca

This guide describes a **web-only, build-time demo**. It uses in-memory data and the
provider-neutral fake response shapes already defined in the API. No backend flag is changed,
no payment provider is named or contacted, no real bid is sent, and no owner decision is made.

Every demo screen shows this exact visible notice:
`DEMO: not real, nothing is charged, no decision made`.

A production build with demo mode on fails on purpose (`DEMO_MODE_ENABLED_IN_PRODUCTION`).

## Exact commands

From the repository root:

```bash
# one-time install
npx -y pnpm@9.15.4 install

# terminal 1 — API (only needed to check real-mode health/status; demo pages do not call it)
npx -y pnpm@9.15.4 --filter @aliauction/api dev

# terminal 2 — web demo (build-time setting)
NEXT_PUBLIC_DEMO_MODE=true npx -y pnpm@9.15.4 --filter @aliauction/web dev
```

Open the paths below on the local web origin (default port 3000). `VITE_DEMO_MODE=true` is
accepted as an equivalent build-time name; `NEXT_PUBLIC_DEMO_MODE=true` is preferred for Next.js.

To check the real (non-demo) screens, stop terminal 2 and run:

```bash
npx -y pnpm@9.15.4 --filter @aliauction/web dev
```

## Demo URLs and what each proves

| Page | Path | What it proves |
|---|---|---|
| Demo hub | `/demo` | All demo links in one place; every screen carries the banner. |
| Browse / search / filter | `/demo/listings` | In-memory catalogue, keyword search, category filter and sort. |
| Listing detail | `/demo/listings/vintage-desk-lamp` | Placeholder photos, seller information, price and auction timer. |
| Bidding simulation | `/demo/bidding` | Local bid state only; no bidding endpoint is called and no auction rule is presented as decided. |
| Checkout | `/demo/checkout` | Fake hosted session, success, failure and refund states in the provider-neutral response shape. |
| Orders | `/demo/orders` | In-memory order list with demo statuses. |
| Order detail | `/demo/orders/demo-order-1` | Status, provider-neutral payment events (refund, failure, dispute opened/closed) and a timeline. |
| Shipping | `/demo/shipping` | Fake quoter response with carriers/scope/cost shown as undecided placeholders. |
| Buyer disputes | `/demo/disputes` | Open a local dispute, list in-memory evidence and view status. |
| Staff review | `/demo/staff/disputes` | Labeled review simulation; no outcome, evidence window or staff action is decided. |
| Account | `/demo/account` | Profile edit limited to the API allowlist; email change is not offered. |
| Email change | `/demo/account/email` | Shows `Not enabled yet`; no re-verification flow. |
| Admin status | `/admin/status` | All feature flags OFF and a read-only decision-log table parsed at build time. |

## Real-mode screens (no demo setting)

| Screen | Path | Expected state |
|---|---|---|
| Checkout | `/checkout` | `Payments not enabled`; no payment endpoint call. |
| Shipping | `/shipping` | `Not enabled yet`; no rate request. |
| Disputes | `/disputes` | `Not enabled yet`. |
| Staff review | `/staff/disputes` | `Not enabled yet`. |
| My bids | `/buyer/bids` | `Bidding is not enabled`. |
| Account | `/account` | Allowlisted fields only; email change shows `Not enabled yet`. |

Real bidding and real-money payments stay OFF until every required decision-log row is filled and
signed off. No approval, legal review, security review, restore drill or sign-off is claimed here.
