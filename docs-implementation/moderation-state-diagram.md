# Moderation, suspension and report state diagrams (Slice 7)

Text-only reference for workstream 9. All status changes go through a state machine; resolvers never write status directly. Manual moderation only (docs/16 §8 #3). Placeholders cite docs/16 and are **NOT FOR PRODUCTION**.

## Report flow

```
                 reportListing(listingId) / reportUser(userId)
                 (D2 active + verified reporter, not own target)
                                |
                                v
                           [ open ]  <---- dedup: at most one open report per
                                |         (reporter_user_id, target_type, target_id) (D4)
                                | resolveReport(reportId, decision, reason, action)
                 +--------------+-----------------------+
                 |                                      |
        decision=actioned                        decision=dismissed
                 |                                      |
    action=none (no_action_needed)            action must be none
    action=hide_listing (listing only)                  |
    action=suspend_user (user only)                     v
                 |                                 [ dismissed ]
                 v
            [ actioned ]

  open -> actioned | dismissed. All other pairs -> INVALID_REPORT_TRANSITION.
  A second resolution writes nothing. One audit row per successful resolution.
  hide_listing -> pauseListing via listing state machine (published -> paused).
  suspend_user -> account state machine (active -> suspended) + session revocation.
```

## Account (suspension) flow

```
   pending_verification        active               suspended            closed
          |                   |   ^                  |   ^                 |
          | (no staff           |   | reinstate        |   | suspend        | terminal
          |  transition)        +---+ (D9)            +---+ (D8)           |
          |                          reason required       reason required
          |                          sessions NOT restored  sessions revoked
          +-------------------------- (no transitions) ---------------------+

  Allowed: active -> suspended, suspended -> active (moderator/admin only).
  Everything else -> INVALID_ACCOUNT_TRANSITION (writes nothing).
  Suspended accounts are rejected with ACCOUNT_SUSPENDED by requireVerified,
  placeBid, createCheckout and createListingDraft.
  OPEN placeholders: docs/16 §3 #14 (suspension while bidding), §7 #6 (appeals).
```

## Permission matrix (docs/09 §3; enforced in resolver AND service)

| Operation | moderator | admin | support | buyer | seller |
|---|---|---|---|---|---|
| pendingReports (read queue) | yes | yes | yes | no | no |
| reportForStaff (read report + reporter id) | yes | yes | yes | no | no |
| resolveReport | yes | yes | no | no | no |
| suspendUser | yes | yes | no | no | no |
| reinstateUser | yes | yes | no | no | no |
| approveListing / rejectListing / pauseListing / resumeListing / removeListing | yes | yes | no | no | no |
| reportListing / reportUser (active + verified, not own target) | yes | yes | yes | yes | yes |

Denied staff calls return `FORBIDDEN` and write no audit row. Every successful privileged mutation writes exactly one `audit_logs` row (append-only). Reporter identity is visible only to staff through `ReportStaffType`.

## Privacy & audit notes

- `reports.reporter_user_id` is internal; no public, reported-party or seller-facing type exposes it.
- Report categories are a placeholder enum, NOT FOR PRODUCTION (TODO docs/16 §7 #5).
- No notifications are sent; seller/reporter notification is a Slice 8 outbox TODO.
- No real-time events, Elasticsearch, proxy bidding, snipe, reserve enforcement or UI.
