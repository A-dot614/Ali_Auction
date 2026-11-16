/**
 * Report state machine (Slice 7). Single source of truth for report resolution.
 * open -> actioned | dismissed. Everything else throws INVALID_REPORT_TRANSITION.
 *
 * TODO(docs/16 §8 #3): moderation stays manual; no automated decision policy is invented.
 * TODO(docs/16 §7 #5): report categories are a NOT FOR PRODUCTION placeholder.
 */

export type ReportStatus = "open" | "actioned" | "dismissed";
export type ReportDecision = "actioned" | "dismissed";

export const ALL_REPORT_STATUSES: ReportStatus[] = ["open", "actioned", "dismissed"];

export class InvalidReportTransitionError extends Error {
  code = "INVALID_REPORT_TRANSITION" as const;
  constructor(from: ReportStatus, to: ReportDecision) {
    super(`INVALID_REPORT_TRANSITION: Cannot transition report from ${from} to ${to}.`);
    this.name = "InvalidReportTransitionError";
  }
}

const ALLOWED: Record<ReportStatus, ReportDecision[]> = {
  open: ["actioned", "dismissed"],
  actioned: [],
  dismissed: [],
};

export function canTransition(from: ReportStatus, to: ReportDecision): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: ReportStatus, to: ReportDecision): void {
  if (!canTransition(from, to)) {
    throw new InvalidReportTransitionError(from, to);
  }
}

export function getAllowedTransitions(from: ReportStatus): ReportDecision[] {
  return [...ALLOWED[from]];
}
