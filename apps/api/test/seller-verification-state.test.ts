import { describe, expect, it } from "vitest";
import {
  ALL_SELLER_VERIFICATION_STATUSES,
  InvalidVerificationTransitionError,
  SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED,
  assertTransition,
  canTransition,
  getAllowedTransitions,
  type SellerVerificationStatus,
} from "../src/seller/verificationStateMachine.js";

describe("seller verification state machine", () => {
  const allowedPairs: Array<[SellerVerificationStatus, SellerVerificationStatus]> = [
    ["not_submitted", "submitted"],
    ["submitted", "under_review"],
    ["under_review", "approved"],
    ["under_review", "rejected"],
    ["under_review", "more_info_requested"],
    ["more_info_requested", "submitted"],
  ];

  it("exposes allowed transitions for each state (default config)", () => {
    expect(getAllowedTransitions("not_submitted")).toEqual(["submitted"]);
    expect(getAllowedTransitions("submitted")).toEqual(["under_review"]);
    expect(getAllowedTransitions("under_review")).toEqual(["approved", "rejected", "more_info_requested"]);
    expect(getAllowedTransitions("more_info_requested")).toEqual(["submitted"]);
    expect(getAllowedTransitions("approved")).toEqual([]);
    // Rejected -> submitted is behind config flag OFF by default (docs/16 §7 #6 open).
    expect(SELLER_REAPPLICATION_AFTER_REJECTION_ENABLED).toBe(false);
    expect(getAllowedTransitions("rejected")).toEqual([]);
  });

  it("allows every allowed pair", () => {
    for (const [from, to] of allowedPairs) {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it("disallows every disallowed pair", () => {
    const allowedSet = new Set(allowedPairs.map(([f, t]) => `${f}->${t}`));
    // rejected->submitted also disallowed by default config
    for (const from of ALL_SELLER_VERIFICATION_STATUSES) {
      for (const to of ALL_SELLER_VERIFICATION_STATUSES) {
        if (allowedSet.has(`${from}->${to}`)) continue;
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(InvalidVerificationTransitionError);
        try {
          assertTransition(from, to);
        } catch (e: any) {
          expect(e.code).toBe("INVALID_VERIFICATION_TRANSITION");
        }
      }
    }
  });

  it("rejected -> submitted only when reapplication flag is enabled", () => {
    expect(canTransition("rejected", "submitted")).toBe(false);
    expect(canTransition("rejected", "submitted", { allowReapplyAfterRejection: true })).toBe(true);
    expect(() => assertTransition("rejected", "submitted", { allowReapplyAfterRejection: true })).not.toThrow();
  });
});
