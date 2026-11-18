# Phase 1 owner decision pack — AliAuction.ca

**This pack contains no decisions.** Every entry ends with `Decision: [pending]` for the named owner
role. No payment provider is chosen or recommended here. No approval, legal review, provider
contract, backup drill or sign-off is marked done.

**Phase 1 status is unchanged:** not complete for development; FR-042 not met; 24 met, 6 partial, 1 not met of 31; 0 production-ready.

Sources: `docs-implementation/phase1-deferral-register.md` (owner roles, docs references, earliest slices),
`docs-implementation/phase1-traceability.md` (P0 statuses), `docs/01` §6/§9, `docs/16` §3–§10, `docs/10` §5.
An item may block more than one activity; its `Blocks:` field lists all, and it is written out once under its
primary block with cross-references in the other block indexes.

## Summary

### Entries per owner role

| Owner role | Entries |
|---|---:|
| product owner | 18 |
| finance | 9 |
| engineering lead | 3 |
| operations | 3 |
| counsel | 2 |
| **total** | **35** |

### Block indexes (entry may appear in more than one)

- **Blocks live bidding (12):** FR-021, FR-025, §3 #1, §3 #2, §3 #3, §3 #4, §3 #5, §3 #6, §3 #7, §3 #8, §3 #9, §3 #14. Also relevant from other blocks: §3 #12, §3 #13, §5 #1–#10, §7 #1–#10.
- **Blocks real money (10):** FR-042, FR-044, FR-045, §3 #10, §3 #11, §3 #12, §3 #13, §4 #1–#11, §5 #1–#10, §9. Also relevant: §3 #9, §6 #1–#9, §10.
- **Blocks public launch (13):** FR-004, FR-051, FR-072, FR-073, §9 #6, §9 #7, §9 #8, §9 #9, §9 #10, §6 #1–#9, §7 #1–#10, §8 #1–#10, §10. Also relevant: §4, §5, §9, FR-042, FR-044, FR-045.

### Critical path (suggested order; not a decision)

1. **§10 + §9 #10** — all approvals and named product-owner sign-off: gates every release and unblocks final acceptance.
2. **§3 #1–#9, §3 #14, FR-021** — the bundled auction-rule decisions: unblocks the largest set of bidding work (live bidding flag, increments, proxy, snipe, reserve, cancellation).
3. **§5 #1–#10 + FR-042 questions + §4 #1–#11** — payment architecture, provider questions and fee model: together unblock all real-money work.
4. **§7 #1–#10 + §9 #6** — identity checks, prohibited items, appeals, retention and legal-counsel approval of policies: unblocks public-launch compliance.
5. **§8 #1–#10 + §6 #1–#9** — categories/moderation/ops and fulfilment decisions: unblocks launch-scope build including FR-051, FR-072, FR-073 gaps.
6. **§9 #7, §9 #8, §9 #9** — external security review, backup/restore drill, alert routes and on-call: unblocks launch readiness.
7. **§9 + FR-044 + FR-045** — reconcile financial model and approve fee/refund policy: unblocks finance sign-off and accounting.

---

## Block 1 — Blocks live bidding

### FR-021 — Eligible buyer bids while open (flag OFF for all users)
- Refs: docs/01 §6 FR-021; docs/16 §3 #1–#14. Blocks: live bidding.
- Decision needed: Under which approved auction rules may live bidding be enabled for real users?
- Owner: product owner.
- Options:
  - A) Keep flag OFF — cost: no user can bid; risk: MVP bidding requirement stays partial.
  - B) Enable after §3 rules are decided — cost: flag rollout + monitoring; risk: live bidding on unapproved rules if sequencing slips.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: enable `FEATURE_LIVE_BIDDING_ENABLED` behind approved config, add operational tests; earliest slice: Slice 13+ (decision prerequisite).
- Blocked until decision: any live bidder access; bid-related acceptance criteria.
- Decision: [pending] ________________

