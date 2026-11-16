# Notifications state and flows (Slice 8)

Text-only reference for workstream 10. Notifications are produced from committed outbox events by an idempotent consumer — never inline in request handlers. All copy is a NOT FOR PRODUCTION placeholder pending copy review (docs/16 §7 #3, §8 #6).

## Event-to-category mapping (D2)

| Committed event | Recipient(s) | Category | Content rule |
|---|---|---|---|
| `auction.bid.accepted` | seller, previous high bidder | `auction_result`, `auction_outbid` | opaque bidder label only |
| `auction.closed` (`closed_sold`) | winner, seller | `auction_result` | outcome only |
| `auction.closed` (`closed_unsold`) | seller | `auction_result` | outcome only |
| `order.created` | buyer | `order_update` | neutral; no amounts |
| `order.paid` | seller | `payment_update` | neutral; no provider/payment details |
| `order.shipped` | buyer | `fulfilment_update` | neutral |
| `order.ready_for_pickup` | buyer | `fulfilment_update` | neutral |
| `listing.rejected` / `listing.paused` / `listing.removed` | seller | `listing_moderation` | neutral; no staff reason |
| `account.suspended` | affected user | `account_status` | neutral text only |
| `report.resolved` | reporter | `report_result` | outcome category only; never target identity |
| `report.resolved` (action taken) | reported party | `report_result` | neutral "report resolved"; no reporter identity |

No event maps to a recipient outside its specification. Unknown event types produce nothing but are still marked processed.

## Consumer flow (D1)

```
business transaction commits state change
  + outbox_events row (created_at from injected clock)
        |
        v
consumeOutbox('notifications', handler, opts)
  read rows NOT in processed_events(consumer='notifications') ORDER BY created_at, id
        |
        +--> BEGIN
        |     INSERT processed_events(consumer, event_id) ON CONFLICT DO NOTHING
        |       -> conflict: skip (replay is a no-op)
        |     handler: resolve recipient roles -> user ids from committed state
        |     INSERT notifications ... ON CONFLICT (user_id, source_event_id, category) DO NOTHING
        |     INSERT notification_deliveries (pending) for enabled channels
        +--> COMMIT
        |
        +--> handler failure -> ROLLBACK (marker + writes) -> row stays unprocessed -> batch stops
```

## Delivery retry flow (D4)

```
notification_deliveries WHERE status IN (pending, failed) AND attempts < cap
        |
        v
deliverPending(sinks, opts)
  channel -> sink (InAppSink | ConsoleEmailSink)
        |
        +--> success: status=sent, sent_at=injected clock
        +--> failure: attempts+1, status=failed, last_error_category = fixed category (no raw text)
                     retry while attempts < cap (placeholder default 5)
                     after cap: stays failed, no longer selected
```

## Preferences, links and reads (D3/D5/D6/D7)

- Transactional categories are always delivered and cannot be disabled; marketing/watch categories are opt-in default OFF (none produced here).
- `Notification.link` is a relative path resolved only for the authenticated owner (`myNotifications`); no unauthenticated link exists.
- `markNotificationRead(id)` is owner-only (others get `NOT_FOUND`) and idempotent; `read_at` is set once from the injected clock.
- `myNotifications(first, after, unreadOnly)` and `unreadCount` are scoped to the authenticated caller.

## Limitations

No real email/SMS/push provider (docs/11 §6), no Socket.io or real-time delivery (docs/03 §5), no UI (Slice 9), no marketing messages, no dead-letter queue beyond failed deliveries. Notification content is never a legal or policy decision here — neutral templates only.
