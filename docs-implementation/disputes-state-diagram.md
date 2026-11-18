# Dispute state diagram — AliAuction.ca (Slice 12)

Text-only diagram. Reason codes, evidence window and outcomes are **NOT FOR PRODUCTION**
placeholders (TODO docs/16 §8 #4). Provider-level chargebacks remain OPEN (docs/16 §5 #8, FR-044).

## States and transitions (single source: `apps/api/src/disputes/disputeStateMachine.ts`)

```
                openDispute (participant only; paid/fulfilled order; within evidence window)
                                     |
                                     v
                                   [open] ------------------------------+
                                     |                                  |
                       postDisputeMessage (participant/staff)           |
                       assignDispute (admin/moderator)                  |
                                     |                                  |
                       resolveDispute (support assigned/mod/admin)      |
                                     |                                  |
                     +---------------+----------------+                 |
                     |                                |                 |
              outcome = no_action            outcome = refund_* or       |
                     |                      order_cancelled             |
                     v                                |                 |
              INVALID_DISPUTE_STATE if                 |                 |
              order not awaiting_payment for cancel    |                 |
                     |                                |                 |
                     +----------> assertTransition(open -> resolved) <----+
                                     |
                                     v
                                 [resolved] -- closeDispute(no_action, reason) --> [closed]
                                 (second resolve: INVALID_DISPUTE_TRANSITION)
```

## Money-flag gate (D11)

```
resolveDispute(outcome)
  |
  +-- no_action ------------------> allowed with FEATURE_REAL_MONEY_PAYMENTS_ENABLED OFF
  +-- order_cancelled ------------> allowed OFF; needs order awaiting_payment;
  |                                 order status written only via orderStateMachine
  +-- refund_full/refund_partial -> refundPayment(...) (Slice 6 path, fake provider only)
                                     |
                                     +-- flag OFF -> REAL_MONEY_DISABLED, no writes
                                     +-- flag ON  -> refunds row + payment transition + audit
```

## Outbox events (D10) -> notifications consumer

| Event | Payload | Recipient(s) | Copy status |
|---|---|---|---|
| `dispute.opened` | disputeId, orderId, userId (other participant), actorRole | other participant | placeholder (docs/16 §8 #6) |
| `dispute.message_posted` | disputeId, orderId, userId; **no message body** | other participant (both participants for staff posts) | placeholder (docs/16 §8 #6) |
| `dispute.resolved` | disputeId, orderId, outcome code only | buyer + seller | placeholder (docs/16 §8 #6) |

## Visibility (D5/D6/D7)

- Participant types: no `internal_only` messages, staff user ids, provider ids or payment payloads.
- Staff (support/mod/admin): full case including reporter identity and internal notes; support only when assigned.
- Finance: financial fields only (order total, refunds, payment status); no description or messages.

## Not implemented (TODO)

- Evidence attachments / file uploads / object storage (docs/13, docs/16 §8 #4).
- Provider-level chargebacks and disputes (docs/16 §5 #8, FR-044).
- Real payment providers; appeal workflow; approved resolution policy and evidence window (docs/16 §8 #4).