### FR-025 — Reserve and snipe-protection enforcement
- Refs: docs/01 §6 FR-025; docs/16 §3 #5–#8. Blocks: live bidding.
- Decision needed: Are reserves and snipe protection in MVP, and what are the trigger, extension cap and bidder visibility?
- Owner: product owner.
- Options:
  - A) Keep both disabled — cost: none; risk: auctions close without anti-snipe protection, outcomes differ from plan.
  - B) Enable with approved parameters — cost: state machine + config + tests; risk: wrong extension rule produces disputed outcomes.
- Engineering after A: leave placeholders; earliest slice: none.
- Engineering after B: extend auction state machine, add `extended` status and reserve checks; earliest slice: Slice 13+.
- Blocked until decision: auction close semantics; winner determination rules.
- Decision: [pending] ________________

### §3 #1 — Auction format
- Refs: docs/16 §3 #1; docs/01 §6. Blocks: live bidding.
- Decision needed: Are auctions English ascending only?
- Owner: product owner.
- Options:
  - A) Confirm English ascending only — cost: documentation; risk: other formats cannot be added later without redesign.
  - B) Allow another format — cost: new state machine and bidding rules; risk: Schedule 1–4 scope growth.
- Engineering after A: keep current model, mark approved; earliest slice: none.
- Engineering after B: model additional format behind a flag; earliest slice: Slice 13+.
- Blocked until decision: all other §3 auction rules; live bidding enablement.
- Decision: [pending] ________________

### §3 #2 — Bid input semantics
- Refs: docs/16 §3 #2. Blocks: live bidding.
- Decision needed: Does the bid field mean the next bid amount or a confidential maximum?
- Owner: product owner.
- Options:
  - A) Next-bid amount — cost: none (current placeholder); risk: no proxy bidding in MVP.
  - B) Maximum/proxy input — cost: new bid engine + privacy rules; risk: tie-breaking and leakage if incomplete.
- Engineering after A: keep current resolver; earliest slice: none.
- Engineering after B: implement proxy bidding and max privacy; earliest slice: Slice 13+.
- Blocked until decision: bid UX, proxy implementation, tie-breaking rule.
- Decision: [pending] ________________

### §3 #3 — Bid increments
- Refs: docs/16 §3 #3. Blocks: live bidding.
- Decision needed: What are the bid increments by price band or category?
- Owner: product owner.
- Options:
  - A) Keep single flat increment — cost: none; risk: poor UX at high prices.
  - B) Approved band/category schedule — cost: config + tests; risk: incorrect bands reject valid bids.
- Engineering after A: keep `AUCTION_BID_INCREMENT_MINOR`; earliest slice: none.
- Engineering after B: add increment schedule resolver and validation; earliest slice: Slice 13+.
- Blocked until decision: bid validation thresholds.
- Decision: [pending] ________________

### §3 #4 — Proxy maximum tie-breaking
- Refs: docs/16 §3 #4. Blocks: live bidding.
- Decision needed: How are equal proxy maximums resolved?
- Owner: product owner.
- Options:
  - A) Earliest maximum wins — cost: ordering rule + audit; risk: perceived unfairness to later bidders.
  - B) Deterministic random tie-break — cost: randomness policy + audit; risk: requires approved fairness wording.
- Engineering after A: ordered proxy queue; earliest slice: Slice 13+.
- Engineering after B: seeded tie-break with recorded outcome; earliest slice: Slice 13+.
- Blocked until decision: proxy bidding implementation.
- Decision: [pending] ________________

### §3 #5 — Snipe-protection window / extension
- Refs: docs/16 §3 #5. Blocks: live bidding.
- Decision needed: What is the snipe trigger window and extension duration?
- Owner: product owner.
- Options:
  - A) No snipe protection — cost: none; risk: last-second bids win without extension.
  - B) Fixed window + extension — cost: close-job changes; risk: extension loops if cap missing.
- Engineering after A: keep disabled; earliest slice: none.
- Engineering after B: extend close logic with window; earliest slice: Slice 13+.
- Blocked until decision: auction close behaviour.
- Decision: [pending] ________________

