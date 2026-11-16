# Listing State Diagram (Slice 3a / 3b)

**Scope:** catalogue listing lifecycle/state machine for Slice 3a, with **Slice 3b** moderation actions completed (staff-only approve/reject/pause/resume/remove mutations, audit + public visibility). **No auctions, bids, or start/end scheduling enforcement** (Slice 4). Requested schedule fields are draft intent only (non-binding). Moderation actions beyond approve/reject/pause/remove are **Slice 7** (not implemented).  
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

## Moderation actors / actions (Slice 3b)
- Staff-only moderation mutations (resolver + service checks): `pendingListingReviews`, `approveListing`, `rejectListing`, `pauseListing`, `resumeListing`, `removeListing` — allowed roles `admin`/`moderator` (docs/09 moderation concept); seller/buyer/other roles → `FORBIDDEN`.
- Self-moderation forbidden: staff cannot moderate a listing whose seller profile belongs to them → `FORBIDDEN`.

## Audit points (Slice 3b)
- Successful moderation writes exactly one `audit_logs` row (actor, action, target_type `listing`, target_id, before_status, after_status, reason).
- Actions recorded: `listing.approved`, `listing.rejected`, `listing.paused`, `listing.resumed`, `listing.removed`; invalid transitions write `listing.transition_rejected` (proposed decision, recorded as such, not settled policy).
- FORBIDDEN attempts write no audit row.

## Notes
- **Slug uniqueness:** globally unique listing slugs (chosen/documented for public URL stability/simplicity; Slice 3a).
- **Visibility:** `listing(slug)` public query returns **only** `published` listings with public-safe fields/media alt text only (no storage keys, no seller legal/verification/rejection reason/internal owner IDs beyond allowed public fields). Draft/unpublished return `NOT_FOUND`.
- **Ownership/editing:** `updateListingDraft` allowed only for owner when status is `draft` or `rejected` (revising rejected returns to `draft`). Non-owner update returns `NOT_FOUND` (no existence confirmation). Non-editable states return `LISTING_NOT_EDITABLE`. Submit requires `draft`; re-submit while `pending_review` returns clean `VALIDATION_ERROR` (no duplicate state).
- **Guards:** create/update/submit require verified email (`EMAIL_NOT_VERIFIED`) and approved seller (`SELLER_NOT_APPROVED`).
- **Requested schedule:** `requested_starts_at` / `requested_ends_at` are **draft intent only, non-binding** until Slice 4 validates/schedules; DB checks `ends_at > starts_at` when both set, but **no future-start check** in Slice 3a. TODO(docs/16 §3 #1,#2).
- **Moderation in 3b/7:** Slice 3b implemented the staff-only moderator actions (approve/reject/pause/resume/remove) on top of the state machine (resolver + service `SELECT … FOR UPDATE` + transition validation, audit, self-moderation forbidden, public visibility). Reports/user suspension remain **Slice 7**.

## Verification
- Unit tests: `apps/api/test/listing-state.test.ts` (every allowed/disallowed pair).
- Integration tests: `apps/api/test/integration-listing.test.ts` (Slice 3a required cases).
- Migration: `apps/api/migrations/1700000000400_catalogue_listings_slice3a.js` (roundtrip tested).
