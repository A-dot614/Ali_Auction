# Privacy data inventory (Slice 10)

Proposed placeholder inventory derived from the applied migrations. Classifications follow `docs/04 §6`. **Retention is OPEN for every field** (`docs/16 §7 #7`); no period is invented. No listed field appears in application logs — the logger enforces redaction for all these key names (`docs/10 §5`). This is a documentation stub, not a privacy review (`docs/16 §7 #8`, §7 #10 OPEN).

| Table | Column | Classification | Purpose | Who can read | Retention | In logs |
|---|---|---|---|---|---|---|
| users | email | Personal | Account identity, verification, login | Owner; authorized staff | OPEN (docs/16 §7 #7) | No |
| users | password_hash | Highly restricted | Password verification (bcrypt) | Auth service only | OPEN | No |
| users | email_verified_at | Personal | Verification state | Owner; authorized staff | OPEN | No |
| users | status | Personal | Account lifecycle (active/suspended/closed) | Owner; authorized staff | OPEN | No |
| sessions | token_hash | Highly restricted | Session authentication | Auth service only | OPEN | No |
| sessions | ip_address | Personal | Session security metadata | Owner; authorized staff | OPEN | No |
| sessions | user_agent | Personal | Session security metadata | Owner; authorized staff | OPEN | No |
| sessions | expires_at | Personal | Session lifetime | Auth service; owner via mySessions | OPEN | No |
| sessions | revoked_at | Personal | Session revocation state | Auth service; owner | OPEN | No |
| sessions | last_seen_at | Personal | Session activity | Auth service; owner | OPEN | No |
| email_verification_tokens | token_hash | Highly restricted | Email verification | Auth service only | OPEN | No |
| password_reset_tokens | token_hash | Highly restricted | Password reset | Auth service only | OPEN | No |
| audit_logs | actor_user_id | Personal | Privileged action attribution | Admin/staff (audit.read) | OPEN | No |
| audit_logs | reason | Personal | Free-text action rationale | Admin/staff | OPEN | No |
| audit_logs | metadata | Personal | Safe action metadata | Admin/staff | OPEN | No |
| user_profiles | display_name | Personal | Public/own profile display | Owner; public where exposed | OPEN | No |
| user_profiles | bio | Personal | Profile description | Owner; public where exposed | OPEN | No |
| user_profiles | province_code | Personal | Seller/buyer province | Owner; authorized staff | OPEN | No |
| seller_profiles | display_name | Personal | Seller profile display | Owner; public storefront | OPEN | No |
| seller_profiles | public_store_name | Personal | Public storefront name | Owner; public | OPEN | No |
| seller_profiles | legal_name | Sensitive personal | Seller identity verification (restricted) | Assigned staff only | OPEN | No |
| seller_profiles | province_code | Personal | Seller jurisdiction | Owner; authorized staff | OPEN | No |
| seller_verifications | decision_reason | Personal | Verification decision rationale | Assigned staff; owner where exposed | OPEN | No |
| seller_verifications | document_storage_key | Sensitive personal | Placeholder document reference (no documents stored) | Assigned staff only | OPEN | No |
| listings | rejection_reason | Personal | Moderation rationale (staff-only field) | Staff; owner where policy allows | OPEN | No |
| listing_media | storage_key | Sensitive personal | Placeholder media reference | Owner; restricted service | OPEN | No |
| orders | shipping_address_snapshot | Sensitive personal | Fulfilment address snapshot | Buyer; seller; staff | OPEN | No |
| order_events | reason | Personal | Order transition rationale | Participants; staff | OPEN | No |
| payment_transactions | provider_payment_id | Financial metadata | Sandbox payment reference | Finance/admin services | OPEN | No |
| payment_transactions | idempotency_key | Financial metadata | Checkout idempotency | Payment service | OPEN | No |
| webhook_events | payload | Financial metadata | Sandbox webhook record | Payment service; staff | OPEN | No |
| refunds | reason | Financial metadata | Internal refund rationale | Finance/admin services | OPEN | No |
| refunds | created_by_user_id | Personal | Refund actor attribution | Finance/admin services | OPEN | No |
| shipments | tracking_number | Sensitive personal | Shipment tracking | Buyer; seller; staff | OPEN | No |
| reports | reporter_user_id | Personal | Report authorship (internal only) | Moderator/admin/support | OPEN | No |
| reports | details | Personal | Report free text | Staff only | OPEN | No |
| reports | resolution_reason | Personal | Moderation resolution rationale | Staff only | OPEN | No |
| reports | resolved_by_user_id | Personal | Resolver attribution | Staff only | OPEN | No |
| notifications | title | Personal | Recipient-facing notification copy | Recipient only | OPEN | No |
| notifications | body | Personal | Recipient-facing notification copy | Recipient only | OPEN | No |
| notifications | resource_id | Personal | Recipient's own resource reference | Recipient only | OPEN | No |
| account_deletion_requests | user_id | Personal | Deletion request owner | Owner; staff | OPEN | No |
| account_deletion_requests | reason | Personal | Optional request rationale | Owner; staff | OPEN | No |

## Notes / gaps
- Retention and deletion workflows remain OPEN (`docs/16 §7 #7`, §7 #8). The account deletion request is recorded only, never executed (Slice 10 D7).
- Legal counsel approval of privacy/consumer disclosures is OPEN (`docs/16 §7 #10`).
- No backup restore drill was performed (`docs/13 §8`); no RPO/RTO is defined.