### §3 #6 — Maximum number of extensions
- Refs: docs/16 §3 #6. Blocks: live bidding.
- Decision needed: Is there a cap on snipe extensions, and what is it?
- Owner: product owner.
- Options:
  - A) No cap — cost: none; risk: indefinite auctions.
  - B) Numeric cap — cost: counter column + tests; risk: arbitrary value if unapproved.
- Engineering after A: leave disabled; earliest slice: none.
- Engineering after B: persist extension count and enforce cap; earliest slice: Slice 13+.
- Blocked until decision: snipe-protection design.
- Decision: [pending] ________________

### §3 #7 — Reserve prices in MVP
- Refs: docs/16 §3 #7. Blocks: live bidding.
- Decision needed: Are reserve prices enabled in MVP?
- Owner: product owner.
- Options:
  - A) Disabled — cost: none; risk: low-price sales allowed.
  - B) Enabled — cost: reserve validation + close outcome; risk: reserve status leaks if visibility rule missing.
- Engineering after A: keep column unused; earliest slice: none.
- Engineering after B: read reserve at close; earliest slice: Slice 13+.
- Blocked until decision: close outcome rules.
- Decision: [pending] ________________

### §3 #8 — Reserve visibility to bidders
- Refs: docs/16 §3 #8. Blocks: live bidding.
- Decision needed: Is reserve status visible to bidders?
- Owner: product owner.
- Options:
  - A) Not visible — cost: none; risk: bidders cannot tell if reserve is met.
  - B) Visible flag — cost: public field + copy review; risk: strategic bidding effects.
- Engineering after A: no exposure; earliest slice: none.
- Engineering after B: add public safe field; earliest slice: Slice 13+.
- Blocked until decision: reserve feature design.
- Decision: [pending] ________________

### §3 #9 — Seller cancellation after first bid
- Refs: docs/16 §3 #9. Blocks: live bidding.
- Decision needed: May a seller cancel after the first bid, and on what grounds?
- Owner: product owner.
- Options:
  - A) No cancellation after first bid — cost: none; risk: seller stuck with unwanted sale.
  - B) Allowed with reason + audit — cost: mutation, reason validation, notice; risk: buyer trust impact.
- Engineering after A: keep `canCancel` no-bid-only; earliest slice: none.
- Engineering after B: add cancel-after-bid path; earliest slice: Slice 13+.
- Blocked until decision: cancellation UX and buyer notification.
- Decision: [pending] ________________

### §3 #14 — Suspended user while bidding
- Refs: docs/16 §3 #14. Blocks: live bidding.
- Decision needed: What happens to in-flight bids if a user is suspended?
- Owner: product owner.
- Options:
  - A) Reject further bids, keep prior bids — cost: none (current gate); risk: suspended user may still win.
  - B) Void open bids on suspension — cost: bid invalidation job; risk: auction outcome changes after close.
- Engineering after A: document rule; earliest slice: none.
- Engineering after B: add suspension-aware bid invalidation; earliest slice: Slice 13+.
- Blocked until decision: suspension policy and auction outcome finality.
- Decision: [pending] ________________

---

## Block 2 — Blocks real money

### FR-042 — Hosted/tokenized payment collection (NOT MET)
- Refs: docs/01 §6 FR-042; docs/16 §5 #1–#10; docs/10 §5. Blocks: real money (also public launch).
- Note (Slice 13): a provider-neutral hosted-session contract and a fake-only implementation now exist (`apps/api/src/payments/hostedSession.ts`, `fakeProvider.ts`, and `startHostedCheckout` in `apps/api/src/payments/service.ts`). No real provider is named, chosen or integrated; FR-042 stays NOT MET and this note does not mark any decision. The provider choice questions below are still pending.
- Questions only — no provider is chosen or recommended in this pack:
  - Which provider is the MVP primary processor?
  - Which account type and charge model apply?
  - Which merchant-of-record model applies?
  - What is the seller onboarding/KYC responsibility split?
  - When is payment captured: at winning bid, checkout or shipment?
  - Is payment authorization required before bidding?
  - When is seller payout released?
  - How are reserves, refunds, chargebacks and negative balances handled?
  - Is PayPal available at launch or later?
  - What exactly is meant by escrow, and is it legally/provider approved?
