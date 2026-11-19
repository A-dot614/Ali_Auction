# Owner decision forms

Return the completed form to the owner role named in each section; the owner transfers the choice, their name and the date into the matching row of `docs-implementation/decision-log.md`. Engineering will not start decision-gated work until that decision-log row is filled. These forms are working copies, not a decision record. No payment provider is named, chosen or recommended here.

## product owner — 18 decisions

1. **FR-021 — Eligible buyer bids while open (flag OFF for all users)**

   Question: Under which approved auction rules may live bidding be enabled for real users?

   Options (copied from the decision pack):
   - A) Keep flag OFF — cost: no user can bid; risk: MVP bidding requirement stays partial.
   - B) Enable after §3 rules are decided — cost: flag rollout + monitoring; risk: live bidding on unapproved rules if sequencing slips.

   Your choice: ____

   Decided by (name): ____

   Date: ____

2. **FR-025 — Reserve and snipe-protection enforcement**

   Question: Are reserves and snipe protection in MVP, and what are the trigger, extension cap and bidder visibility?

   Options (copied from the decision pack):
   - A) Keep both disabled — cost: none; risk: auctions close without anti-snipe protection, outcomes differ from plan.
   - B) Enable with approved parameters — cost: state machine + config + tests; risk: wrong extension rule produces disputed outcomes.

   Your choice: ____

   Decided by (name): ____

   Date: ____

3. **§3 #1 — Auction format**

   Question: Are auctions English ascending only?

   Options (copied from the decision pack):
   - A) Confirm English ascending only — cost: documentation; risk: other formats cannot be added later without redesign.
   - B) Allow another format — cost: new state machine and bidding rules; risk: Schedule 1–4 scope growth.

   Your choice: ____

   Decided by (name): ____

   Date: ____

4. **§3 #2 — Bid input semantics**

   Question: Does the bid field mean the next bid amount or a confidential maximum?

   Options (copied from the decision pack):
   - A) Next-bid amount — cost: none (current placeholder); risk: no proxy bidding in MVP.
   - B) Maximum/proxy input — cost: new bid engine + privacy rules; risk: tie-breaking and leakage if incomplete.

   Your choice: ____

   Decided by (name): ____

   Date: ____

5. **§3 #3 — Bid increments**

   Question: What are the bid increments by price band or category?

   Options (copied from the decision pack):
   - A) Keep single flat increment — cost: none; risk: poor UX at high prices.
   - B) Approved band/category schedule — cost: config + tests; risk: incorrect bands reject valid bids.

   Your choice: ____

   Decided by (name): ____

   Date: ____

6. **§3 #4 — Proxy maximum tie-breaking**

   Question: How are equal proxy maximums resolved?

   Options (copied from the decision pack):
   - A) Earliest maximum wins — cost: ordering rule + audit; risk: perceived unfairness to later bidders.
   - B) Deterministic random tie-break — cost: randomness policy + audit; risk: requires approved fairness wording.

   Your choice: ____

   Decided by (name): ____

   Date: ____

7. **§3 #5 — Snipe-protection window / extension**

   Question: What is the snipe trigger window and extension duration?

   Options (copied from the decision pack):
   - A) No snipe protection — cost: none; risk: last-second bids win without extension.
   - B) Fixed window + extension — cost: close-job changes; risk: extension loops if cap missing.

   Your choice: ____

   Decided by (name): ____

   Date: ____

8. **§3 #6 — Maximum number of extensions**

   Question: Is there a cap on snipe extensions, and what is it?

   Options (copied from the decision pack):
   - A) No cap — cost: none; risk: indefinite auctions.
   - B) Numeric cap — cost: counter column + tests; risk: arbitrary value if unapproved.

   Your choice: ____

   Decided by (name): ____

   Date: ____

9. **§3 #7 — Reserve prices in MVP**

   Question: Are reserve prices enabled in MVP?

   Options (copied from the decision pack):
   - A) Disabled — cost: none; risk: low-price sales allowed.
   - B) Enabled — cost: reserve validation + close outcome; risk: reserve status leaks if visibility rule missing.

   Your choice: ____

   Decided by (name): ____

   Date: ____

