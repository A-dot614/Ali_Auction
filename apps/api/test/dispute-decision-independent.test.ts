import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { config, assertSafeFeatureFlags } from "../src/config.js";
import { createApp } from "../src/index.js";
import {
  InMemoryEvidenceStore,
  assertApprovedOutcomesAllowed,
  assertEvidenceUploadsAllowed,
  auditEntryForEvidenceAccepted,
  auditEntryForStaffReview,
  checkDisputeStatusTransition,
  requireApprovedDisputePolicy,
  requireEvidenceStorageConfigured,
  staffReviewPlaceholder,
  type EvidenceRecord,
} from "../src/disputes/decisionIndependent.js";

const ENV_KEYS = [
  "FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED",
  "FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED",
  "DISPUTE_APPROVED_OUTCOMES",
  "DISPUTE_APPROVED_REASON_CODES",
  "DISPUTE_APPROVED_EVIDENCE_WINDOW_DAYS",
  "DISPUTE_EVIDENCE_STORAGE_KIND",
] as const;
const originals = ENV_KEYS.map((key) => process.env[key]);

afterEach(() => {
  ENV_KEYS.forEach((key, i) => {
    if (originals[i] === undefined) delete process.env[key];
    else process.env[key] = originals[i];
  });
});

const AT = new Date(Date.UTC(2026, 10, 19, 12, 0, 0));
const evidence: EvidenceRecord = {
  evidenceId: "evidence-1",
  disputeId: "dispute-1",
  filename: "proof.txt",
  contentType: "text/plain",
  sizeBytes: 12,
  uploadedByUserId: "buyer-1",
  at: AT,
};

function setPolicy() {
  process.env.DISPUTE_APPROVED_OUTCOMES = "owner-outcome-a,owner-outcome-b";
  process.env.DISPUTE_APPROVED_REASON_CODES = "owner-reason-a";
  process.env.DISPUTE_APPROVED_EVIDENCE_WINDOW_DAYS = "14";
}

describe("dispute decision-independent structure", () => {
  it("new flags default OFF and the startup guards still throw when enabled", () => {
    delete process.env.FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED;
    delete process.env.FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED;
    expect(config.features.disputeEvidenceUploadsEnabled).toBe(false);
    expect(config.features.approvedDisputeOutcomesEnabled).toBe(false);
    process.env.FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED = "true";
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED/);
    delete process.env.FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED;
    process.env.FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED = "true";
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED/);
  });

  it("approved policy and storage inputs have no defaults", () => {
    for (const key of ENV_KEYS.slice(2)) delete process.env[key];
    expect(config.disputes.approvedOutcomes).toBe("");
    expect(() => requireApprovedDisputePolicy()).toThrow(/NOT_CONFIGURED/);
    expect(() => requireEvidenceStorageConfigured()).toThrow(/NOT_CONFIGURED/);
    setPolicy();
    expect(requireApprovedDisputePolicy()).toEqual({
      outcomes: ["owner-outcome-a", "owner-outcome-b"],
      reasonCodes: ["owner-reason-a"],
      evidenceWindowDays: 14,
    });
  });

  it("evidence uploads and approved outcomes refuse while unset", () => {
    for (const key of ENV_KEYS.slice(2)) delete process.env[key];
    expect(() => assertEvidenceUploadsAllowed()).toThrow(/NOT_ENABLED/);
    expect(() => assertApprovedOutcomesAllowed()).toThrow(/NOT_ENABLED/);
    process.env.FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED = "true";
    expect(() => requireEvidenceStorageConfigured()).toThrow(/NOT_CONFIGURED/);
    process.env.DISPUTE_EVIDENCE_STORAGE_KIND = "in-memory-fake";
    process.env.FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED = "true";
    expect(() => assertApprovedOutcomesAllowed()).toThrow(/NOT_CONFIGURED/);
    setPolicy();
    expect(() => assertApprovedOutcomesAllowed()).not.toThrow();
  });

  it("evidence store is idempotent and audit entries are structured, not written", () => {
    const store = new InMemoryEvidenceStore();
    expect(store.add(evidence)).toBe("recorded");
    expect(store.add({ ...evidence, sizeBytes: 999 })).toBe("duplicate");
    expect(store.listForDispute("dispute-1")).toHaveLength(1);
    expect(auditEntryForEvidenceAccepted(evidence)).toMatchObject({
      action: "dispute.evidence_accepted",
      targetType: "dispute_evidence",
      createdAt: AT,
    });
    expect(auditEntryForStaffReview("dispute-1", "staff-1", AT)).toMatchObject({
      action: "dispute.staff_review_opened",
      targetType: "dispute",
    });
  });

  it("workflow skeleton reuses the existing dispute state machine", () => {
    expect(checkDisputeStatusTransition("open", "resolved")).toBe(true);
    expect(checkDisputeStatusTransition("resolved", "closed")).toBe(true);
    expect(checkDisputeStatusTransition("closed", "open")).toBe(false);
  });

  it("staff-review placeholder shows NOT_ENABLED and the route returns no data", async () => {
    for (const key of ENV_KEYS.slice(2)) delete process.env[key];
    expect(staffReviewPlaceholder()).toMatchObject({ enabled: false, message: "NOT_ENABLED" });
    const res = await request(createApp()).get("/admin/disputes/review-placeholder");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: false, message: "NOT_ENABLED" });
    expect(JSON.stringify(res.body)).not.toContain("dispute_id");
    setPolicy();
    process.env.FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED = "true";
    expect(staffReviewPlaceholder()).toMatchObject({ enabled: true, evidenceWindowDays: 14 });
  });
});
