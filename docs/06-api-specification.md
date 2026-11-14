# API Specification — AliAuction.ca

**Proposed API:** GraphQL for application operations, plus dedicated HTTPS endpoints for provider webhooks and health checks. The business plan specifies GraphQL but does not define a schema.

## 1. API conventions

- Base application endpoint: `/graphql` (proposed).
- Webhook endpoints: `/webhooks/stripe`, `/webhooks/paypal`, and carrier-specific endpoints as required.
- Use HTTPS only.
- Authenticate using secure server-managed sessions or short-lived access tokens with refresh/session rotation.
- Enforce authorization in resolvers/services.
- Use cursor pagination for listings, bids, orders and admin queues.
- Return stable error codes and correlation IDs.
- Require idempotency keys for payment creation, refunds and other retry-sensitive mutations.
- Use server time for auction rules.
- Never expose proxy maximum bids, private addresses, verification documents or provider secrets.

## 2. Core GraphQL domains

### Queries (illustrative)
- `me`
- `mySellerProfile`
- `categories`
- `listings(filter, sort, first, after)`
- `listing(idOrSlug)`
- `auction(id)`
- `auctionBids(auctionId, first, after)` — public bid details only
- `myWatchlist(first, after)`
- `myOrders(status, first, after)`
- `order(id)` — participant or authorized staff only
- `sellerDashboard(range)`
- `adminListings(filter, first, after)` — staff only
- `adminDisputes(status, first, after)` — staff only

### Mutations (illustrative)
- `register(input)`
- `verifyEmail(token)`
- `login(input)` / session operations
- `updateProfile(input)`
- `createSellerProfile(input)`
- `createListingDraft(input)`
- `updateListing(id, input)`
- `submitListingForReview(id)`
- `publishListing(id)` — service/admin controlled
- `placeBid(auctionId, amount, idempotencyKey)`
- `setProxyBid(auctionId, maximum, idempotencyKey)`
- `addToWatchlist(auctionId)`
- `removeFromWatchlist(auctionId)`
- `createCheckout(orderId, fulfilmentChoice, idempotencyKey)`
- `requestRefund(orderId, amount, reason)` — staff permission required
- `openDispute(orderId, reason, description)`
- `resolveDispute(disputeId, resolution)` — staff permission required
- `reportListing(listingId, reason)`
- `markNotificationRead(notificationId)`

These names are examples for schema design, not an existing API.

## 3. Example GraphQL mutation

```graphql
mutation PlaceBid($input: PlaceBidInput!) {
  placeBid(input: $input) {
    accepted
    bid {
      id
      amount {
        minorUnits
        currency
      }
      acceptedAt
    }
    auction {
      id
      status
      currentPrice {
        minorUnits
        currency
      }
      endsAt
    }
    errors {
      code
      message
    }
  }
}
```

The server must validate the auction state and bid rules inside a concurrency-safe transaction. The client must not calculate or decide whether a bid is accepted.

## 4. Error model

Suggested stable codes:
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `LISTING_NOT_PUBLISHED`
- `AUCTION_NOT_OPEN`
- `BID_TOO_LOW`
- `SELLER_CANNOT_BID`
- `BIDDER_NOT_ELIGIBLE`
- `IDEMPOTENCY_CONFLICT`
- `PAYMENT_REQUIRES_ACTION`
- `PAYMENT_FAILED`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Do not return stack traces or provider secrets to clients.

## 5. Real-time events

Socket.io event names (proposed):
- `auction.snapshot`
- `auction.bid.accepted`
- `auction.price.updated`
- `auction.extended`
- `auction.closed`
- `auction.cancelled`
- `notification.created`

Rules:
- Authenticate socket connections.
- Authorize room membership.
- Broadcast only public auction information.
- Never broadcast proxy maximums, personal data or internal fraud flags.
- Events should include event ID, auction ID, event type and server timestamp.
- Clients must recover from missed events by refetching the auction snapshot.

## 6. Webhooks

Provider webhooks must:
1. Verify provider signature against the raw request body.
2. Persist event ID and minimal required payload.
3. Deduplicate by `(provider, provider_event_id)`.
4. Acknowledge promptly after durable receipt.
5. Process asynchronously.
6. Apply state transitions idempotently.
7. Record failures and retry safely.
8. Never trust a browser redirect as proof of payment.

## 7. Security and performance

- Rate-limit registration, login, password reset, bidding, reports and checkout.
- Apply query depth/complexity limits to GraphQL.
- Avoid N+1 query patterns.
- Use field-level authorization for sensitive data.
- Validate all user input server-side.
- Log correlation IDs and outcomes, not secrets or full payment details.
- Define request/response budgets before launch.
