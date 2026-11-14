# Third-Party Integrations Plan

The business plan identifies Stripe Connect, PayPal Business, Canada Post, Purolator, UPS Canada, AWS, Elasticsearch, email/support tooling and Datadog. Exact products, contracts and API capabilities must be verified during procurement.

## 1. Payments — Stripe Connect

Purpose:
- Marketplace payment collection.
- Seller connected accounts.
- Platform fees / split payment flows where supported.
- Refund and payout status.

Implementation requirements:
- Confirm the supported Canadian Connect account model and onboarding requirements.
- Determine whether the platform uses destination charges, separate charges/transfers or another supported flow.
- Define who is merchant of record and who bears chargeback/refund liability.
- Use hosted/tokenized payment UI.
- Store provider IDs and status, not card data.
- Verify signed webhooks.
- Use idempotency keys.
- Reconcile internal order/payment/payout ledgers.

**Decision required:** Stripe Connect is named in the plan, but the exact payment and payout flow is not specified.

## 2. Payments — PayPal Business

The source lists PayPal Business as an additional processor. Decide:
- Whether PayPal is available at MVP or later.
- Whether it supports the required marketplace split/payout model in the intended country/account configuration.
- How refunds, disputes and reconciliation work across both providers.
- Whether buyers choose a provider or routing is controlled by the platform.

Do not assume PayPal Business alone provides all marketplace split-payment functionality.

## 3. Shipping carriers

Carriers named in the plan:
- Canada Post
- Purolator
- UPS Canada

Required capabilities:
- Rate estimates.
- Shipment creation.
- Label generation.
- Tracking number retrieval.
- Tracking updates/webhooks or polling.
- Cancellation/void label.
- Pickup/drop-off options where available.

Data required:
- Origin and destination postal codes.
- Package dimensions and weight.
- Service level.
- Declared value and insurance requirements.
- Customs data for cross-border shipments, if enabled.

MVP can begin with seller-entered shipping cost and manual tracking while carrier contracts and APIs are validated. This is a proposed scope option, not a source-plan commitment.

## 4. Cloud and storage — AWS Canada

The plan identifies `ca-central-1` and EC2, S3, CloudFront and RDS.

Proposed uses:
- Compute/container hosting.
- PostgreSQL managed database.
- Object storage for listing images and documents.
- CDN for static and public media.
- Private networking, key management, secrets and backups.
- Centralized monitoring.

Confirm availability, region coverage, pricing and data residency for every chosen service.

## 5. Search — Elasticsearch

Use for:
- Full-text listing search.
- Faceted category and attribute filters.
- Autocomplete.
- Sorting and relevance ranking.

PostgreSQL remains the source of truth. Search index updates should be driven by reliable outbox events. Provide reindexing and failure-recovery procedures.

For a lean MVP, evaluate whether PostgreSQL full-text search is sufficient until catalogue volume justifies Elasticsearch.

## 6. Email, SMS and push notifications

The source requires email support and an AI chatbot/knowledge base but does not name providers.

Provider selection criteria:
- Canadian deliverability and privacy requirements.
- Transactional templates.
- Bounce/complaint webhooks.
- SMS sender registration and country support.
- Push notification support for later mobile apps.
- Data processing terms and retention.
- Cost and observability.

Events include registration verification, password reset, outbid, auction ending, win/loss, payment, shipping, dispute and subscription notices.

## 7. AI services

Planned later-phase uses:
- Recommendations.
- Fraud detection.
- Image recognition and automatic categorization.
- AI chatbot and knowledge base support.

AI must be advisory for high-impact decisions. Do not automatically suspend users or reject valuable listings solely from an unreviewed model output. Define human review, appeal and monitoring.

## 8. Integration governance

For every integration:
- Name a technical owner.
- Store credentials in secrets manager.
- Maintain sandbox and production configuration separately.
- Document webhook authentication and retry policy.
- Add provider outage handling.
- Track API version and deprecation.
- Monitor latency, error rate and quota usage.
- Maintain manual fallback procedures for critical workflows.