- Owner: engineering lead.
- Options:
  - A) Keep flag OFF / fake adapter — cost: none; risk: FR-042 remains NOT MET and no real money can be collected.
  - B) Contract and integrate a provider after the questions are answered by the owner — cost: integration, legal review and audit; risk: no named recommendation is made here, so outcome depends on owner choice.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: provider adapter, hosted checkout, webhook verification, payout/refund reconciliation; earliest slice: Slice 13+.
- Blocked until decision: all real-money flows, merchant-of-record terms, FR-044/FR-045 policy.
- Decision: [pending] ________________

### FR-044 — Provider-level chargebacks / disputes / negative balances
- Refs: docs/01 §6 FR-044; docs/16 §5 #8. Blocks: real money.
- Decision needed: How are chargebacks, provider disputes and negative seller balances handled?
- Owner: finance.
- Options:
  - A) Internal records only — cost: none; risk: provider chargebacks unhandled and unreconciled.
  - B) Provider event reconciliation — cost: webhook model + finance workflow; risk: depends on FR-042 provider choice.
- Engineering after A: keep internal `refunds`/`payment.failed`; earliest slice: none.
- Engineering after B: chargeback event table, reconciliation job and audit; earliest slice: Slice 13+.
- Blocked until decision: refund/chargeback policy, accounting treatment.
- Decision: [pending] ________________

### FR-045 — Approved fee model
- Refs: docs/01 §6 FR-045; docs/16 §4 #1–#11. Blocks: real money (also public launch).
- Decision needed: Who pays the 8% commission, on what base, with which refundability and category rates?
- Owner: finance.
- Options:
  - A) Keep 800 bps buyer-fee placeholder — cost: none; risk: displayed fees are unapproved and may be wrong.
  - B) Approve full model — cost: finance review + reconciliation; risk: revenue-model inconsistencies unresolved (docs/16 §9).
- Engineering after A: keep placeholder fee rule; earliest slice: none.
- Engineering after B: implement approved payer/base/refund rules and disclosure; earliest slice: Slice 13+.
- Blocked until decision: fee disclosure, checkout totals, payout accounting.
- Decision: [pending] ________________

### §3 #10 — Non-payment outcome for winner
- Refs: docs/16 §3 #10. Blocks: real money.
- Decision needed: What happens when the winner does not pay?
- Owner: finance.
- Options:
  - A) Order stays awaiting_payment — cost: none; risk: stock stalls, no relist rule.
  - B) Cancel + relist after deadline — cost: job + notices; risk: needs approved deadbeat policy.
- Engineering after A: document; earliest slice: none.
- Engineering after B: deadline job and outcome rules; earliest slice: Slice 13+.
- Blocked until decision: order lifecycle after win.
- Decision: [pending] ________________

### §3 #11 — Time allowed to pay
- Refs: docs/16 §3 #11. Blocks: real money.
- Decision needed: How long does the winner have to pay?
- Owner: finance.
- Options:
  - A) No enforced deadline — cost: none; risk: indefinite unpaid orders.
  - B) Fixed window — cost: timer/job + notices; risk: arbitrary value if unapproved.
- Engineering after A: document; earliest slice: none.
- Engineering after B: due-at field and expiry job; earliest slice: Slice 13+.
- Blocked until decision: non-payment handling.
- Decision: [pending] ________________

### §3 #12 — Verified payment method before bidding
- Refs: docs/16 §3 #12. Blocks: real money (also live bidding).
- Decision needed: Must bidders add a verified payment method before bidding?
- Owner: finance.
- Options:
  - A) No pre-authorization — cost: none; risk: unpaid wins.
  - B) Require verified method — cost: provider integration + gate; risk: reduces bidder conversion.
