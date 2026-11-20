Nothing here is a decision. This briefing does not recommend any option. Decisions are recorded only in decision-log.md by the named owner.

# Plain-language decision briefing — AliAuction.ca Phase 1

This is a reading aid for the 35 rows in [`decision-log.md`](decision-log.md). Each row below shows
the question in plain words, the two options written in the owner pack, and for each option its
cost, risk and what it unlocks. Those details come only from
[`phase1-decision-pack.md`](phase1-decision-pack.md). Where the pack gives no figure or wording,
the text says "not stated in the pack". No row is filled in here and no option is marked as chosen.

## product owner — 18 decisions

### FR-021 — Eligible buyer bids while open (flag OFF for all users)
Question in plain words: Under which approved auction rules may live bidding be enabled for real users?
Needs a person who can: confirm the live-bidding rule and its limits.

- Option A — Keep flag OFF. Cost: no user can bid. Risk: MVP bidding requirement stays partial. Unlocks: no build; earliest slice: none.
- Option B — Enable after the §3 rules are decided. Cost: flag rollout and monitoring. Risk: live bidding on unapproved rules if sequencing slips. Unlocks: enable `FEATURE_LIVE_BIDDING_ENABLED` behind approved config, add operational tests; earliest slice: Slice 13+ (decision prerequisite).

### FR-025 — Reserve and snipe-protection enforcement
Question in plain words: Are reserves and snipe protection in MVP, and what are the trigger, extension cap and bidder visibility?
Needs a person who can: decide the reserve and snipe-protection rules.

- Option A — Keep both disabled. Cost: none. Risk: auctions close without anti-snipe protection, outcomes differ from plan. Unlocks: leave placeholders; earliest slice: none.
- Option B — Enable with approved parameters. Cost: state machine, config and tests. Risk: wrong extension rule produces disputed outcomes. Unlocks: extend auction state machine, add `extended` status and reserve checks; earliest slice: Slice 13+.

### §3 #1 — Auction format
Question in plain words: Are auctions English ascending only?
Needs a person who can: confirm the auction format.

- Option A — Confirm English ascending only. Cost: documentation. Risk: other formats cannot be added later without redesign. Unlocks: keep current model, mark approved; earliest slice: none.
- Option B — Allow another format. Cost: new state machine and bidding rules. Risk: Schedule 1–4 scope growth. Unlocks: model an additional format behind a flag; earliest slice: Slice 13+.

### §3 #2 — Bid input semantics
Question in plain words: Does the bid field mean the next bid amount or a confidential maximum?
Needs a person who can: decide what a bid amount means.

- Option A — Next-bid amount. Cost: none (current placeholder). Risk: no proxy bidding in MVP. Unlocks: keep current resolver; earliest slice: none.
- Option B — Maximum/proxy input. Cost: new bid engine and privacy rules. Risk: tie-breaking and leakage if incomplete. Unlocks: implement proxy bidding and maximum privacy; earliest slice: Slice 13+.

### §3 #3 — Bid increments
Question in plain words: What are the bid increments by price band or category?
Needs a person who can: approve the bid-increment schedule.

- Option A — Keep a single flat increment. Cost: none. Risk: poor UX at high prices. Unlocks: keep `AUCTION_BID_INCREMENT_MINOR`; earliest slice: none.
- Option B — Approved band/category schedule. Cost: config and tests. Risk: incorrect bands reject valid bids. Unlocks: add increment schedule resolver and validation; earliest slice: Slice 13+.

### §3 #4 — Proxy maximum tie-breaking
Question in plain words: How are equal proxy maximums resolved?
Needs a person who can: decide the tie-break rule.

- Option A — Earliest maximum wins. Cost: ordering rule and audit. Risk: perceived unfairness to later bidders. Unlocks: ordered proxy queue; earliest slice: Slice 13+.
- Option B — Deterministic random tie-break. Cost: randomness policy and audit. Risk: requires approved fairness wording. Unlocks: seeded tie-break with recorded outcome; earliest slice: Slice 13+.

