import type { AuditInput } from "../audit.js";
import { config } from "../config.js";
import { assertTransition, type DisputeStatus } from "./disputeStateMachine.js";

/**
 * Decision-independent structure for FR-072 (evidence handling) and FR-073
 * (approved outcomes/evidence window). No attachment storage is implemented: the
 * existing dispute schema has no evidence table and docs/16 §8 #4 leaves storage and
 * retention OPEN, so a migration is not created here. Records are process-local and
 * fake only. All policy values are required inputs with NO defaults.
 */

export type EvidenceRecord = {
  evidenceId: string;
  disputeId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  at: Date;
};

export type ApprovedDisputePolicy = {
  outcomes: string[];
  reasonCodes: string[];
  evidenceWindowDays: number;
};

export function requireApprovedDisputePolicy(): ApprovedDisputePolicy {
  const d = config.disputes;
  const missing = [
    !d.approvedOutcomes.trim() && "DISPUTE_APPROVED_OUTCOMES",
    !d.approvedReasonCodes.trim() && "DISPUTE_APPROVED_REASON_CODES",
    !d.approvedEvidenceWindowDays.trim() && "DISPUTE_APPROVED_EVIDENCE_WINDOW_DAYS",
  ].filter((name): name is string => typeof name === "string");
  if (missing.length > 0) {
    throw new Error(`NOT_CONFIGURED: approved dispute policy requires ${missing.join(", ")} (no defaults).`);
  }
  const evidenceWindowDays = Number(d.approvedEvidenceWindowDays);
  if (!Number.isInteger(evidenceWindowDays) || evidenceWindowDays < 0) {
    throw new Error("VALIDATION_ERROR: DISPUTE_APPROVED_EVIDENCE_WINDOW_DAYS must be a non-negative integer.");
  }
  return {
    outcomes: d.approvedOutcomes.split(",").map((s) => s.trim()).filter(Boolean),
    reasonCodes: d.approvedReasonCodes.split(",").map((s) => s.trim()).filter(Boolean),
    evidenceWindowDays,
  };
}

export function requireEvidenceStorageConfigured(): string {
  const kind = config.disputes.evidenceStorageKind.trim();
  if (!kind) {
    throw new Error("NOT_CONFIGURED: DISPUTE_EVIDENCE_STORAGE_KIND has no default; a decision is required.");
  }
  return kind;
}

export function assertEvidenceUploadsAllowed(): void {
  if (!config.features.disputeEvidenceUploadsEnabled) {
    throw new Error("NOT_ENABLED: dispute evidence uploads are not enabled.");
  }
  requireEvidenceStorageConfigured();
}

export function assertApprovedOutcomesAllowed(): void {
  if (!config.features.approvedDisputeOutcomesEnabled) {
    throw new Error("NOT_ENABLED: approved dispute outcomes are not enabled.");
  }
  requireApprovedDisputePolicy();
}

/** Workflow skeleton: reuses the existing single source of truth, adds no new rule. */
export function checkDisputeStatusTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  try {
    assertTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

export class InMemoryEvidenceStore {
  private readonly records = new Map<string, EvidenceRecord>();

  add(record: EvidenceRecord): "recorded" | "duplicate" {
    if (this.records.has(record.evidenceId)) return "duplicate";
    this.records.set(record.evidenceId, record);
    return "recorded";
  }

  listForDispute(disputeId: string): EvidenceRecord[] {
    return [...this.records.values()].filter((record) => record.disputeId === disputeId);
  }
}

export function auditEntryForEvidenceAccepted(record: EvidenceRecord): AuditInput {
  return {
    actorUserId: record.uploadedByUserId,
    action: "dispute.evidence_accepted",
    targetType: "dispute_evidence",
    targetId: record.evidenceId,
    metadata: { disputeId: record.disputeId, sizeBytes: record.sizeBytes, storage: "in-memory-fake" },
    createdAt: record.at,
  };
}

export function auditEntryForStaffReview(disputeId: string, actorUserId: string, at: Date): AuditInput {
  return {
    actorUserId,
    action: "dispute.staff_review_opened",
    targetType: "dispute",
    targetId: disputeId,
    metadata: { placeholder: true },
    createdAt: at,
  };
}

/** Staff review placeholder: exposes no data and states NOT_ENABLED while flags are OFF. */
export function staffReviewPlaceholder(): {
  enabled: boolean;
  message: string;
  outcomeChoices: string[];
  evidenceWindowDays: number | null;
} {
  const disabled = { enabled: false, message: "NOT_ENABLED", outcomeChoices: [], evidenceWindowDays: null };
  if (!config.features.approvedDisputeOutcomesEnabled) return disabled;
  const policy = requireApprovedDisputePolicy();
  return {
    enabled: true,
    message: "CONFIGURED",
    outcomeChoices: policy.outcomes,
    evidenceWindowDays: policy.evidenceWindowDays,
  };
}