- Engineering after A: keep current eligibility; earliest slice: none.
- Engineering after B: eligibility check at `placeBid`; earliest slice: Slice 13+.
- Blocked until decision: bidder eligibility rules.
- Decision: [pending] ________________

### §3 #13 — Deposits / pre-authorizations for high-value bids
- Refs: docs/16 §3 #13. Blocks: real money (also live bidding).
- Decision needed: Are deposits or pre-authorizations required for high-value bids?
- Owner: finance.
- Options:
  - A) None — cost: none; risk: high-value default exposure.
  - B) Threshold-based hold — cost: provider hold flow + release rules; risk: legal/provider approval needed.
- Engineering after A: document; earliest slice: none.
- Engineering after B: hold/release workflow; earliest slice: Slice 13+.
- Blocked until decision: high-value bid rules and escrow policy.
- Decision: [pending] ________________

### §4 #1–#11 — Fee and revenue model
- Refs: docs/16 §4; docs/01 §6 FR-045. Blocks: real money (also public launch).
- Decision needed: Commission payer/base/refunds, category rates, listing-fee timing, subscriptions, featured/advertising pricing and revenue reconciliation?
- Owner: finance.
- Options:
  - A) Keep all values as placeholders — cost: none; risk: financial reporting and disclosure unapproved.
  - B) Approve the full model — cost: finance + legal review; risk: docs/16 §9 inconsistencies must be resolved first.
- Engineering after A: keep placeholder rules; earliest slice: none.
- Engineering after B: implement approved fee/entitlement rules; earliest slice: Slice 13+.
- Blocked until decision: billing, payouts, fee disclosure.
- Decision: [pending] ________________

### §5 #1–#10 — Payment architecture
- Refs: docs/16 §5; docs/10 §5. Blocks: real money (also live bidding).
- Decision needed: Processor, account model, merchant of record, KYC split, capture timing, payout timing, refunds/chargebacks, PayPal timing and escrow meaning?
- Owner: finance.
- Options:
  - A) Keep sandbox-only — cost: none; risk: no real money path.
  - B) Approve architecture — cost: contracting + legal review; risk: depends on FR-042 provider questions.
- Engineering after A: keep flag OFF; earliest slice: none.
- Engineering after B: implement approved architecture; earliest slice: Slice 13+.
- Blocked until decision: FR-042, FR-044, payouts, escrow.
- Decision: [pending] ________________

### §9 — Source financial/TOC/leadership inconsistencies
- Refs: docs/16 §9. Blocks: real money (also public launch).
- Decision needed: Which figure is authoritative for commission, revenue, GMV, marketing budget and leadership names?
- Owner: finance.
- Options:
  - A) Leave unresolved — cost: none; risk: financial model cannot be approved.
  - B) Reconcile and record approved figures — cost: finance review; risk: changes stated business plan numbers.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: update financial config/docs after approval; earliest slice: Slice 13+.
- Blocked until decision: §4 fee model approval, launch financial disclosure.
- Decision: [pending] ________________

---

## Block 3 — Blocks public launch

### FR-004 — Email change / re-verification
- Refs: docs/01 §6 FR-004; docs/16 §7 #8. Blocks: public launch.
- Decision needed: Is email change supported in Phase 1, and what re-verification is required?
- Owner: product owner.
- Options:
  - A) Exclude from Phase 1 — cost: none; risk: users cannot correct a mistyped email.
  - B) Add change with re-verification — cost: token flow + audit; risk: takeover path if verification is weak.
- Engineering after A: document out-of-scope; earliest slice: none.
- Engineering after B: request/confirm email change, revoke sessions, audit; earliest slice: Slice 13+.
- Blocked until decision: account self-service scope; privacy notice wording.
- Decision: [pending] ________________

