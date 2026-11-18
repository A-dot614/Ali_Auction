Technical detail is in docs-implementation/PHASE1_STATUS.md and docs-implementation/phase1-decision-pack.md.

# AliAuction.ca: owner status summary (Phase 1, branch phase1/slices-0-3a at e99edfa)

## What AliAuction.ca is

AliAuction.ca is a Canadian marketplace where people sell items through auctions that run for a set time. Buyers browse or search listings, place bids, and the system records the winner, the order, and the messages between the parties.

## What already works

- People can register, confirm their email, sign in, and reset their password.
- Sellers can set up a profile, be approved by staff, and create and publish listings.
- Listings can be searched and browsed.
- Auctions can be set up and closed in testing, with bids recorded and a winner chosen.
- Winning an auction creates an order, with fees shown before payment.
- Staff can review reports, suspend users, hide listings, and handle disputes with an audit record.
- Buyers and sellers receive notices about bids, orders, and outcomes.

## What does not work yet

- Real payments: no payment company is connected, every payment today is pretend, and taking real money from buyers is switched off for everyone.
- Shipping costs: buyers see only a placeholder amount, currently zero, with no real delivery rates and no calculation based on the destination.
- Disputes involving the payment company: if a buyer challenges a charge with their bank or the payment company, the platform does not handle that; disputes cannot yet include attached evidence, and the reason codes and outcomes are still temporary.
- Launch safeguards: there are no approved legal policies, no outside security review, no proven backup-and-restore drill, no alerting or on-call cover, and no named sign-off.

## Can it launch to the public today?

No. Real money cannot be collected and the required legal, safety, and sign-off checks are not in place.

## Decisions owners must make

**Product owner**
- Which auction and dispute rules do we approve before we sign off that the required features are acceptable?

**Finance**
- Which payment company and account arrangement do we use, and who is legally the seller of record?

**Legal / counsel**
- Which privacy notice, terms, auction rules, and refund policy do we approve before launch?

**Operations**
- Which provinces, delivery companies, and support hours do we offer at launch?

**Engineering lead**
- How do we fund and pass an outside security review and a backup-and-restore drill?

## Next actions, in order

1. Product owner approves the remaining auction and dispute rules and gives named sign-off.
2. Finance and the engineering lead settle the payment arrangement and the final fee, refund, and payout rules.
3. Counsel approves the legal policies and the identity and trust checks.
4. Operations decides shipping, support cover, and launch scope; engineering passes the outside security review and backup drill.
5. Only after all of the above, enable real bidding and a controlled public launch.

Phase 1 is not complete for development. No production readiness is claimed. The next step needs owner decisions.
