/**
 * Account state machine (Slice 7).
 * Single source of truth for user account status transitions used by
 * suspendUser / reinstateUser. Resolvers and services never write status directly.
 *
 * TODO(docs/16 §3 #14): what happens if a user is suspended while bidding is OPEN.
 * TODO(docs/16 §7 #6): suspension appeal workflow is OPEN.
 * These are placeholders; no policy is invented here.
 */

export type AccountStatus = "pending_verification" | "active" | "suspended" | "closed";

export const ALL_ACCOUNT_STATUSES: AccountStatus[] = [
  "pending_verification",
  "active",
  "suspended",
  "closed",
];

export class InvalidAccountTransitionError extends Error {
  code = "INVALID_ACCOUNT_TRANSITION" as const;
  constructor(from: AccountStatus, to: AccountStatus) {
    super(`INVALID_ACCOUNT_TRANSITION: Cannot transition account from ${from} to ${to}.`);
    this.name = "InvalidAccountTransitionError";
  }
}

// Staff (moderator/admin) suspension/reinstatement only. Every other pair is rejected.
const ALLOWED: Record<AccountStatus, AccountStatus[]> = {
  pending_verification: [],
  active: ["suspended"],
  suspended: ["active"],
  closed: [],
};

export function canTransition(from: AccountStatus, to: AccountStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: AccountStatus, to: AccountStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidAccountTransitionError(from, to);
  }
}

export function getAllowedTransitions(from: AccountStatus): AccountStatus[] {
  return [...ALLOWED[from]];
}
