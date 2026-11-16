import { describe, expect, it } from "vitest";
import {
  ALL_REPORT_STATUSES,
  assertTransition,
  canTransition,
  getAllowedTransitions,
  InvalidReportTransitionError,
  type ReportDecision,
  type ReportStatus,
} from "../src/reports/reportStateMachine.js";

const ALLOWED: Array<[ReportStatus, ReportDecision]> = [
  ["open", "actioned"],
  ["open", "dismissed"],
];

function allPairs(): Array<[ReportStatus, ReportDecision]> {
  const decisions: ReportDecision[] = ["actioned", "dismissed"];
  const pairs: Array<[ReportStatus, ReportDecision]> = [];
  for (const from of ALL_REPORT_STATUSES) for (const to of decisions) pairs.push([from, to]);
  return pairs;
}

const isAllowed = (from: ReportStatus, to: ReportDecision) =>
  ALLOWED.some(([a, b]) => a === from && b === to);

describe("report state machine (Slice 7)", () => {
  it("exposes exactly the allowed transitions per state", () => {
    expect(getAllowedTransitions("open")).toEqual(["actioned", "dismissed"]);
    expect(getAllowedTransitions("actioned")).toEqual([]);
    expect(getAllowedTransitions("dismissed")).toEqual([]);
  });

  for (const [from, to] of ALLOWED) {
    it(`allows resolution ${from} -> ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    });
  }

  for (const [from, to] of allPairs()) {
    if (isAllowed(from, to)) continue;
    it(`disallows resolution ${from} -> ${to}`, () => {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrowError(InvalidReportTransitionError);
      try {
        assertTransition(from, to);
      } catch (err: any) {
        expect(err.code).toBe("INVALID_REPORT_TRANSITION");
      }
    });
  }
});
