import { describe, expect, it } from "vitest";
import {
  ALL_LISTING_STATUSES,
  InvalidListingTransitionError,
  assertTransition,
  canTransition,
  getAllowedTransitions,
  type ListingStatus,
} from "../src/catalogue/listingStateMachine.js";

describe("listing state machine (Slice 3a)", () => {
  const allowedPairs: Array<[ListingStatus, ListingStatus]> = [
    ["draft", "pending_review"],
    ["pending_review", "published"],
    ["pending_review", "rejected"],
    ["pending_review", "draft"],
    ["published", "paused"],
    ["paused", "published"],
    ["published", "removed"],
    ["paused", "removed"],
    ["rejected", "draft"],
  ];

  it("exposes allowed transitions per state", () => {
    expect(getAllowedTransitions("draft")).toEqual(["pending_review"]);
    expect(getAllowedTransitions("pending_review")).toEqual(["published", "rejected", "draft"]);
    expect(getAllowedTransitions("published")).toEqual(["paused", "removed"]);
    expect(getAllowedTransitions("rejected")).toEqual(["draft"]);
    expect(getAllowedTransitions("paused")).toEqual(["published", "removed"]);
    expect(getAllowedTransitions("removed")).toEqual([]);
  });

  it("allows every allowed pair", () => {
    for (const [from, to] of allowedPairs) {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it("disallows every disallowed pair", () => {
    const allowedSet = new Set(allowedPairs.map(([f, t]) => `${f}->${t}`));
    for (const from of ALL_LISTING_STATUSES) {
      for (const to of ALL_LISTING_STATUSES) {
        if (allowedSet.has(`${from}->${to}`)) continue;
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(InvalidListingTransitionError);
        try {
          assertTransition(from, to);
        } catch (e: any) {
          expect(e.code).toBe("INVALID_LISTING_TRANSITION");
        }
      }
    }
  });
});
