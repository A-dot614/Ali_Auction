# Decision log. Each row is filled only by the named owner role. Empty means no decision yet.

| Decision ID | Question | Owner role | Decision made | Options chosen | Decided by | Date | Evidence or reference |
|---|---|---|---|---|---|---|---|
| FR-021 — Eligible buyer bids while open (flag OFF for all users) | Under which approved auction rules may live bidding be enabled for real users? | product owner |  |  |  |  |  |
| FR-025 — Reserve and snipe-protection enforcement | Are reserves and snipe protection in MVP, and what are the trigger, extension cap and bidder visibility? | product owner |  |  |  |  |  |
| §3 #1 — Auction format | Are auctions English ascending only? | product owner |  |  |  |  |  |
| §3 #2 — Bid input semantics | Does the bid field mean the next bid amount or a confidential maximum? | product owner |  |  |  |  |  |
| §3 #3 — Bid increments | What are the bid increments by price band or category? | product owner |  |  |  |  |  |
| §3 #4 — Proxy maximum tie-breaking | How are equal proxy maximums resolved? | product owner |  |  |  |  |  |
| §3 #5 — Snipe-protection window / extension | What is the snipe trigger window and extension duration? | product owner |  |  |  |  |  |
| §3 #6 — Maximum number of extensions | Is there a cap on snipe extensions, and what is it? | product owner |  |  |  |  |  |
| §3 #7 — Reserve prices in MVP | Are reserve prices enabled in MVP? | product owner |  |  |  |  |  |
| §3 #8 — Reserve visibility to bidders | Is reserve status visible to bidders? | product owner |  |  |  |  |  |
| §3 #9 — Seller cancellation after first bid | May a seller cancel after the first bid, and on what grounds? | product owner |  |  |  |  |  |
| §3 #14 — Suspended user while bidding | What happens to in-flight bids if a user is suspended? | product owner |  |  |  |  |  |
| FR-042 — Hosted/tokenized payment collection (NOT MET) | Which provider is the MVP primary processor? | engineering lead |  |  |  |  |  |
| FR-044 — Provider-level chargebacks / disputes / negative balances | How are chargebacks, provider disputes and negative seller balances handled? | finance |  |  |  |  |  |
| FR-045 — Approved fee model | Who pays the 8% commission, on what base, with which refundability and category rates? | finance |  |  |  |  |  |
| §3 #10 — Non-payment outcome for winner | What happens when the winner does not pay? | finance |  |  |  |  |  |
| §3 #11 — Time allowed to pay | How long does the winner have to pay? | finance |  |  |  |  |  |
| §3 #12 — Verified payment method before bidding | Must bidders add a verified payment method before bidding? | finance |  |  |  |  |  |
| §3 #13 — Deposits / pre-authorizations for high-value bids | Are deposits or pre-authorizations required for high-value bids? | finance |  |  |  |  |  |
| §4 #1–#11 — Fee and revenue model | Commission payer/base/refunds, category rates, listing-fee timing, subscriptions, featured/advertising pricing and revenue reconciliation? | finance |  |  |  |  |  |
| §5 #1–#10 — Payment architecture | Processor, account model, merchant of record, KYC split, capture timing, payout timing, refunds/chargebacks, PayPal timing and escrow meaning? | finance |  |  |  |  |  |
| §9 — Source financial/TOC/leadership inconsistencies | Which figure is authoritative for commission, revenue, GMV, marketing budget and leadership names? | finance |  |  |  |  |  |
| FR-004 — Email change / re-verification | Is email change supported in Phase 1, and what re-verification is required? | product owner |  |  |  |  |  |
| FR-051 — Real shipping rates and estimates | Are shipping/pickup mandatory, who pays, which provinces/carriers, and are rates address-derived? | operations |  |  |  |  |  |
| FR-072 — Evidence uploads / separate support-request workflow | Are evidence attachments and a separate support-request workflow in MVP, and what storage/retention applies? | product owner |  |  |  |  |  |
| FR-073 — Approved dispute outcomes and evidence window | What are the approved resolution outcomes, reason codes and evidence window? | product owner |  |  |  |  |  |
| §9 #6 — Approved privacy notice, terms, auction rules, fee disclosure, refund policy | Which documents are approved and by which named owner? | counsel |  |  |  |  |  |
| §9 #7 — External security review and remediation | Who performs the external review and what remediation bar applies? | engineering lead |  |  |  |  |  |
| §9 #8 — Backup and restore drill | What backup policy, RPO/RTO and drill cadence are required? | engineering lead |  |  |  |  |  |
| §9 #9 — Alert routes and on-call | Which alert routes, escalation tiers and on-call roster apply? | operations |  |  |  |  |  |
| §9 #10 — Product owner sign-off of all P0 requirements | Who signs off, on what evidence, and when? | product owner |  |  |  |  |  |
| §6 #1–#9 — Shipping and fulfilment rules | Shipping obligation, pickup options, shipping payer, provinces, cross-border, first carrier, own labels, lost/damaged handling and pickup no-shows? | operations |  |  |  |  |  |
| §7 #1–#10 — Identity, privacy and trust | Seller/buyer identity checks, business documents, age limits, prohibited items, appeals, retention, privacy workflows, provinces and legal-counsel approval? | counsel |  |  |  |  |  |
| §8 #1–#10 — Product and operations | Approved categories, moderation model, support hours/languages, dispute policy, SLAs, availability/RPO/RTO, rollout, launch traffic, analytics tools and design spec? | product owner |  |  |  |  |  |
| §10 — All approvals remain Open | Who approves MVP scope, auction rules, fee model, payment architecture, shipping, privacy/legal, cloud architecture and UI/UX? | product owner |  |  |  |  |  |

## Rule

A decision is recorded only when the owner gives a named choice, a person's name, and a date. 'Approved' alone is not a decision. An engineering prompt may cite a row only when all of its cells are filled.