### §3 #5 — Snipe-protection window / extension
Question in plain words: What is the snipe trigger window and extension duration?
Needs a person who can: decide the snipe window and extension length.

- Option A — No snipe protection. Cost: none. Risk: last-second bids win without extension. Unlocks: keep disabled; earliest slice: none.
- Option B — Fixed window and extension. Cost: close-job changes. Risk: extension loops if a cap is missing. Unlocks: extend close logic with window; earliest slice: Slice 13+.

### §3 #6 — Maximum number of extensions
Question in plain words: Is there a cap on snipe extensions, and what is it?
Needs a person who can: decide the extension cap.

- Option A — No cap. Cost: none. Risk: indefinite auctions. Unlocks: leave disabled; earliest slice: none.
- Option B — Numeric cap. Cost: counter column and tests. Risk: arbitrary value if unapproved. Unlocks: persist extension count and enforce cap; earliest slice: Slice 13+.

### §3 #7 — Reserve prices in MVP
Question in plain words: Are reserve prices enabled in MVP?
Needs a person who can: decide whether reserves are in the MVP.

- Option A — Disabled. Cost: none. Risk: low-price sales allowed. Unlocks: keep the column unused; earliest slice: none.
- Option B — Enabled. Cost: reserve validation and close outcome. Risk: reserve status leaks if the visibility rule is missing. Unlocks: read reserve at close; earliest slice: Slice 13+.

### §3 #8 — Reserve visibility to bidders
Question in plain words: Is reserve status visible to bidders?
Needs a person who can: decide bidder visibility of reserve status.

- Option A — Not visible. Cost: none. Risk: bidders cannot tell if the reserve is met. Unlocks: no exposure; earliest slice: none.
- Option B — Visible flag. Cost: public field and copy review. Risk: strategic bidding effects. Unlocks: add a public safe field; earliest slice: Slice 13+.

### §3 #9 — Seller cancellation after first bid
Question in plain words: May a seller cancel after the first bid, and on what grounds?
Needs a person who can: decide seller cancellation grounds.

- Option A — No cancellation after first bid. Cost: none. Risk: seller stuck with an unwanted sale. Unlocks: keep `canCancel` no-bid-only; earliest slice: none.
- Option B — Allowed with reason and audit. Cost: mutation, reason validation and notice. Risk: buyer trust impact. Unlocks: add a cancel-after-bid path; earliest slice: Slice 13+.

### §3 #14 — Suspended user while bidding
Question in plain words: What happens to in-flight bids if a user is suspended?
Needs a person who can: decide the suspended-bidder rule.

- Option A — Reject further bids, keep prior bids. Cost: none (current gate). Risk: a suspended user may still win. Unlocks: document the rule; earliest slice: none.
- Option B — Void open bids on suspension. Cost: bid invalidation job. Risk: auction outcome changes after close. Unlocks: add suspension-aware bid invalidation; earliest slice: Slice 13+.

### FR-004 — Email change / re-verification
Question in plain words: Is email change supported in Phase 1, and what re-verification is required?
Needs a person who can: decide the account self-service scope.

- Option A — Exclude from Phase 1. Cost: none. Risk: users cannot correct a mistyped email. Unlocks: document out of scope; earliest slice: none.
- Option B — Add change with re-verification. Cost: token flow and audit. Risk: takeover path if verification is weak. Unlocks: request/confirm email change, revoke sessions, audit; earliest slice: Slice 13+.

### FR-072 — Evidence uploads / separate support-request workflow
Question in plain words: Are evidence attachments and a separate support-request workflow in MVP, and what storage and retention apply?
Needs a person who can: decide the evidence and support-workflow scope.

- Option A — Keep disputes without attachments. Cost: none. Risk: no evidence trail for disputes. Unlocks: document the gap; earliest slice: none.
- Option B — Add uploads and object storage. Cost: storage, access control and retention. Risk: privacy exposure if misconfigured. Unlocks: upload service, object storage, retention job; earliest slice: Slice 13+.

