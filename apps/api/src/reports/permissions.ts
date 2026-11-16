/**
 * Staff permission matrix for Slice 7 (docs/09 §3 permission matrix).
 * Deny by default; enforced on the server. Role checks are performed in BOTH the
 * resolver and the service for every privileged operation (see rule 5).
 *
 * - moderator, admin: read queue, resolve reports, suspend/reinstate, moderate listings.
 * - support: read queue and reportForStaff only; no moderation actions.
 * - buyer, seller: no staff permissions.
 */

export type PrivilegedOperation =
  | "pendingReports"
  | "reportForStaff"
  | "resolveReport"
  | "suspendUser"
  | "reinstateUser"
  | "pauseListing"
  | "removeListing"
  | "approveListing"
  | "rejectListing"
  | "resumeListing";

const STAFF_READ: PrivilegedOperation[] = ["pendingReports", "reportForStaff"];
const STAFF_MODERATION: PrivilegedOperation[] = [
  "resolveReport",
  "suspendUser",
  "reinstateUser",
  "pauseListing",
  "removeListing",
  "approveListing",
  "rejectListing",
  "resumeListing",
];

export function isStaff(user: { roles: string[] }): boolean {
  return user.roles.some((r) => r === "moderator" || r === "admin" || r === "support");
}

export function canPerform(user: { roles: string[] }, op: PrivilegedOperation): boolean {
  if (STAFF_READ.includes(op)) return isStaff(user);
  if (STAFF_MODERATION.includes(op)) {
    return user.roles.some((r) => r === "moderator" || r === "admin");
  }
  return false;
}

export function assertCanPerform(user: { roles: string[] }, op: PrivilegedOperation): void {
  if (!canPerform(user, op)) {
    // Stable error code consumed by GraphQL clients and tests.
    throw new Error("FORBIDDEN: Insufficient permissions.");
  }
}
