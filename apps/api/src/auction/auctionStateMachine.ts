/**
 * Auction state machine (Slice 4a).
 *
 * Lifecycle transitions implemented in Slice 4a:
 * - scheduled -> active (when the auction start time is reached; server UTC time).
 * - Cancel: allowed only when the auction has no bids (staff action, reason required).
 *   - TODO(docs/16 §3 #9): seller cancellation after the first accepted bid is OPEN; not implemented in Slice 4a (cancel with bids -> TODO).
 *
 * Deferred to Slice 4b (not implemented in Slice 4a):
 * - active -> closed_sold | closed_unsold (auction close and winner determination).
 *
 * Every other transition throws INVALID_AUCTION_TRANSITION.
 */

export type AuctionStatus = "scheduled" | "active" | "closed_sold" | "closed_unsold" | "cancelled";

export const ALL_AUCTION_STATUSES: AuctionStatus[] = [
  "scheduled",
  "active",
  "closed_sold",
  "closed_unsold",
  "cancelled",
];

export class InvalidAuctionTransitionError extends Error {
  code = "INVALID_AUCTION_TRANSITION" as const;
  constructor(from: AuctionStatus, to: AuctionStatus) {
    super(`INVALID_AUCTION_TRANSITION: Cannot transition auction from ${from} to ${to}.`);
    this.name = "InvalidAuctionTransitionError";
  }
}

// Allowed lifecycle transitions in Slice 4a. Close transitions (active -> closed_*) are deferred to Slice 4b.
// TODO(docs/16 §3 #1): auction format (English ascending only) is OPEN; no other bid semantics in 4a.
const ALLOWED: Record<AuctionStatus, AuctionStatus[]> = {
  scheduled: ["active"],
  active: [],
  closed_sold: [],
  closed_unsold: [],
  cancelled: [],
};

export function canTransition(from: AuctionStatus, to: AuctionStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: AuctionStatus, to: AuctionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidAuctionTransitionError(from, to);
  }
}

export function getAllowedTransitions(from: AuctionStatus): AuctionStatus[] {
  return [...ALLOWED[from]];
}

/**
 * Cancel policy (Slice 4a): staff cancellation allowed only when the auction has no bids.
 * TODO(docs/16 §3 #9): whether sellers may cancel after the first bid is OPEN; cancel-after-bids is not implemented in Slice 4a.
 */
export function canCancel(from: AuctionStatus, hasBids: boolean): boolean {
  if (hasBids) {
    // TODO(docs/16 §3 #9): cancel-after-bids policy OPEN; not implemented in Slice 4a.
    return false;
  }
  return from === "scheduled";
}

export function assertCancel(from: AuctionStatus, hasBids: boolean): void {
  if (!canCancel(from, hasBids)) {
    throw new InvalidAuctionTransitionError(from, "cancelled");
  }
}
