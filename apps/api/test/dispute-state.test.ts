import { describe, expect, it } from "vitest";
import {
  ALL_DISPUTE_STATUSES,
  assertTransition,
  canTransition,
  getAllowedTransitions,
} from "../src/disputes/disputeStateMachine.js";

describe("dispute state machine (Slice 12)", () => {
  it("every allowed and disallowed pair", () => {
    const allowed: Record<string, string[]> = {
      open: ["resolved"],
      resolved: ["closed"],
      closed: [],
    };
    expect(ALL_DISPUTE_STATUSES).toEqual(["open", "resolved", "closed"]);
    for (const from of ALL_DISPUTE_STATUSES) {
      expect(getAllowedTransitions(from)).toEqual(allowed[from]);
      for (const to of ALL_DISPUTE_STATUSES) {
        const expected = allowed[from].includes(to);
        expect(canTransition(from, to)).toBe(expected);
        if (expected) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(/INVALID_DISPUTE_TRANSITION/);
        }
      }
    }
  });
});
