# Phase 1 deferral register — AliAuction.ca

Everything NOT MET or PARTIAL at closeout. Nothing here is approved or production-ready. Each row
names the owner role who must decide and the earliest slice in which the work could be taken up
**after** that decision. No product code is written for these items in this session.

| ID | What is missing | Reference | Owner role | Earliest slice after decision |
|---|---|---|---|---|
| FR-004 | Email change with re-verification | docs/01 §6; docs/16 §7 #8 | product owner | Slice 13+ |
| FR-021 | Live bidding enabled for real users (currently flag OFF for all) | docs/16 §3 #1–#14 | product owner | Slice 13+ (decision prerequisite) |
| FR-025 | Reserve and snipe-protection enforcement (disabled placeholders) | docs/16 §3 #5–#8 | product owner | Slice 13+ |
| FR-042 | Hosted/tokenized real payment collection; real provider contract | docs/16 §5 #1–#3 | engineering lead | Slice 13+ |
| FR-044 | Provider-level chargebacks/disputes and negative balances | docs/16 §5 #8 | finance | Slice 13+ |
| FR-045 | Approved fee model (payer, base, refundability, rates) | docs/16 §4 #1–#11 | finance | Slice 13+ |
| FR-051 | Real shipping rates, carrier API and address-based estimates | docs/16 §6 #1–#6 | operations | Slice 13+ |
| FR-072 | Evidence file uploads / object storage and separate support-request workflow | docs/16 §8 #4; docs/13 | product owner | Slice 13+ |
| FR-073 | Approved dispute-resolution outcomes and evidence window | docs/16 §8 #4 | product owner | Slice 13+ |
| §9 #6 | Approved privacy notice, terms, auction rules, fee disclosure, refund policy (no approved document / named owner) | docs/01 §9 #6 | counsel | pre-launch |
| §9 #7 | External security review and remediation (automated scans only) | docs/01 §9 #7 | engineering lead | pre-launch |
| §9 #8 | Backup and restore drill (never performed) | docs/01 §9 #8 | engineering lead | pre-launch |
| §9 #9 | Alert routes and on-call escalation (in-process metrics/health only) | docs/01 §9 #9 | operations | pre-launch |
| §9 #10 | Named product owner sign-off of all P0 requirements | docs/01 §9 #10 | product owner | pre-launch |
| §3 #1 | Auction format (English ascending only assumed) | docs/16 §3 #1 | product owner | Slice 13+ |
| §3 #2 | Bid input semantics (next bid vs maximum) | docs/16 §3 #2 | product owner | Slice 13+ |
| §3 #3 | Bid increments by price band/category | docs/16 §3 #3 | product owner | Slice 13+ |
| §3 #4 | Equal proxy maximum tie-breaking | docs/16 §3 #4 | product owner | Slice 13+ |
| §3 #5 | Snipe-protection trigger/extension window | docs/16 §3 #5 | product owner | Slice 13+ |
| §3 #6 | Maximum number of extensions | docs/16 §3 #6 | product owner | Slice 13+ |
| §3 #7 | Reserve prices in MVP | docs/16 §3 #7 | product owner | Slice 13+ |
| §3 #8 | Reserve status visibility to bidders | docs/16 §3 #8 | product owner | Slice 13+ |
| §3 #9 | Seller cancellation after first bid | docs/16 §3 #9 | product owner | Slice 13+ |
| §3 #10 | Non-payment outcome for winner | docs/16 §3 #10 | finance | Slice 13+ |
| §3 #11 | Time allowed for winner to pay | docs/16 §3 #11 | finance | Slice 13+ |
| §3 #12 | Verified payment method required before bidding | docs/16 §3 #12 | finance | Slice 13+ |
| §3 #13 | Deposits / pre-authorizations for high-value bids | docs/16 §3 #13 | finance | Slice 13+ |
| §3 #14 | Suspended user while bidding | docs/16 §3 #14 | product owner | Slice 13+ |
| §4 #1–#11 | Commission payer/base, refundability, category rates, listing-fee timing, subscription entitlements, featured/advertising pricing, revenue reconciliation | docs/16 §4 | finance | Slice 13+ |
| §5 #1–#10 | Primary processor, Stripe Connect model, merchant of record, KYC split, capture timing, authorization, payout release, refunds/chargebacks/negative balances, PayPal timing, escrow approval | docs/16 §5 | finance | Slice 13+ |
| §6 #1–#9 | Shipping obligation, pickup options, shipping payer, provinces, cross-border, carrier choice, own labels, lost/damaged packages, pickup no-shows | docs/16 §6 | operations | Slice 13+ |
| §7 #1–#10 | Seller/buyer identity checks, business documents, age limits, prohibited items, appeals, retention, privacy workflows, provinces, legal counsel approval | docs/16 §7 | counsel | pre-launch |
| §8 #1–#10 | Approved categories, moderation model, support hours/languages, dispute policy and evidence window, SLAs, RPO/RTO, rollout, launch traffic, analytics tools, wireframes/design | docs/16 §8 | product owner | pre-launch |
| §9 | Source financial/TOC/leadership inconsistencies | docs/16 §9 | finance | pre-launch |
| §10 | All approvals (MVP scope, auction rules, fee model, payment architecture, shipping, privacy/legal, cloud architecture, UI/UX) remain Open | docs/16 §10 | product owner | pre-launch |
| Support-refund permission | Support-role refund permission differs from docs/09 baseline; deciding role: product owner/finance; needs a decision-log row. | docs/09 §3; docs/16 §5 #8 | product owner / finance | pre-launch |

FR-021 recorded decision (2026-11-19): option A — keep live bidding flag OFF; see `docs-implementation/decision-log.md`. FR-021 remains partial; no P0 status change.

## Slice 14 — partial P0 gap classification

Each remaining gap below is **POLICY-DEPENDENT**: closing it requires an owner decision, not a code-only fix. No code was changed for these items. The deciding Decision ID refers to the entry in `docs-implementation/phase1-decision-pack.md`.

| P0 item | Gap type | Remaining gap | Deciding Decision ID | Owner role |
|---|---|---|---|---|
| FR-004 | POLICY-DEPENDENT | Email change / re-verification not exposed; `docs/16 §7 #8` | FR-004 — Email change / re-verification | product owner |
| FR-021 | POLICY-DEPENDENT | Live bidding flag OFF for all users; `docs/16 §3 #1–#14` | FR-021 — Eligible buyer bids while open (flag OFF for all users) | product owner |
| FR-044 | POLICY-DEPENDENT | Provider chargebacks not implemented; `docs/16 §5 #8` | FR-044 — Provider-level chargebacks / disputes / negative balances | finance |
| FR-051 | POLICY-DEPENDENT | Flat placeholder estimate only, no carrier rates; `docs/16 §6 #1–#6` | FR-051 — Real shipping rates and estimates | operations |
| FR-072 | POLICY-DEPENDENT | No evidence uploads and no separate support-request workflow; `docs/16 §8 #4`, docs/13 | FR-072 — Evidence uploads / separate support-request workflow | product owner |
| FR-073 | POLICY-DEPENDENT | Reason codes, outcomes and evidence window are placeholders; `docs/16 §8 #4` | FR-073 — Approved dispute outcomes and evidence window | product owner |
