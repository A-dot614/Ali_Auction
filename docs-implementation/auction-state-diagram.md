# Auction state diagram (Slice 4a + 4b close)

Source: `apps/api/src/auction/auctionStateMachine.ts` (single source of truth for status changes).

## States

```
scheduled ──(first accepted bid; server time >= starts_at)──> active
    │                                                          │
    │                                                          ├── closed_sold    (4b, highest bid wins)
    │                                                          └── closed_unsold  (4b guard; no active auction without bids)
    │
    ├── closed_unsold  (4b D2: expired without activation, no bids)
    │
    └── cancelled  (staff; only when the auction has no bids)
```

Statuses: `scheduled`, `active`, `closed_sold`, `closed_unsold`, `cancelled`.

`extended` is **not** created: snipe protection is disabled (TODO docs/16 §3 #5, §3 #6).

## Allowed transitions (4a + 4b)

| From | To | Trigger | Event row |
|---|---|---|---|
| `scheduled` | `active` | First accepted bid at/after `starts_at` and before `ends_at` | `auction_events` row (`from_status='scheduled'`, `to_status='active'`, `actor_user_id` = bidder) |
| `scheduled` | `closed_unsold` | 4b D2: expired without activation (no bids) | `auction_events` row (`actor_user_id=NULL`, `created_at` = injected clock) |
| `active` | `closed_sold` | 4b D1: close with a winning bid (highest amount) | `auction_events` row (`actor_user_id=NULL`, `created_at` = injected clock) |
| `active` | `closed_unsold` | 4b D1 guard: close with no bid is impossible in `active` | `auction_events` row (`actor_user_id=NULL`, `created_at` = injected clock) |
| — | `scheduled` | `createAuction` | `auction_events` row (`from_status=NULL`, `to_status='scheduled'`, `actor_user_id` = seller) |

The three close transitions are proposed placeholders, **NOT FOR PRODUCTION** (docs/16 §3). Every other pair throws `INVALID_AUCTION_TRANSITION`. Cancel remains a separate policy (`canCancel`); `scheduled → cancelled` / `active → cancelled` are unchanged from 4a.

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

## Auction close (transactional, Slice 4b)

`closeAuction(auctionId, opts)` runs in one DB transaction:

1. Read the injected clock once, then `SELECT … FROM auctions WHERE id=$1 FOR UPDATE`.
2. If already `closed_sold`/`closed_unsold`: return the existing outcome, write nothing (idempotent).
3. If `now < ends_at`: throw `AUCTION_NOT_DUE`, write nothing.
4. Determine the outcome via `determineAuctionOutcome`: highest accepted bid wins (`closed_sold`), otherwise `closed_unsold` (D1/D2). Reserve is ignored (D3).
5. `assertTransition(from, to)` through the state machine, then update `status`, `winning_bid_id`, `closed_at`, `updated_at` (all timestamps bound to the injected clock).
6. Insert one `auction_events` row, one `audit_logs` row (`actor_user_id=NULL`, `reason='system_close'`), and one `outbox_events` row (`event_type='auction.closed'`, payload carries a bidder label, never a user id).

`closeDueAuctions(opts)` selects due ids (`ends_at <= now`, status `scheduled|active`) and calls `closeAuction` once per id in its own transaction, reporting `{ closed, skipped, failed, errors }`. `apps/api/src/auction/closeJob.ts` exposes it via `pnpm --filter @aliauction/api auction:close-due`; no production scheduler is added.

`publishOutbox(sink, opts)` reads unpublished rows in `created_at, id` order, delivers each to the sink, and sets `published_at` to the injected clock only after success; a failed delivery leaves that row unpublished and stops the batch. Sinks in 4b: in-memory test sink and dev console sink.

## Deferred / known TODOs

- Orders, payments and payouts (Slice 6+): Slice 4b emits `auction.closed` intent only; no orders table.
- Real-time delivery via Socket.io (workstream 11, docs/03 §5): publisher has no broker sink in 4b.
- Production scheduler for `closeDueAuctions` (docs/16 §10 / docs/13).
- Proxy bidding and tie-breaking (`proxy_bids` created but unused; docs/16 §3 #4).
- Snipe protection/extensions, reserve enforcement/visibility (docs/16 §3 #5–#8).
- Cancel reason enforcement (docs/16 §3 #9).
