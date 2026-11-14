# Testing and Quality Plan

## 1. Test layers

### Unit tests
- Fee calculations.
- Bid validation and increment logic.
- Proxy-bidding algorithm.
- Auction state transitions.
- Reserve and extension rules.
- Permission checks.
- Subscription entitlement logic.

### Integration tests
- PostgreSQL transactions and concurrency.
- Redis cache/lock behaviour.
- GraphQL authorization.
- Payment provider sandbox and webhook processing.
- Carrier API adapters.
- Search indexing.
- Notification queue.

### End-to-end tests
- Register and verify account.
- Seller creates and publishes listing.
- Buyer places bid.
- Auction closes.
- Winner completes checkout.
- Seller fulfils order.
- Buyer opens dispute.
- Staff resolves case and issues approved refund.

### Non-functional tests
- Load and stress tests for concurrent bidding.
- Soak tests for long-running socket connections.
- Security tests and penetration testing.
- Accessibility tests.
- Responsive browser/device testing.
- Backup restoration and disaster recovery.

## 2. Critical auction test cases

- Simultaneous bids on the same auction.
- Bid received at end-time boundary.
- Bid received after end time.
- Proxy bids compete and tie.
- Snipe protection extends auction correctly.
- Close job runs multiple times.
- Worker restarts during close.
- Database transaction rolls back.
- Socket event is delayed or duplicated.
- Client disconnects and reconnects.
- Suspended bidder tries to bid.
- Seller tries to bid on own item.
- Auction is cancelled with bids present.

## 3. Critical payment test cases

- Successful payment.
- Payment requires additional action.
- Declined payment.
- Buyer closes browser before redirect.
- Duplicate webhook.
- Out-of-order webhook.
- Invalid webhook signature.
- Refund full and partial.
- Refund exceeds captured amount.
- Chargeback/dispute event.
- Provider outage.
- Payment succeeded but local processing failed and must reconcile.

## 4. Authorization test cases

- Buyer cannot view another buyer's address.
- Seller cannot view another seller's orders.
- User cannot modify another user's listing.
- Public API cannot retrieve proxy maximum.
- Support agent cannot issue refund without permission.
- Moderator cannot alter fee configuration.
- Finance operator cannot assign roles.
- Suspended user cannot bid or list.
- Admin access requires MFA.

## 5. Test data

Use synthetic users, listings, auctions and payment-provider test accounts. Never use real payment card data or unredacted identity documents. Include Canadian postal-code formats and provinces in test fixtures.

## 6. Release gates

- All P0 acceptance criteria pass.
- No open critical/high security vulnerabilities.
- Auction concurrency tests pass.
- Payment reconciliation and webhook tests pass.
- Accessibility review completed for critical journeys.
- Performance/load test meets agreed targets.
- Monitoring and alerts are enabled.
- Backup restoration is verified.
- Legal and privacy approvals are recorded.
- Product owner and engineering lead approve release.
