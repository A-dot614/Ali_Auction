# System Architecture — AliAuction.ca

**Architecture status:** Proposed baseline, subject to technical review  
**Business-plan stack:** Next.js/React, Tailwind, Node.js/Express, GraphQL, PostgreSQL, Redis, Socket.io, AWS Canada, Stripe Connect/PayPal, Elasticsearch, React Native, Docker/Kubernetes, GitHub Actions, Datadog.

## 1. Architecture principles

1. Keep financial and auction state changes server-authoritative.
2. Treat PostgreSQL as the durable source of truth.
3. Use Redis for ephemeral coordination/cache, not as the only record of bids or payments.
4. Make payment and auction-close operations idempotent.
5. Separate public marketplace data from private user, payment and moderation data.
6. Use asynchronous jobs for notifications, image processing, search indexing and carrier updates.
7. Start with a modular backend; split into independently deployed services only when scale or team boundaries justify it.
8. Keep production data and backups in approved Canadian regions where required by the final privacy/data-residency assessment.

## 2. Logical architecture

```text
Browser / PWA
   |
   | HTTPS
   v
Next.js Web Application
   |
   | GraphQL over HTTPS
   v
Node.js / Express API
   |---- Authentication & Authorization
   |---- Users / Seller Profiles
   |---- Listings / Categories
   |---- Auction & Bidding Domain
   |---- Orders / Payments
   |---- Shipping / Fulfilment
   |---- Subscriptions / Fees
   |---- Trust / Disputes / Admin
   |
   |---- PostgreSQL (durable relational data)
   |---- Redis (cache, locks, rate limits, transient state)
   |---- Elasticsearch (search index)
   |---- Object Storage (listing images and documents)
   |---- Job Queue / Workers
              |---- Email / SMS / Push
              |---- Payment webhooks
              |---- Carrier APIs
              |---- Image processing / AI
              |---- Analytics events

Socket.io gateway <---- authenticated real-time events ----> Browser/PWA
External providers: Stripe Connect, PayPal, Canada Post, Purolator, UPS
```

## 3. Deployment shape

For the first production release, prefer a modular monolith with separately scalable web, API and worker processes. The business plan mentions Kubernetes; use it when operational maturity and workload justify it. A small MVP can be deployed on managed container infrastructure first, while preserving container portability.

Suggested AWS Canada deployment components:
- VPC with private subnets for database and internal services.
- Public load balancer / ingress for HTTPS traffic.
- Container workloads for web, API, Socket.io and workers.
- Managed PostgreSQL service.
- Managed Redis-compatible cache.
- Object storage for uploaded images and generated documents.
- CDN for public images and static assets.
- Central secrets manager and key management.
- Centralized logs, metrics, tracing and alerting.
- Encrypted backups and tested restore procedures.

**Region note:** The source identifies AWS `ca-central-1` (Montreal). Confirm the exact region and service availability with the cloud architect and privacy counsel.

## 4. Backend module boundaries

| Module | Owns |
|---|---|
| Identity | Users, sessions, verification, MFA |
| Seller | Seller profiles, verification, seller plan entitlements |
| Catalogue | Categories, attributes, listings, media |
| Auction | Auction state, bids, proxy maximums, increments, closing |
| Checkout | Orders, fee snapshots, checkout state |
| Payments | Provider intents, transactions, refunds, payouts and webhooks |
| Fulfilment | Shipping options, labels, tracking, pickup |
| Subscription | Plans, subscriptions, billing events and entitlements |
| Trust & Safety | Reports, moderation, disputes, risk flags |
| Notifications | Templates, preferences, delivery attempts |
| Admin | Role assignment, configuration, audit views |
| Search | Indexing and query orchestration |

## 5. Real-time bidding architecture

1. Browser sends a bid mutation to the API.
2. API authenticates user and checks permissions.
3. Auction service starts a database transaction and locks the auction row (or uses an equivalent concurrency-safe strategy).
4. Service checks auction status, server time, bidder eligibility and minimum bid.
5. Bid is written to PostgreSQL; auction state is updated in the same transaction.
6. An outbox event is committed with the bid.
7. A worker or event publisher broadcasts the accepted bid to authorized auction rooms through Socket.io.
8. Clients reconcile the event with server state; reconnecting clients fetch the latest auction snapshot.

Never accept the browser's displayed countdown or client timestamp as authoritative.

## 6. Background jobs and event processing

Use a durable queue or transactional outbox for:
- Auction start/end scheduling.
- Proxy-bid processing if not performed synchronously.
- Auction close and order creation.
- Payment webhook processing.
- Email/SMS/push delivery.
- Search indexing.
- Image resizing/scanning.
- Shipping tracking updates.
- Subscription renewal reconciliation.
- Fraud/risk review tasks.

All jobs must be retry-safe and idempotent. Dead-letter failed jobs and provide operator visibility.

## 7. Data consistency

- PostgreSQL is the source of truth for users, listings, auctions, bids, orders and payments.
- Payment provider status must be reconciled using signed webhooks and periodic reconciliation.
- Search index is a derived projection and can be rebuilt from database records.
- Redis values may expire and must be reconstructable.
- Notifications are generated from committed domain events, not uncommitted browser actions.

## 8. Security zones

- Public: published listing summaries and public seller storefront details.
- Authenticated: buyer watchlists, bid actions and user profile.
- Participant-only: order details, shipping addresses, dispute evidence.
- Staff-only: moderation queue, risk flags, user verification records.
- Restricted financial: provider references, payout state and reconciliation data.
- Secrets: provider credentials, signing secrets and encryption keys; never expose to browser.

## 9. Key architecture decisions to approve

- GraphQL-only or GraphQL plus REST webhook endpoints.
- Modular monolith versus independently deployed services.
- Queue technology and transactional outbox implementation.
- Managed PostgreSQL and Redis product selection.
- Payment-provider selection and marketplace account model.
- Search platform timing: PostgreSQL search for MVP or Elasticsearch from launch.
- WebSocket scaling and sticky-session/pub-sub strategy.
- Cloud region, backups, RPO/RTO and data-retention design.