10. **§3 #8 — Reserve visibility to bidders**

    Question: Is reserve status visible to bidders?

    Options (copied from the decision pack):
    - A) Not visible — cost: none; risk: bidders cannot tell if reserve is met.
    - B) Visible flag — cost: public field + copy review; risk: strategic bidding effects.

    Your choice: ____

    Decided by (name): ____

    Date: ____

11. **§3 #9 — Seller cancellation after first bid**

    Question: May a seller cancel after the first bid, and on what grounds?

    Options (copied from the decision pack):
    - A) No cancellation after first bid — cost: none; risk: seller stuck with unwanted sale.
    - B) Allowed with reason + audit — cost: mutation, reason validation, notice; risk: buyer trust impact.

    Your choice: ____

    Decided by (name): ____

    Date: ____

12. **§3 #14 — Suspended user while bidding**

    Question: What happens to in-flight bids if a user is suspended?

    Options (copied from the decision pack):
    - A) Reject further bids, keep prior bids — cost: none (current gate); risk: suspended user may still win.
    - B) Void open bids on suspension — cost: bid invalidation job; risk: auction outcome changes after close.

    Your choice: ____

    Decided by (name): ____

    Date: ____

13. **FR-004 — Email change / re-verification**

    Question: Is email change supported in Phase 1, and what re-verification is required?

    Options (copied from the decision pack):
    - A) Exclude from Phase 1 — cost: none; risk: users cannot correct a mistyped email.
    - B) Add change with re-verification — cost: token flow + audit; risk: takeover path if verification is weak.

    Your choice: ____

    Decided by (name): ____

    Date: ____

14. **FR-072 — Evidence uploads / separate support-request workflow**

    Question: Are evidence attachments and a separate support-request workflow in MVP, and what storage/retention applies?

    Options (copied from the decision pack):
    - A) Keep disputes without attachments — cost: none; risk: no evidence trail for disputes.
    - B) Add uploads + object storage — cost: storage, access control, retention; risk: privacy exposure if misconfigured.

    Your choice: ____

    Decided by (name): ____

    Date: ____

15. **FR-073 — Approved dispute outcomes and evidence window**

    Question: What are the approved resolution outcomes, reason codes and evidence window?

    Options (copied from the decision pack):
    - A) Keep placeholders — cost: none; risk: resolutions are NOT FOR PRODUCTION.
    - B) Approve policy — cost: policy drafting + ops review; risk: wrong window causes unfair outcomes.

    Your choice: ____

    Decided by (name): ____

    Date: ____

16. **§9 #10 — Product owner sign-off of all P0 requirements**

    Question: Who signs off, on what evidence, and when?

    Options (copied from the decision pack):
    - A) No named sign-off — cost: none; risk: §9 #10 stays not met.
    - B) Named sign-off — cost: review of traceability + deferrals; risk: falsified completion if gaps are ignored.

    Your choice: ____

    Decided by (name): ____

    Date: ____

17. **§8 #1–#10 — Product and operations**

    Question: Approved categories, moderation model, support hours/languages, dispute policy, SLAs, availability/RPO/RTO, rollout, launch traffic, analytics tools and design spec?

    Options (copied from the decision pack):
    - A) Keep placeholders — cost: none; risk: launch scope and SLOs undefined.
    - B) Approve operational model — cost: product + ops review; risk: commitments may be unachievable.

    Your choice: ____

    Decided by (name): ____

    Date: ____

18. **§10 — All approvals remain Open**

    Question: Who approves MVP scope, auction rules, fee model, payment architecture, shipping, privacy/legal, cloud architecture and UI/UX?

    Options (copied from the decision pack):
    - A) Leave all Open — cost: none; risk: nothing is production-authorized.
    - B) Assign named owners and approve — cost: multi-party review; risk: dependencies between approvals.

    Your choice: ____

    Decided by (name): ____

    Date: ____

