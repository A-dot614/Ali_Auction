/**
 * Seller verification state machine (Slice 2).
 * Single source of truth for allowed/disallowed transitions.
 *
 * TODO(docs/16 §7 #6): Appeals/re-application policy for rejected sellers is OPEN.
 * Rejected -> submitted is implemented only behind an explicit config flag (default OFF).
 * TODO(docs/16 §7 #1,#2): Verification thresholds, required documents, and review SLAs are OPEN.
 * TODO(docs/16 §7 #5): Prohibited/restricted items policy may inform review reasons (OPEN).
 */

export type SellerVerificationStatus =
  | "not_submitted"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "more_info_requested";

export type SellerVerificationDecision = "under_review" | "approved" | "rejected" | "more_info_requested";

export const SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED = false; // OFF by default; pending docs/16 §7 #6

export class InvalidVerificationTransitionError extends Error {
  code = "INVALID_VERIFICATION_TRANSITION" as const;
  constructor(from: SellerVerificationStatus, to: SellerVerificationStatus | SellerVerificationDecision) {
    super(`INVALID_VERIFICATION_TRANSITION: Cannot transition seller verification from ${from} to ${to}.`);
    this.name = "InvalidVerificationTransitionError";
  }
}

const BASE_ALLOWED: Record<SellerVerificationStatus, SellerVerificationStatus[]> = {
  not_submitted: ["submitted"],
  submitted: ["under_review"],
  under_review: ["approved", "rejected", "more_info_requested"],
  approved: [],
  rejected: [],
  more_info_requested: ["submitted"],
};

export function getAllowedTransitions(
  from: SellerVerificationStatus,
  opts?: { allowReapplyAfterRejection?: boolean }
): SellerVerificationStatus[] {
  const allowReapply = opts?.allowReapplyAfterRejection ?? SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED;
  if (from === "rejected" && allowReapply) {
    return ["submitted"];
  }
  return [...BASE_ALLOWED[from]];
}

export function canTransition(
  from: SellerVerificationStatus,
  to: SellerVerificationStatus | SellerVerificationDecision,
  opts?: { allowReapplyAfterRejection?: boolean }
): boolean {
  return getAllowedTransitions(from, opts).includes(to as SellerVerificationStatus);
}

export function assertTransition(
  from: SellerVerificationStatus,
  to: SellerVerificationStatus | SellerVerificationDecision,
  opts?: { allowReapplyAfterRejection?: boolean }
): void {
  if (!canTransition(from, to, opts)) {
    throw new InvalidVerificationTransitionError(from, to);
  }
}

export const ALL_SELLER_VERIFICATION_STATUSES: SellerVerificationStatus[] = [
  "not_submitted",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "more_info_requested",
];
