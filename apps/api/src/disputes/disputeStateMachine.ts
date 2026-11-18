/**
 * Dispute state machine (Slice 12). Single source of truth: no resolver or service
 * writes dispute status directly; every state change calls assertTransition.
 *
 * open -> resolved (resolveDispute); resolved -> closed (closeDispute).
 * Everything else throws INVALID_DISPUTE_TRANSITION.
 *
 * TODO(docs/16 §8 #4): the resolution policy and evidence window are OPEN placeholders.
 */

export type DisputeStatus = "open" | "resolved" | "closed";

export const ALL_DISPUTE_STATUSES: DisputeStatus[] = ["open", "resolved", "closed"];

export class InvalidDisputeTransitionError extends Error {
  code = "INVALID_DISPUTE_TRANSITION" as const;
  constructor(from: DisputeStatus, to: DisputeStatus) {
    super(`INVALID_DISPUTE_TRANSITION: Cannot transition dispute from ${from} to ${to}.`);
    this.name = "InvalidDisputeTransitionError";
  }
}

const ALLOWED: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["resolved"],
  resolved: ["closed"],
  closed: [],
};

export function canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertTransition(from: DisputeStatus, to: DisputeStatus): void {
  if (!canTransition(from, to)) throw new InvalidDisputeTransitionError(from, to);
}

export function getAllowedTransitions(from: DisputeStatus): DisputeStatus[] {
  return [...(ALLOWED[from] ?? [])];
}