### FR-051 — Real shipping rates and estimates
- Refs: docs/01 §6 FR-051; docs/16 §6 #1–#6; docs/10 §5. Blocks: public launch (also real money).
- Decision needed: Are shipping/pickup mandatory, who pays, which provinces/carriers, and are rates address-derived?
- Owner: operations.
- Options:
  - A) Keep flat placeholder (0) — cost: none; risk: displayed estimate is NOT FOR PRODUCTION.
  - B) Approve carrier-rate model — cost: carrier integration + contracts; risk: rate accuracy and launch scope.
- Engineering after A: keep `flatShippingEstimateMinor`; earliest slice: none.
- Engineering after B: carrier rate lookup + address-based estimate; earliest slice: Slice 13+.
- Blocked until decision: checkout estimate accuracy, fulfilment disclosures.
- Decision: [pending] ________________

### FR-072 — Evidence uploads / separate support-request workflow
- Refs: docs/01 §6 FR-072; docs/16 §8 #4; docs/13. Blocks: public launch.
- Decision needed: Are evidence attachments and a separate support-request workflow in MVP, and what storage/retention applies?
- Owner: product owner.
- Options:
  - A) Keep disputes without attachments — cost: none; risk: no evidence trail for disputes.
  - B) Add uploads + object storage — cost: storage, access control, retention; risk: privacy exposure if misconfigured.
- Engineering after A: document gap; earliest slice: none.
- Engineering after B: upload service, object storage, retention job; earliest slice: Slice 13+.
- Blocked until decision: dispute evidence handling; privacy impact assessment.
- Decision: [pending] ________________

### FR-073 — Approved dispute outcomes and evidence window
- Refs: docs/01 §6 FR-073; docs/16 §8 #4. Blocks: public launch.
- Decision needed: What are the approved resolution outcomes, reason codes and evidence window?
- Owner: product owner.
- Options:
  - A) Keep placeholders — cost: none; risk: resolutions are NOT FOR PRODUCTION.
  - B) Approve policy — cost: policy drafting + ops review; risk: wrong window causes unfair outcomes.
- Engineering after A: keep current enums; earliest slice: none.
- Engineering after B: replace placeholders with approved values; earliest slice: Slice 13+.
- Blocked until decision: dispute resolution policy and support SLAs.
- Decision: [pending] ________________

### §9 #6 — Approved privacy notice, terms, auction rules, fee disclosure, refund policy
- Refs: docs/01 §9 #6; docs/10 §5. Blocks: public launch.
- Decision needed: Which documents are approved and by which named owner?
- Owner: counsel.
- Options:
  - A) No approved documents — cost: none; risk: launch criterion §9 #6 stays not met.
  - B) Approve full set — cost: legal review; risk: wording must align to approved policies.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: publish approved copy/versioning; earliest slice: pre-launch.
- Blocked until decision: public launch, §9 acceptance.
- Decision: [pending] ________________

### §9 #7 — External security review and remediation
- Refs: docs/01 §9 #7; docs/10 §5. Blocks: public launch.
- Decision needed: Who performs the external review and what remediation bar applies?
- Owner: engineering lead.
- Options:
  - A) Automated scans only — cost: none; risk: §9 #7 remains partial.
  - B) Commission external review — cost: vendor + remediation time; risk: findings may require rework.
- Engineering after A: keep CI scans; earliest slice: none.
- Engineering after B: remediate findings, re-test; earliest slice: pre-launch.
- Blocked until decision: security acceptance for launch.
- Decision: [pending] ________________

### §9 #8 — Backup and restore drill
- Refs: docs/01 §9 #8. Blocks: public launch.
- Decision needed: What backup policy, RPO/RTO and drill cadence are required?
- Owner: engineering lead.
- Options:
  - A) No drill — cost: none; risk: no verified recovery path.
  - B) Define and execute drill — cost: ops time; risk: may expose backup gaps.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: automated backup + restore drill evidence; earliest slice: pre-launch.
- Blocked until decision: recovery acceptance for launch.
- Decision: [pending] ________________

