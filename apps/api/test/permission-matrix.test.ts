import { describe, expect, it } from "vitest";
import { canPerform, type PrivilegedOperation } from "../src/reports/permissions.js";

const ROLES = ["moderator", "admin", "support", "buyer", "seller"] as const;
const OPERATIONS: PrivilegedOperation[] = [
  "pendingReports",
  "reportForStaff",
  "resolveReport",
  "suspendUser",
  "reinstateUser",
  "pauseListing",
  "removeListing",
  "approveListing",
  "rejectListing",
  "resumeListing",
];

// docs/09 §3 permission matrix, expressed as expected allowances for Slice 7.
const STAFF_READ: PrivilegedOperation[] = ["pendingReports", "reportForStaff"];
const MODERATION: PrivilegedOperation[] = [
  "resolveReport",
  "suspendUser",
  "reinstateUser",
  "pauseListing",
  "removeListing",
  "approveListing",
  "rejectListing",
  "resumeListing",
];

function expected(role: string, op: PrivilegedOperation): boolean {
  if (role === "moderator" || role === "admin") return true;
  if (role === "support") return STAFF_READ.includes(op);
  return false;
}

describe("permission matrix (Slice 7, role checks only)", () => {
  for (const role of ROLES) {
    for (const op of OPERATIONS) {
      it(`role ${role} ${expected(role, op) ? "may" : "may not"} ${op}`, () => {
        expect(canPerform({ roles: [role] }, op)).toBe(expected(role, op));
      });
    }
  }

  it("admin may perform every moderator operation", () => {
    for (const op of MODERATION) {
      expect(canPerform({ roles: ["admin"] }, op)).toBe(true);
      expect(canPerform({ roles: ["moderator"] }, op)).toBe(true);
    }
  });

  it("support may read but may not suspend or change listings", () => {
    for (const op of STAFF_READ) expect(canPerform({ roles: ["support"] }, op)).toBe(true);
    for (const op of MODERATION) expect(canPerform({ roles: ["support"] }, op)).toBe(false);
  });

  it("buyer and seller have no staff permissions", () => {
    for (const op of OPERATIONS) {
      expect(canPerform({ roles: ["buyer"] }, op)).toBe(false);
      expect(canPerform({ roles: ["seller"] }, op)).toBe(false);
    }
  });
});
