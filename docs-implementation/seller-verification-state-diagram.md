# Seller Verification State Diagram (Slice 2)

**Scope:** seller verification workflow state machine only (no identity documents stored in this slice).  
**Source of truth (code):** `apps/api/src/seller/verificationStateMachine.ts`  
**Open decisions:** `docs/16-assumptions-decisions-and-open-questions.md` §7 #1, #2, #5, #6

## States
- `not_submitted`
- `submitted`
- `under_review`
- `approved`
- `rejected`
- `more_info_requested`

## Allowed transitions (default config)
- `not_submitted` → `submitted`
- `submitted` → `under_review`
- `under_review` → `approved` | `rejected` | `more_info_requested`
- `more_info_requested` → `submitted`

## Disallowed / gated transitions
- Any transition not listed above is **invalid** and returns `INVALID_VERIFICATION_TRANSITION`.
- `rejected` → `submitted` (re-application) is **implemented behind a config flag set to OFF by default**: `SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED = false`.
  - **TODO(docs/16 §7 #6):** appeals/re-application policy is OPEN; enable only after approval.

## Text diagram

```text
                 +---------------+
                 | not_submitted |
                 +-------+-------+
                         |
                         | owner submits
                         v
                   +-----------+
                   | submitted |<---------------------------+
                   +-----+-----+                            |
                         |                                  | owner resubmits
                         | staff moves to review            |
                         v                                  |
                   +-------------+         staff requests   |
                   | under_review|--- more info --------->+-------------------+
                   +--+-------+--+                        | more_info_requested|
                      |       |                           +-------------------+
          staff approves    staff rejects
            (reason opt)  (reason required)
                      |       |
                      v       v
                 +--------+ +----------+
                 |approved| | rejected |
                 +--------+ +----------+
                                  |
                                  | re-apply (GATED/OFF by default)
                                  X  rejected -> submitted blocked unless
                                     SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED=true
                                     TODO(docs/16 §7 #6)
```

## Review rules (Slice 2)
- Reviewer must be staff (`moderator`/`support`/`admin` role baseline; permission concept `seller.verify` per `docs/09`) and **may not** be the seller themselves.
- `rejected` and `more_info_requested` require a non-empty reason; `approved` reason is optional.
- Re-submitting while already `submitted` is rejected (no silent duplication).
- Restricted seller actions require `approved` status (`SELLER_NOT_APPROVED` otherwise); seller role alone is insufficient.
- No identity documents stored; `document_storage_key` is a placeholder only (**TODO docs/16 §7 #1,#2**).

## Verification
- Unit tests: `apps/api/test/seller-verification-state.test.ts` (every allowed/disallowed pair, gated reapply).
- Integration tests: `apps/api/test/integration-seller.test.ts` (transitions, permissions, IDOR boundaries, audit rows, approval gate).
- Migrations: `apps/api/migrations/1700000000300_seller_profile_verification.js` (roundtrip tested).