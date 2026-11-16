import { describe, expect, it } from "vitest";
import {
  ALL_ACCOUNT_STATUSES,
  assertTransition,
  canTransition,
  getAllowedTransitions,
  InvalidAccountTransitionError,
  type AccountStatus,
} from "../src/accounts/accountStateMachine.js";

const ALLOWED: Array<[AccountStatus, AccountStatus]> = [
  ["active", "suspended"],
  ["suspended", "active"],
];

function allPairs(): Array<[AccountStatus, AccountStatus]> {
  const pairs: Array<[AccountStatus, AccountStatus]> = [];
  for (const from of ALL_ACCOUNT_STATUSES) for (const to of ALL_ACCOUNT_STATUSES) pairs.push([from, to]);
  return pairs;
}

const isAllowed = (from: AccountStatus, to: AccountStatus) =>
  ALLOWED.some(([a, b]) => a === from && b === to);

describe("account state machine (Slice 7)", () => {
  it("exposes exactly the allowed transitions per state", () => {
    expect(getAllowedTransitions("active")).toEqual(["suspended"]);
    expect(getAllowedTransitions("suspended")).toEqual(["active"]);
    expect(getAllowedTransitions("pending_verification")).toEqual([]);
    expect(getAllowedTransitions("closed")).toEqual([]);
  });

  for (const [from, to] of ALLOWED) {
    it(`allows active/moderation transition ${from} -> ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    });
  }

  for (const [from, to] of allPairs()) {
    if (isAllowed(from, to)) continue;
    it(`disallows transition ${from} -> ${to}`, () => {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrowError(InvalidAccountTransitionError);
      try {
        assertTransition(from, to);
      } catch (err: any) {
        expect(err.code).toBe("INVALID_ACCOUNT_TRANSITION");
      }
    });
  }
});