### FR-073 — Approved dispute outcomes and evidence window
Question in plain words: What are the approved resolution outcomes, reason codes and evidence window?
Needs a person who can: approve the dispute resolution policy.

- Option A — Keep placeholders. Cost: none. Risk: resolutions are NOT FOR PRODUCTION. Unlocks: keep current enums; earliest slice: none.
- Option B — Approve policy. Cost: policy drafting and ops review. Risk: wrong window causes unfair outcomes. Unlocks: replace placeholders with approved values; earliest slice: Slice 13+.

### §9 #10 — Product owner sign-off of all P0 requirements
Question in plain words: Who signs off, on what evidence, and when?
Needs a person who can: give named sign-off of all P0 requirements.

- Option A — No named sign-off. Cost: none. Risk: §9 #10 stays not met. Unlocks: no build; earliest slice: none.
- Option B — Named sign-off. Cost: review of traceability and deferrals. Risk: falsified completion if gaps are ignored. Unlocks: record signed acceptance; earliest slice: pre-launch.

### §8 #1–#10 — Product and operations
Question in plain words: Approved categories, moderation model, support hours and languages, dispute policy, SLAs, availability/RPO/RTO, rollout, launch traffic, analytics tools and design spec?
Needs a person who can: approve the product and operations model.

- Option A — Keep placeholders. Cost: none. Risk: launch scope and SLOs undefined. Unlocks: keep placeholder categories and copy; earliest slice: none.
- Option B — Approve operational model. Cost: product and ops review. Risk: commitments may be unachievable. Unlocks: approved taxonomy, moderation policy, SLO dashboards; earliest slice: Slice 13+ / pre-launch.

### §10 — All approvals remain Open
Question in plain words: Who approves MVP scope, auction rules, fee model, payment architecture, shipping, privacy/legal, cloud architecture and UI/UX?
Needs a person who can: assign named approvers for the Open approvals.

- Option A — Leave all Open. Cost: none. Risk: nothing is production-authorized. Unlocks: no build; earliest slice: none.
- Option B — Assign named owners and approve. Cost: multi-party review. Risk: dependencies between approvals. Unlocks: record approvals with dates; earliest slice: pre-launch.

Decision, name, date: ________________

## finance — 9 decisions

### FR-044 — Provider-level chargebacks / disputes / negative balances
Question in plain words: How are chargebacks, provider disputes and negative seller balances handled?
Needs a person who can: approve chargeback and negative-balance handling.

- Option A — Internal records only. Cost: none. Risk: provider chargebacks unhandled and unreconciled. Unlocks: keep internal `refunds` and `payment.failed`; earliest slice: none.
- Option B — Provider event reconciliation. Cost: webhook model and finance workflow. Risk: depends on the FR-042 provider choice. Unlocks: chargeback event table, reconciliation job and audit; earliest slice: Slice 13+.

### FR-045 — Approved fee model
Question in plain words: Who pays the 8% commission, on what base, with which refundability and category rates?
Needs a person who can: approve the fee figures and disclosure.

- Option A — Keep the 800 bps buyer-fee placeholder. Cost: none. Risk: displayed fees are unapproved and may be wrong. Unlocks: keep placeholder fee rule; earliest slice: none.
- Option B — Approve the full model. Cost: finance review and reconciliation. Risk: revenue-model inconsistencies unresolved (docs/16 §9). Unlocks: implement approved payer/base/refund rules and disclosure; earliest slice: Slice 13+.

### §3 #10 — Non-payment outcome for winner
Question in plain words: What happens when the winner does not pay?
Needs a person who can: decide the non-payment outcome.

- Option A — Order stays awaiting_payment. Cost: none. Risk: stock stalls, no relist rule. Unlocks: document; earliest slice: none.
- Option B — Cancel and relist after deadline. Cost: job and notices. Risk: needs an approved non-payment policy. Unlocks: deadline job and outcome rules; earliest slice: Slice 13+.

### §3 #11 — Time allowed to pay
Question in plain words: How long does the winner have to pay?
Needs a person who can: decide the payment deadline.

