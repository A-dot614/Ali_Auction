Nothing here is a decision. Decisions are recorded only in decision-log.md by the named owner.

# Owner review pack — AliAuction.ca Phase 1

## How to use this pack

This pack points each named owner role at the local demo screens that illustrate the work awaiting its decision. Every screen is an in-memory simulation built with demo mode ON; nothing is charged, no real service is called, and no provider is chosen. A production build with demo mode ON fails by design. All owner decisions remain recorded only in [decision-log.md](decision-log.md); this file does not fill, infer or change any row.

Status in the tables below is read from `decision-log.md`: **decided** means the row has a named choice, decider and date; **pending** means the decision cells are empty. Current totals in the log: 1 decided / 34 pending.

## FR-021 — confirmation required

FR-021 — Eligible buyer bids while open (flag OFF for all users) was recorded with the decider name **Bilal** and the date 2026-11-19. The actual product owner of record must confirm that row before it is relied on. Do not change the row here; confirm it in `decision-log.md` as the named owner.

## Product owner

### Demo pages to review

| /demo URL | What the page shows |
|---|---|
| `/demo` | Hub listing every simulation and what each one proves; a production build with demo mode on is described as failing. |
| `/demo/listings` | In-memory catalogue with keyword, category and sort filters; listing cards show demo prices only. |
| `/demo/listings/vintage-desk-lamp` | Listing detail: photo placeholders, seller information, starting/current demo price, bid count and a timer derived from a fixed demo instant. |
| `/demo/bidding` | Local mock bid state for one demo listing; explicitly states live bidding stays OFF and no bidding endpoint is used. |
| `/demo/disputes` | Buyer dispute entry, demo evidence list and local status; no outcome or evidence window is presented. |
| `/demo/staff/disputes` | Labeled staff-review simulation with dispute IDs and demo statuses; no outcome or evidence window is decided. |
| `/demo/account` | Profile allowlist form plus a "Not enabled yet" notice for email change and re-verification. |
| `/demo/account/email` | Email-change screen in the neutral "Not enabled yet" state. |

### Decision-log rows still owned

| Decision ID | Status |
|---|---|
| FR-021 — Eligible buyer bids while open (flag OFF for all users) | decided (recorded as Bilal, 2026-11-19; needs product-owner-of-record confirmation) |
| FR-025 — Reserve and snipe-protection enforcement | pending |
| §3 #1 — Auction format | pending |
| §3 #2 — Bid input semantics | pending |
| §3 #3 — Bid increments | pending |
| §3 #4 — Proxy maximum tie-breaking | pending |
| §3 #5 — Snipe-protection window / extension | pending |
| §3 #6 — Maximum number of extensions | pending |
| §3 #7 — Reserve prices in MVP | pending |
| §3 #8 — Reserve visibility to bidders | pending |
| §3 #9 — Seller cancellation after first bid | pending |
| §3 #14 — Suspended user while bidding | pending |
| FR-004 — Email change / re-verification | pending |
| FR-072 — Evidence uploads / separate support-request workflow | pending |
| FR-073 — Approved dispute outcomes and evidence window | pending |
| §9 #10 — Product owner sign-off of all P0 requirements | pending (not signed off) |
| §8 #1–#10 — Product and operations | pending |
| §10 — All approvals remain Open | pending (approvals remain Open) |

## Finance

### Demo pages to review

| /demo URL | What the page shows |
|---|---|
| `/demo/checkout` | Provider-neutral fake hosted session with simulate-success, simulate-failure and simulate-refund controls; no charge is made. |
| `/demo/orders` | In-memory order list; no charge, payout or fee rule is represented. |
| `/demo/orders/demo-order-1` | Order status, recorded total, payment-event table and timeline; events are local demo data only. |
| `/demo/disputes` | Buyer dispute and evidence simulation; approved outcomes and evidence window are intentionally absent because they are undecided. |
| `/demo/staff/disputes` | Review simulation with demo statuses and no resolution outcome. |

### Decision-log rows still owned

| Decision ID | Status |
|---|---|
| FR-044 — Provider-level chargebacks / disputes / negative balances | pending |
| FR-045 — Approved fee model | pending |
| §3 #10 — Non-payment outcome for winner | pending |
| §3 #11 — Time allowed to pay | pending |
| §3 #12 — Verified payment method before bidding | pending |
| §3 #13 — Deposits / pre-authorizations for high-value bids | pending |
| §4 #1–#11 — Fee and revenue model | pending |
| §5 #1–#10 — Payment architecture | pending |
| §9 — Source financial/TOC/leadership inconsistencies | pending |

No payment provider is named or selected in this pack. The demo uses a provider-neutral fake adapter only.

## Counsel

### Demo pages to review

| /demo URL | What the page shows |
|---|---|
| `/demo/account` | Profile allowlist and the "Not enabled yet" state for email change and re-verification. |
| `/demo/account/email` | Email-change screen that states the capability is not enabled; no re-verification rule is assumed. |
| `/demo/disputes` | Buyer dispute and evidence simulation with no approved outcome, reason code or evidence window. |
| `/demo/staff/disputes` | Staff-review simulation that explicitly withholds outcomes because they are undecided. |

### Decision-log rows still owned

| Decision ID | Status |
|---|---|
| §9 #6 — Approved privacy notice, terms, auction rules, fee disclosure, refund policy | pending (legal review not done) |
| §7 #1–#10 — Identity, privacy and trust | pending |

No document is marked approved and no legal review is recorded as complete.

## Operations

### Demo pages to review

| /demo URL | What the page shows |
|---|---|
| `/demo/shipping` | Fake rate quote from in-memory inputs for origin and destination provinces; no real rate request is made. |
| `/demo/orders` | In-memory order list used to review fulfilment status presentation. |
| `/demo/orders/demo-order-1` | Order status and event timeline with no charge, payout or fee rule. |
| `/demo/staff/disputes` | Review simulation with no staff action written. |
| `/demo` | Hub and build notes, including the demo-mode guard. |

### Decision-log rows still owned

| Decision ID | Status |
|---|---|
| FR-051 — Real shipping rates and estimates | pending |
| §9 #9 — Alert routes and on-call | pending |
| §6 #1–#9 — Shipping and fulfilment rules | pending |

No on-call roster, alert route or restore drill is recorded as complete.

## Engineering lead

### Demo pages to review

| /demo URL | What the page shows |
|---|---|
| `/demo/checkout` | Provider-neutral fake hosted-session states; no real adapter, credential or network call. |
| `/demo/orders/demo-order-1` | Payment-event and timeline shapes used to check the event contract. |
| `/demo` | Hub and build notes: demo mode is build-time only and a production build with it on fails. |

### Decision-log rows still owned

| Decision ID | Status |
|---|---|
| FR-042 — Hosted/tokenized payment collection (NOT MET) | pending (P0 status NOT MET, unchanged) |
| §9 #7 — External security review and remediation | pending (security review not done) |
| §9 #8 — Backup and restore drill | pending (drill not done) |

No security review, restore drill or sign-off is marked done.

## Still blocked

Enabling real bidding or real-money payments is not possible from this pack: every required decision-log row must first be filled and signed off by its named owner, and legal review, security review, the backup/restore drill, alert routes/on-call and final sign-off must be completed. Both feature flags remain `false` and the startup guards remain unchanged.