Write only the option you choose, or write 'defer' with a reason. Do not write 'approved' alone.

## finance — 9 decisions

1. **FR-044 — Provider-level chargebacks / disputes / negative balances**

   Question: How are chargebacks, provider disputes and negative seller balances handled?

   Options (copied from the decision pack):
   - A) Internal records only — cost: none; risk: provider chargebacks unhandled and unreconciled.
   - B) Provider event reconciliation — cost: webhook model + finance workflow; risk: depends on FR-042 provider choice.

   Your choice: ____

   Decided by (name): ____

   Date: ____

2. **FR-045 — Approved fee model**

   Question: Who pays the 8% commission, on what base, with which refundability and category rates?

   Options (copied from the decision pack):
   - A) Keep 800 bps buyer-fee placeholder — cost: none; risk: displayed fees are unapproved and may be wrong.
   - B) Approve full model — cost: finance review + reconciliation; risk: revenue-model inconsistencies unresolved (docs/16 §9).

   Your choice: ____

   Decided by (name): ____

   Date: ____

3. **§3 #10 — Non-payment outcome for winner**

   Question: What happens when the winner does not pay?

   Options (copied from the decision pack):
   - A) Order stays awaiting_payment — cost: none; risk: stock stalls, no relist rule.
   - B) Cancel + relist after deadline — cost: job + notices; risk: needs approved deadbeat policy.

   Your choice: ____

   Decided by (name): ____

   Date: ____

4. **§3 #11 — Time allowed to pay**

   Question: How long does the winner have to pay?

   Options (copied from the decision pack):
   - A) No enforced deadline — cost: none; risk: indefinite unpaid orders.
   - B) Fixed window — cost: timer/job + notices; risk: arbitrary value if unapproved.

   Your choice: ____

   Decided by (name): ____

   Date: ____

5. **§3 #12 — Verified payment method before bidding**

   Question: Must bidders add a verified payment method before bidding?

   Options (copied from the decision pack):
   - A) No pre-authorization — cost: none; risk: unpaid wins.
   - B) Require verified method — cost: provider integration + gate; risk: reduces bidder conversion.

   Your choice: ____

   Decided by (name): ____

   Date: ____

6. **§3 #13 — Deposits / pre-authorizations for high-value bids**

   Question: Are deposits or pre-authorizations required for high-value bids?

   Options (copied from the decision pack):
   - A) None — cost: none; risk: high-value default exposure.
   - B) Threshold-based hold — cost: provider hold flow + release rules; risk: legal/provider approval needed.

   Your choice: ____

   Decided by (name): ____

   Date: ____

7. **§4 #1–#11 — Fee and revenue model**

   Question: Commission payer/base/refunds, category rates, listing-fee timing, subscriptions, featured/advertising pricing and revenue reconciliation?

   Options (copied from the decision pack):
   - A) Keep all values as placeholders — cost: none; risk: financial reporting and disclosure unapproved.
   - B) Approve the full model — cost: finance + legal review; risk: docs/16 §9 inconsistencies must be resolved first.

   Your choice: ____

   Decided by (name): ____

   Date: ____

8. **§5 #1–#10 — Payment architecture**

   Question: Processor, account model, merchant of record, KYC split, capture timing, payout timing, refunds/chargebacks, PayPal timing and escrow meaning?

   Options (copied from the decision pack):
   - A) Keep sandbox-only — cost: none; risk: no real money path.
   - B) Approve architecture — cost: contracting + legal review; risk: depends on FR-042 provider questions.

   Your choice: ____

   Decided by (name): ____

   Date: ____

9. **§9 — Source financial/TOC/leadership inconsistencies**

   Question: Which figure is authoritative for commission, revenue, GMV, marketing budget and leadership names?

   Options (copied from the decision pack):
   - A) Leave unresolved — cost: none; risk: financial model cannot be approved.
   - B) Reconcile and record approved figures — cost: finance review; risk: changes stated business plan numbers.

   Your choice: ____

   Decided by (name): ____

   Date: ____