- Option A — No enforced deadline. Cost: none. Risk: indefinite unpaid orders. Unlocks: document; earliest slice: none.
- Option B — Fixed window. Cost: timer/job and notices. Risk: arbitrary value if unapproved. Unlocks: due-at field and expiry job; earliest slice: Slice 13+.

### §3 #12 — Verified payment method before bidding
Question in plain words: Must bidders add a verified payment method before bidding?
Needs a person who can: decide bidder eligibility for payment verification.

- Option A — No pre-authorization. Cost: none. Risk: unpaid wins. Unlocks: keep current eligibility; earliest slice: none.
- Option B — Require verified method. Cost: provider integration and gate. Risk: reduces bidder conversion. Unlocks: eligibility check at `placeBid`; earliest slice: Slice 13+.

### §3 #13 — Deposits / pre-authorizations for high-value bids
Question in plain words: Are deposits or pre-authorizations required for high-value bids?
Needs a person who can: decide deposit or hold thresholds.

- Option A — None. Cost: none. Risk: high-value default exposure. Unlocks: document; earliest slice: none.
- Option B — Threshold-based hold. Cost: provider hold flow and release rules. Risk: legal/provider approval needed. Unlocks: hold/release workflow; earliest slice: Slice 13+.

### §4 #1–#11 — Fee and revenue model
Question in plain words: Commission payer/base/refunds, category rates, listing-fee timing, subscriptions, featured/advertising pricing and revenue reconciliation?
Needs a person who can: approve the full fee and revenue model.

- Option A — Keep all values as placeholders. Cost: none. Risk: financial reporting and disclosure unapproved. Unlocks: keep placeholder rules; earliest slice: none.
- Option B — Approve the full model. Cost: finance and legal review. Risk: docs/16 §9 inconsistencies must be resolved first. Unlocks: implement approved fee/entitlement rules; earliest slice: Slice 13+.

### §5 #1–#10 — Payment architecture
Question in plain words: Processor, account model, merchant of record, KYC split, capture timing, payout timing, refunds/chargebacks, PayPal timing and escrow meaning?
Needs a person who can: approve payment architecture and money movement.

- Option A — Keep sandbox-only. Cost: none. Risk: no real money path. Unlocks: keep the flag OFF; earliest slice: none.
- Option B — Approve architecture. Cost: contracting and legal review. Risk: depends on the FR-042 provider questions. Unlocks: implement approved architecture; earliest slice: Slice 13+.

### §9 — Source financial/TOC/leadership inconsistencies
Question in plain words: Which figure is authoritative for commission, revenue, GMV, marketing budget and leadership names?
Needs a person who can: reconcile the authoritative financial and leadership figures.

- Option A — Leave unresolved. Cost: none. Risk: financial model cannot be approved. Unlocks: no build; earliest slice: none.
- Option B — Reconcile and record approved figures. Cost: finance review. Risk: changes stated business plan numbers. Unlocks: update financial config/docs after approval; earliest slice: Slice 13+.

Decision, name, date: ________________

## engineering lead — 3 decisions

### FR-042 — Hosted/tokenized payment collection (NOT MET)
Question in plain words: Which provider is the MVP primary processor? The pack also asks: which account type and charge model apply; which merchant-of-record model applies; what the seller onboarding/KYC split is; when payment is captured (winning bid, checkout or shipment); whether authorization is required before bidding; when seller payout is released; how reserves, refunds, chargebacks and negative balances are handled; whether PayPal is available at launch or later; and what "escrow" means and whether it is legally/provider approved.
Needs a person who can: authorize integration work and the contract it depends on.

- Option A — Keep flag OFF / fake adapter. Cost: none. Risk: FR-042 remains NOT MET and no real money can be collected. Unlocks: no build; earliest slice: none.
- Option B — Contract and integrate a provider after the questions are answered by the owner. Cost: integration, legal review and audit. Risk: no named choice is made here, so the outcome depends on the owner's decision. Unlocks: provider adapter, hosted checkout, webhook verification, payout/refund reconciliation; earliest slice: Slice 13+.

