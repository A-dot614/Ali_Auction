# Orders & payments state diagram (Slice 6, sandbox only)

**Sources:** `apps/api/src/orders/orderStateMachine.ts`, `apps/api/src/payments/paymentStateMachine.ts`
**Migration:** `apps/api/migrations/1700000000700_orders_payments_slice6.js`
**Open decisions:** `docs/16` §4 (fees), §5 (payments), §6 (fulfilment) — placeholders below are NOT FOR PRODUCTION.

## Order states

```text
awaiting_payment ──(payment.succeeded)──> paid ──(seller start_processing)──> processing
        │                                  │                                      │
        │ staff cancel                     │ seller ready_for_pickup              │ seller mark_shipped
        v                                  v                                      v
    cancelled                      ready_for_pickup ──(confirm)──> completed <── shipped
                                                                  (buyer/seller)
```

Allowed: `awaiting_payment → paid | cancelled`; `paid → processing | ready_for_pickup`; `processing → shipped`; `shipped → completed`; `ready_for_pickup → completed`. All other pairs throw `INVALID_ORDER_TRANSITION`. Every transition writes an `order_events` row.

## Payment states (fake provider)

```text
created ──(payment.succeeded)──> captured ──(refund partial)──> refunded_partial
   │                                  │                              │
   └──(payment.failed)──> failed      └──(full refund)────────> refunded <──┘
```

Allowed: `created → captured | failed`; `captured → refunded_partial | refunded`; `refunded_partial → refunded`. All other pairs throw `INVALID_PAYMENT_TRANSITION`. Transitions write `audit_logs` rows.

## Consumer flow (auction.closed → order)

```text
outbox_events (event_type='auction.closed', unprocessed by consumer 'orders')
   | order by created_at, id
   v
for each event (one transaction):
   INSERT processed_events(consumer='orders', event_id) ON CONFLICT DO NOTHING
   |-- conflict -> skip (replay safe)
   +-- closed_sold:
         winning bid -> buyer_user_id (internal)
         auction -> listing -> seller_profile_id
         fee_rules rate -> calculateFeeMinor(hammer, bps)
         INSERT orders (awaiting_payment, hammer/fee/total snapshots)
         INSERT order_fee_lines (immutable snapshot)
         INSERT order_events (NULL -> awaiting_payment)
   +-- closed_unsold -> no order
```

## Webhook flow (fake provider)

```text
POST /webhooks/payments/fake  (express.raw before express.json)
   |
   v
money flag OFF -----------------> REAL_MONEY_DISABLED (no writes)
   |
   v
verify HMAC-SHA256(raw body, x-fake-signature, secret)
   |-- invalid -> 401 INVALID_SIGNATURE (no writes)
   v
INSERT webhook_events ON CONFLICT (provider,provider_event_id) DO NOTHING
   |-- duplicate -> no-op
   v
lookup payment_transactions(provider, provider_payment_id)
   |-- unknown -> store event, processed_at NULL, no order change
   v
process in one transaction:
   payment.succeeded: created -> captured; order awaiting_payment -> paid
   payment.failed:    created -> failed; order unchanged
   set webhook_events.processed_at (injected clock)
```

## Access & privacy

- Buyer sees only own orders; seller only orders for their seller profile; staff (admin/moderator/support) sees all.
- Non-participant → `NOT_FOUND` (never `FORBIDDEN`) to avoid leaking existence.
- `shipping_address_snapshot` returned only to buyer/seller; participant types expose no provider IDs, webhook payloads, staff notes or other-party user IDs.
- Redirects never change payment state; only verified webhooks do.

## Placeholders / known limitations

- Fake provider only; no Stripe/PayPal adapters, live capture, escrow, payouts or provider refunds.
- Fee payer/base/tax and 8% rate are OPEN (docs/16 §4); fee snapshot is never recalculated.
- Manual fulfilment only: no carrier APIs, shipping rates or tax (docs/16 §6).
- No real-time events; outbox publisher remains a separate concern.
MD
echo "diagram written"