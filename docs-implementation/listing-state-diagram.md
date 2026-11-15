# Listing State Diagram (Slice 3a)

**Scope:** catalogue listing lifecycle/state machine for Slice 3a only. **No auctions, bids, or start/end scheduling enforcement** (Slice 4). Requested schedule fields are draft intent only (non-binding). Moderation actions beyond approve/reject/pause/remove are **Slice 7** (not implemented).  
**Source of truth (code):** `apps/api/src/catalogue/listingStateMachine.ts`  
**Migration:** `apps/api/migrations/1700000000400_catalogue_listings_slice3a.js`  
**Open decisions:** `docs/16-assumptions-decisions-and-open-questions.md` §3 #1,#2, §7 #5, §8 #1,#3,#6

## States (`listing_status`)
- `draft`
- `pending_review`
- `published`
- `rejected`
- `paused`
- `removed`

## Allowed transitions (Slice 3a)
- `draft` → `pending_review` (owner submits)
- `pending_review` → `published` (moderator approves)
- `pending_review` → `rejected` (moderator rejects, reason required)
- `pending_review` → `draft` (owner withdraws)
- `published` → `paused` (moderator)
- `paused` → `published` (moderator)
- `published` → `removed` (moderator, reason required)
- `paused` → `removed` (moderator, reason required)
- `rejected` → `draft` (owner revises)

Every other transition is **invalid** and throws `INVALID_LISTING_TRANSITION`.

## Text diagram

```text
                 +-------+
        +------->| draft |<----------------------+
        |        +---+---+                       |
        |            | owner submits             | owner withdraws / owner revises
        |            v                           |
        |     +---------------+                  |
        |     | pending_review|------------------+
        |     +---+-------+---+
        |         |       |
        | mod     |       | mod rejects (reason required)
        | approves|       v
        |         |   +----------+
        |         |   | rejected |
        |         |   +----------+
        |         v
        |    +-----------+
        +----| published |<----+
   mod pause  +---+-------+     | mod resume
                 |             |
                 | mod pause   |
                 v             |
              +--------+       |
              | paused |-------+
              +---+----+
                  |
                  | mod remove (reason required)
                  v
              +---------+
              | removed |  (terminal)
              +---------+

  published --mod remove (reason required)--> removed
```

## Notes
- **Slug uniqueness:** globally unique listing slugs (chosen/documented for public URL stability/simplicity; Slice 3a).
- **Visibility:** `listing(slug)` public query returns **only** `published` listings with public-safe fields/media alt text only (no storage keys, no seller legal/verification/rejection reason/internal owner IDs beyond allowed public fields). Draft/unpublished return `NOT_FOUND`.
- **Ownership/editing:** `updateListingDraft` allowed only for owner when status is `draft` or `rejected` (revising rejected returns to `draft`). Non-owner update returns `NOT_FOUND` (no existence confirmation). Non-editable states return `LISTING_NOT_EDITABLE`. Submit requires `draft`; re-submit while `pending_review` returns clean `VALIDATION_ERROR` (no duplicate state).
- **Guards:** create/update/submit require verified email (`EMAIL_NOT_VERIFIED`) and approved seller (`SELLER_NOT_APPROVED`).
- **Requested schedule:** `requested_starts_at` / `requested_ends_at` are **draft intent only, non-binding** until Slice 4 validates/schedules; DB checks `ends_at > starts_at` when both set, but **no future-start check** in Slice 3a. TODO(docs/16 §3 #1,#2).
- **Moderation in 3b/7:** approve/reject/pause/remove transitions are defined but moderator GraphQL actions/UI beyond state model are out of 3a scope (3b completes moderation/public query behaviors as specified).

## Verification
- Unit tests: `apps/api/test/listing-state.test.ts` (every allowed/disallowed pair).
- Integration tests: `apps/api/test/integration-listing.test.ts` (Slice 3a required cases).
- Migration: `apps/api/migrations/1700000000400_catalogue_listings_slice3a.js` (roundtrip tested).
