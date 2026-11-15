/**
 * Listing state machine (Slice 3a).
 * Moderation actions beyond approve/reject/pause/remove are Slice 7 (not implemented here).
 */

export type ListingStatus = "draft" | "pending_review" | "published" | "rejected" | "paused" | "removed";

export const ALL_LISTING_STATUSES: ListingStatus[] = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "paused",
  "removed",
];

export class InvalidListingTransitionError extends Error {
  code = "INVALID_LISTING_TRANSITION" as const;
  constructor(from: ListingStatus, to: ListingStatus) {
    super(`INVALID_LISTING_TRANSITION: Cannot transition listing from ${from} to ${to}.`);
    this.name = "InvalidListingTransitionError";
  }
}

// Allowed transitions:
// draft → pending_review (owner submits)
// pending_review → published (moderator approves)
// pending_review → rejected (moderator rejects, reason required)
// pending_review → draft (owner withdraws)
// published → paused (moderator)
// paused → published (moderator)
// published → removed, paused → removed (moderator, reason required)
// rejected → draft (owner revises)
const ALLOWED: Record<ListingStatus, ListingStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["published", "rejected", "draft"],
  published: ["paused", "removed"],
  rejected: ["draft"],
  paused: ["published", "removed"],
  removed: [],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: ListingStatus, to: ListingStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidListingTransitionError(from, to);
  }
}

export function getAllowedTransitions(from: ListingStatus): ListingStatus[] {
  return [...ALLOWED[from]];
}