### §9 #7 — External security review and remediation
Question in plain words: Who performs the external security review and what remediation bar applies?
Needs a person who can: commission an external review and set the remediation bar.

- Option A — Automated scans only. Cost: none. Risk: §9 #7 remains partial. Unlocks: keep CI scans; earliest slice: none.
- Option B — Commission external review. Cost: vendor and remediation time. Risk: findings may require rework. Unlocks: remediate findings, re-test; earliest slice: pre-launch.

### §9 #8 — Backup and restore drill
Question in plain words: What backup policy, RPO/RTO and drill cadence are required?
Needs a person who can: set the backup policy, RPO/RTO and drill cadence.

- Option A — No drill. Cost: none. Risk: no verified recovery path. Unlocks: no build; earliest slice: none.
- Option B — Define and execute drill. Cost: ops time. Risk: may expose backup gaps. Unlocks: automated backup and restore drill evidence; earliest slice: pre-launch.

Decision, name, date: ________________

## operations — 3 decisions

### FR-051 — Real shipping rates and estimates
Question in plain words: Are shipping or pickup mandatory, who pays, which provinces and carriers apply, and are rates address-derived?
Needs a person who can: approve carrier rates and shipping obligations.

- Option A — Keep flat placeholder (0). Cost: none. Risk: displayed estimate is NOT FOR PRODUCTION. Unlocks: keep `flatShippingEstimateMinor`; earliest slice: none.
- Option B — Approve carrier-rate model. Cost: carrier integration and contracts. Risk: rate accuracy and launch scope. Unlocks: carrier rate lookup and address-based estimate; earliest slice: Slice 13+.

### §9 #9 — Alert routes and on-call
Question in plain words: Which alert routes, escalation tiers and on-call roster apply?
Needs a person who can: set alert routes, escalation and the on-call roster.

- Option A — In-process metrics/health only. Cost: none. Risk: no operational response. Unlocks: no build; earliest slice: none.
- Option B — Define routing and on-call. Cost: tooling and staffing. Risk: rota coverage gaps. Unlocks: alert rules, routes and runbooks; earliest slice: pre-launch.

### §6 #1–#9 — Shipping and fulfilment rules
Question in plain words: Shipping obligation, pickup options, shipping payer, provinces, cross-border, first carrier, own labels, lost/damaged handling and pickup no-shows?
Needs a person who can: approve shipping and fulfilment rules.

- Option A — Keep manual fulfilment only. Cost: none. Risk: estimates and obligations unapproved. Unlocks: keep manual shipments; earliest slice: none.
- Option B — Approve fulfilment policy. Cost: ops and carrier planning. Risk: launch scope growth. Unlocks: carrier integration and rules; earliest slice: Slice 13+.

Decision, name, date: ________________

## counsel — 2 decisions

### §9 #6 — Approved privacy notice, terms, auction rules, fee disclosure, refund policy
Question in plain words: Which documents are approved and by which named owner?
Needs a person who can: approve the legal document set and name the owners.

- Option A — No approved documents. Cost: none. Risk: launch criterion §9 #6 stays not met. Unlocks: no build; earliest slice: none.
- Option B — Approve full set. Cost: legal review. Risk: wording must align to approved policies. Unlocks: publish approved copy/versioning; earliest slice: pre-launch.

### §7 #1–#10 — Identity, privacy and trust
Question in plain words: Seller/buyer identity checks, business documents, age limits, prohibited items, appeals, retention, privacy workflows, provinces and legal-counsel approval?
Needs a person who can: approve identity, privacy and trust policy.

- Option A — Keep placeholders. Cost: none. Risk: verification and privacy obligations unmet. Unlocks: keep current verification stub; earliest slice: none.
- Option B — Approve full policy. Cost: legal review. Risk: stricter checks may reduce onboarding. Unlocks: verification workflows, retention jobs, privacy request handling; earliest slice: pre-launch.

Decision, name, date: ________________
