import { describe, expect, it } from "vitest";
import { canAccessAssigned, canPerform, isFinance } from "../src/disputes/permissions.js";
import type { DisputeOperation } from "../src/disputes/permissions.js";

describe("dispute permission matrix (Slice 12, docs/09 §3)", () => {
  it("permission matrix for dispute operations: buyer, seller, support (assigned and unassigned), moderator, admin, finance", () => {
    const buyer = { id: "buyer", roles: ["buyer"] };
    const seller = { id: "seller", roles: ["seller"] };
    const support = { id: "support", roles: ["support"] };
    const moderator = { id: "moderator", roles: ["moderator"] };
    const admin = { id: "admin", roles: ["admin"] };
    const finance = { id: "finance", roles: ["finance"] };

    const participantOps: DisputeOperation[] = ["myDisputes", "dispute", "openDispute", "postDisputeMessage"];
    for (const op of participantOps) {
      expect(canPerform(buyer, op)).toBe(true);
      expect(canPerform(seller, op)).toBe(true);
    }
    for (const user of [support, moderator, admin, finance]) {
      expect(canPerform(user, "disputesQueue")).toBe(true);
      expect(canPerform(user, "disputeForStaff")).toBe(true);
    }
    // Assignment is admin/moderator only. Support may resolve/close assigned cases (D7);
    // finance is read-only.
    for (const op of ["assignDispute"] as DisputeOperation[]) {
      expect(canPerform(buyer, op)).toBe(false);
      expect(canPerform(seller, op)).toBe(false);
      expect(canPerform(support, op)).toBe(false);
      expect(canPerform(finance, op)).toBe(false);
      expect(canPerform(moderator, op)).toBe(true);
      expect(canPerform(admin, op)).toBe(true);
    }
    for (const op of ["resolveDispute", "closeDispute"] as DisputeOperation[]) {
      expect(canPerform(buyer, op)).toBe(false);
      expect(canPerform(seller, op)).toBe(false);
      expect(canPerform(finance, op)).toBe(false);
      expect(canPerform(support, op)).toBe(true); // assignment enforced by canAccessAssigned
      expect(canPerform(moderator, op)).toBe(true);
      expect(canPerform(admin, op)).toBe(true);
    }
    // Support may act only on assigned cases; moderator/admin may act on any.
    expect(canAccessAssigned({ ...support }, null)).toBe(false);
    expect(canAccessAssigned({ ...support }, "support")).toBe(true);
    expect(canAccessAssigned({ ...support }, "other-staff")).toBe(false);
    expect(canAccessAssigned(moderator, null)).toBe(true);
    expect(canAccessAssigned(admin, "anyone")).toBe(true);
    // Finance sees financial fields only.
    expect(isFinance(finance)).toBe(true);
    expect(isFinance(support)).toBe(false);
    expect(isFinance(buyer)).toBe(false);
  });
});
