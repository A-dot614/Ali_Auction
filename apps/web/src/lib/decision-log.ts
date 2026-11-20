import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Build-time, read-only view of docs-implementation/decision-log.md.
 * This module never writes to the log and never infers a decision: a row counts
 * as decided only when every owner-filled cell is present, as the file's rule
 * requires. P0 counts are unrelated and are not changed here.
 */

export type DecisionStatus = "decided" | "pending";
export type DecisionRow = {
  id: string;
  question: string;
  ownerRole: string;
  status: DecisionStatus;
  decisionMade: string;
  optionsChosen: string;
  decidedBy: string;
  date: string;
};

export function decisionLogCandidates(): string[] {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "docs-implementation/decision-log.md"),
    path.resolve(cwd, "../../docs-implementation/decision-log.md"),
    path.resolve(cwd, "../docs-implementation/decision-log.md"),
  ];
  return candidates;
}

export function findDecisionLogPath(): string {
  const found = decisionLogCandidates().find((candidate) => existsSync(candidate));
  if (!found) throw new Error("NOT_FOUND: docs-implementation/decision-log.md");
  return found;
}

function cells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

export function parseDecisionLog(text: string): DecisionRow[] {
  const rows: DecisionRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const parts = cells(line);
    if (parts.length < 8) continue;
    if (parts[0] === "Decision ID" || /^[-: ]+$/.test(parts[0])) continue;
    const [id, question, ownerRole, decisionMade, optionsChosen, decidedBy, date] = parts;
    const complete = [decisionMade, optionsChosen, decidedBy, date].every((value) => value.length > 0);
    rows.push({
      id,
      question,
      ownerRole,
      status: complete ? "decided" : "pending",
      decisionMade,
      optionsChosen,
      decidedBy,
      date,
    });
  }
  return rows;
}

export function loadDecisionLog(): DecisionRow[] {
  return parseDecisionLog(readFileSync(findDecisionLogPath(), "utf8"));
}

export function countDecisionStatuses(rows: DecisionRow[]): { decided: number; pending: number } {
  return {
    decided: rows.filter((row) => row.status === "decided").length,
    pending: rows.filter((row) => row.status === "pending").length,
  };
}

/** Backend flags and their source defaults. No flag is switched on by this page. */
export const BACKEND_FLAG_ROWS = [
  { flag: "FEATURE_LIVE_BIDDING_ENABLED", state: "OFF", gate: "Startup guard" },
  { flag: "FEATURE_REAL_MONEY_PAYMENTS_ENABLED", state: "OFF", gate: "Startup guard" },
  { flag: "FEATURE_REAL_SHIPPING_RATES_ENABLED", state: "OFF", gate: "Startup guard" },
  { flag: "FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED", state: "OFF", gate: "Startup guard" },
  { flag: "FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED", state: "OFF", gate: "Startup guard" },
  { flag: "FEATURE_EMAIL_CHANGE_ENABLED", state: "OFF", gate: "Startup guard" },
] as const;
