/**
 * Auction state machine (Slice 4a + Slice 4b close transitions).
 *
 * Lifecycle transitions:
 * - scheduled -> active (when the auction start time is reached; server UTC time).
 * - scheduled -> closed_unsold (Slice 4b, D2: expired without activation, so there are no bids).
 * - active -> closed_sold (Slice 4b, D1: close with a winning bid).
 * - active -> closed_unsold (Slice 4b, D1 guard: close with no bid is impossible in active).
 * - Cancel: allowed only when the auction has no bids (staff action, reason required).
 *   - TODO(docs/16 §3 #9): seller cancellation after the first accepted bid is OPEN; not implemented (cancel with bids -> TODO).
 *
 * The close transitions above are proposed placeholders, NOT FOR PRODUCTION, per docs/16 §3.
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

// Allowed lifecycle transitions. Close transitions are proposed placeholders (NOT FOR PRODUCTION).
// TODO(docs/16 §3 #1): auction format (English ascending only) is OPEN.
// TODO(docs/16 §3 #4): proxy tie-breaking is OPEN; D1 uses highest accepted amount (no tie possible in 4b).
const ALLOWED: Record<AuctionStatus, AuctionStatus[]> = {
  scheduled: ["active", "closed_unsold"],
  active: ["closed_sold", "closed_unsold"],
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