Write only the option you choose, or write 'defer' with a reason. Do not write 'approved' alone.

## engineering lead — 3 decisions

1. **FR-042 — Hosted/tokenized payment collection (NOT MET)**

   Questions (copied from the decision pack; no provider is chosen or recommended):
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

   Options (copied from the decision pack):
   - A) Keep flag OFF / fake adapter — cost: none; risk: FR-042 remains NOT MET and no real money can be collected.
   - B) Contract and integrate a provider after the questions are answered by the owner — cost: integration, legal review and audit; risk: no named recommendation is made here, so outcome depends on owner choice.

   Your choice: ____

   Decided by (name): ____

   Date: ____

2. **§9 #7 — External security review and remediation**

   Question: Who performs the external review and what remediation bar applies?

   Options (copied from the decision pack):
   - A) Automated scans only — cost: none; risk: §9 #7 remains partial.
   - B) Commission external review — cost: vendor + remediation time; risk: findings may require rework.

   Your choice: ____

   Decided by (name): ____

   Date: ____

3. **§9 #8 — Backup and restore drill**

   Question: What backup policy, RPO/RTO and drill cadence are required?

   Options (copied from the decision pack):
   - A) No drill — cost: none; risk: no verified recovery path.
   - B) Define and execute drill — cost: ops time; risk: may expose backup gaps.

   Your choice: ____

   Decided by (name): ____

   Date: ____

Write only the option you choose, or write 'defer' with a reason. Do not write 'approved' alone.

## operations — 3 decisions

1. **FR-051 — Real shipping rates and estimates**

   Question: Are shipping/pickup mandatory, who pays, which provinces/carriers, and are rates address-derived?

   Options (copied from the decision pack):
   - A) Keep flat placeholder (0) — cost: none; risk: displayed estimate is NOT FOR PRODUCTION.
   - B) Approve carrier-rate model — cost: carrier integration + contracts; risk: rate accuracy and launch scope.

   Your choice: ____

   Decided by (name): ____

   Date: ____

2. **§9 #9 — Alert routes and on-call**

   Question: Which alert routes, escalation tiers and on-call roster apply?

   Options (copied from the decision pack):
   - A) In-process metrics/health only — cost: none; risk: no operational response.
   - B) Define routing + on-call — cost: tooling + staffing; risk: rota coverage gaps.

   Your choice: ____

   Decided by (name): ____

   Date: ____

3. **§6 #1–#9 — Shipping and fulfilment rules**

   Question: Shipping obligation, pickup options, shipping payer, provinces, cross-border, first carrier, own labels, lost/damaged handling and pickup no-shows?

   Options (copied from the decision pack):
   - A) Keep manual fulfilment only — cost: none; risk: estimates and obligations unapproved.
   - B) Approve fulfilment policy — cost: ops + carrier planning; risk: launch scope growth.

   Your choice: ____

   Decided by (name): ____

   Date: ____

Write only the option you choose, or write 'defer' with a reason. Do not write 'approved' alone.

## counsel — 2 decisions

1. **§9 #6 — Approved privacy notice, terms, auction rules, fee disclosure, refund policy**

   Question: Which documents are approved and by which named owner?

   Options (copied from the decision pack):
   - A) No approved documents — cost: none; risk: launch criterion §9 #6 stays not met.
   - B) Approve full set — cost: legal review; risk: wording must align to approved policies.

   Your choice: ____

   Decided by (name): ____

   Date: ____

2. **§7 #1–#10 — Identity, privacy and trust**

   Question: Seller/buyer identity checks, business documents, age limits, prohibited items, appeals, retention, privacy workflows, provinces and legal-counsel approval?

   Options (copied from the decision pack):
   - A) Keep placeholders — cost: none; risk: verification and privacy obligations unmet.
   - B) Approve full policy — cost: legal review; risk: stricter checks may reduce onboarding.

   Your choice: ____

   Decided by (name): ____

   Date: ____

Write only the option you choose, or write 'defer' with a reason. Do not write 'approved' alone.

Forms do not record decisions. The decision log is the only record.