### §9 #9 — Alert routes and on-call
- Refs: docs/01 §9 #9. Blocks: public launch.
- Decision needed: Which alert routes, escalation tiers and on-call roster apply?
- Owner: operations.
- Options:
  - A) In-process metrics/health only — cost: none; risk: no operational response.
  - B) Define routing + on-call — cost: tooling + staffing; risk: rota coverage gaps.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: alert rules, routes, runbooks; earliest slice: pre-launch.
- Blocked until decision: support/ops acceptance for launch.
- Decision: [pending] ________________

### §9 #10 — Product owner sign-off of all P0 requirements
- Refs: docs/01 §9 #10. Blocks: public launch.
- Decision needed: Who signs off, on what evidence, and when?
- Owner: product owner.
- Options:
  - A) No named sign-off — cost: none; risk: §9 #10 stays not met.
  - B) Named sign-off — cost: review of traceability + deferrals; risk: falsified completion if gaps are ignored.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: record signed acceptance; earliest slice: pre-launch.
- Blocked until decision: final acceptance and release.
- Decision: [pending] ________________

### §6 #1–#9 — Shipping and fulfilment rules
- Refs: docs/16 §6; docs/10 §5. Blocks: public launch (also real money).
- Decision needed: Shipping obligation, pickup options, shipping payer, provinces, cross-border, first carrier, own labels, lost/damaged handling and pickup no-shows?
- Owner: operations.
- Options:
  - A) Keep manual fulfilment only — cost: none; risk: estimates and obligations unapproved.
  - B) Approve fulfilment policy — cost: ops + carrier planning; risk: launch scope growth.
- Engineering after A: keep manual shipments; earliest slice: none.
- Engineering after B: carrier integration and rules; earliest slice: Slice 13+.
- Blocked until decision: FR-051 estimates, fulfilment disclosures.
- Decision: [pending] ________________

### §7 #1–#10 — Identity, privacy and trust
- Refs: docs/16 §7; docs/10 §5. Blocks: public launch (also live bidding).
- Decision needed: Seller/buyer identity checks, business documents, age limits, prohibited items, appeals, retention, privacy workflows, provinces and legal-counsel approval?
- Owner: counsel.
- Options:
  - A) Keep placeholders — cost: none; risk: verification and privacy obligations unmet.
  - B) Approve full policy — cost: legal review; risk: stricter checks may reduce onboarding.
- Engineering after A: keep current verification stub; earliest slice: none.
- Engineering after B: verification workflows, retention jobs, privacy request handling; earliest slice: pre-launch.
- Blocked until decision: public launch, buyer verification for bidding.
- Decision: [pending] ________________

### §8 #1–#10 — Product and operations
- Refs: docs/16 §8. Blocks: public launch.
- Decision needed: Approved categories, moderation model, support hours/languages, dispute policy, SLAs, availability/RPO/RTO, rollout, launch traffic, analytics tools and design spec?
- Owner: product owner.
- Options:
  - A) Keep placeholders — cost: none; risk: launch scope and SLOs undefined.
  - B) Approve operational model — cost: product + ops review; risk: commitments may be unachievable.
- Engineering after A: keep placeholder categories/copy; earliest slice: none.
- Engineering after B: approved taxonomy, moderation policy, SLO dashboards; earliest slice: Slice 13+ / pre-launch.
- Blocked until decision: launch readiness, dispute policy, UI/design acceptance.
- Decision: [pending] ________________

### §10 — All approvals remain Open
- Refs: docs/16 §10. Blocks: public launch (also real money).
- Decision needed: Who approves MVP scope, auction rules, fee model, payment architecture, shipping, privacy/legal, cloud architecture and UI/UX?
- Owner: product owner.
- Options:
  - A) Leave all Open — cost: none; risk: nothing is production-authorized.
  - B) Assign named owners and approve — cost: multi-party review; risk: dependencies between approvals.
- Engineering after A: no build; earliest slice: none.
- Engineering after B: record approvals with dates; earliest slice: pre-launch.
- Blocked until decision: every production enablement item.
- Decision: [pending] ________________
