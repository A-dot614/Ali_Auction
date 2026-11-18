/**
 * Staff permission matrix for Slice 12 disputes (docs/09 §3 permission matrix).
 * Deny by default; role checks are performed in BOTH the resolver and the service.
 *
 * - support: read/act only on disputes assigned to them (D7, enforced in the service).
 * - moderator/admin: read all disputes, assign, resolve and close.
 * - finance: read-only financial fields (order total, refunds, payment status); no
 *   dispute description, messages, assignment, resolution or closing.
 * - buyer/seller: participant access to their own disputes only (object-level in service).
 */

export type DisputeOperation =
  | "myDisputes"
  | "dispute"
  | "openDispute"
  | "postDisputeMessage"
  | "disputesQueue"
  | "disputeForStaff"
  | "assignDispute"
  | "resolveDispute"
  | "closeDispute";

const PARTICIPANT_OPERATIONS: DisputeOperation[] = ["myDisputes", "dispute", "openDispute", "postDisputeMessage"];
const STAFF_READ: DisputeOperation[] = ["disputesQueue", "disputeForStaff"];
const STAFF_ACTION: DisputeOperation[] = ["resolveDispute", "closeDispute"];

function has(user: { roles: string[] }, role: string): boolean {
  return user.roles.includes(role);
}

export function canPerform(user: { roles: string[] }, op: DisputeOperation): boolean {
  if (PARTICIPANT_OPERATIONS.includes(op)) return true; // object-level check in service
  if (STAFF_READ.includes(op)) {
    return has(user, "support") || has(user, "moderator") || has(user, "admin") || has(user, "finance");
  }
  if (op === "assignDispute") return has(user, "admin") || has(user, "moderator");
  if (STAFF_ACTION.includes(op)) {
    return has(user, "support") || has(user, "moderator") || has(user, "admin");
  }
  return false;
}

export function assertCanPerform(user: { roles: string[] }, op: DisputeOperation): void {
  if (!canPerform(user, op)) throw new Error("FORBIDDEN: Insufficient permissions.");
}

/** D5: finance sees financial fields only; never description, messages or staff identities. */
export function isFinance(user: { roles: string[] }): boolean {
  return has(user, "finance") && !has(user, "moderator") && !has(user, "admin") && !has(user, "support");
}

/** D7: support may only act on assigned disputes; moderator/admin may act on any. */
export function canAccessAssigned(user: { id: string; roles: string[] }, assignedToUserId: string | null): boolean {
  if (has(user, "moderator") || has(user, "admin")) return true;
  if (has(user, "support")) return assignedToUserId === user.id;
  return false;
}
