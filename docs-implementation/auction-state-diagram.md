# Auction state diagram (Slice 4a)

Source: `apps/api/src/auction/auctionStateMachine.ts` (single source of truth for status changes).

## States

```
scheduled ──(first accepted bid; server time >= starts_at)──> active
    │                                                          │
    │                                                          └── closed_sold    (Slice 4b only)
    │                                                          └── closed_unsold  (Slice 4b only)
    │
    └── cancelled  (staff; only when the auction has no bids)
```

Statuses: `scheduled`, `active`, `closed_sold`, `closed_unsold`, `cancelled`.

`extended` is **not** created: snipe protection is disabled (TODO docs/16 §3 #5, §3 #6).

## Allowed transitions in Slice 4a

| From | To | Trigger | Event row |
|---|---|---|---|
| `scheduled` | `active` | First accepted bid at/after `starts_at` and before `ends_at` | `auction_events` row (`from_status='scheduled'`, `to_status='active'`, `actor_user_id` = bidder) |
| — | `scheduled` | `createAuction` | `auction_events` row (`from_status=NULL`, `to_status='scheduled'`, `actor_user_id` = seller) |

`active → closed_sold | closed_unsold` is deferred to **Slice 4b** and throws `INVALID_AUCTION_TRANSITION` in 4a. Every other pair also throws `INVALID_AUCTION_TRANSITION`.

## Cancel policy

`canCancel(from, hasBids)` allows cancellation only when:

- `from === 'scheduled'`, and
- the auction has no bids.

Cancel-after-bids is **OPEN** (TODO docs/16 §3 #9) and not implemented. There is no cancel GraphQL mutation in Slice 4a; the policy lives in the state machine for review.

## Bid acceptance (transactional)

`placeBid` runs in one DB transaction:

1. Read the injected clock once (`const at`), then `SELECT … FROM auctions WHERE id = $1 FOR UPDATE` (serializes concurrent bids).
2. If `bids.request_id` already exists: return the original bid and the auction snapshot captured immediately after that bid (from the outbox payload), write nothing new.
3. Reject if the bidder owns the listing (`SELLER_CANNOT_BID`).
4. Reject unless status is `scheduled|active` and `starts_at <= at < ends_at` (`AUCTION_NOT_OPEN`).
5. Reject if `amount_minor < minimumBidMinor(...)` (`BID_TOO_LOW`).
6. Insert the bid (`bid_type='manual'`, `accepted_at = at`), update `current_price_minor`/`updated_at = at`, transition `scheduled → active` when needed, and insert one `outbox_events` row (`created_at = at`) with the post-bid snapshot used for replay.
7. Commit.

Rejected bids write no bid, price, event, outbox, or audit rows. Accepted bids write **no audit row** in Slice 4a: the immutable `bids` ledger plus `outbox_events` is the record (documented decision; revisit if audit policy changes).

## Deferred to Slice 4b / later

- Auction close, winner determination, `closed_sold`/`closed_unsold`.
- Outbox publisher (`outbox_events.published_at` stays `NULL`).
- Proxy bidding and tie-breaking (`proxy_bids` created but unused).
- Snipe protection/extensions, reserve enforcement/visibility.
- Real-time events.
