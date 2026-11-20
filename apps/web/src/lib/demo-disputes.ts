/**
 * In-memory demo dispute records. Mirrors the API's decision-independent
 * evidence/review shape without storing files or making any outcome decision.
 */

export type DemoEvidence = { id: string; filename: string; sizeBytes: number };
export type DemoDispute = {
  id: string;
  orderId: string;
  reasonLabel: string;
  status: string;
  evidence: DemoEvidence[];
  openedAtIso: string;
};

export const DEMO_DISPUTES: DemoDispute[] = [
  {
    id: "demo-dispute-1",
    orderId: "demo-order-1",
    reasonLabel: "Demo reason (not an approved reason code)",
    status: "open (demo state)",
    evidence: [{ id: "demo-evidence-1", filename: "demo-note.txt", sizeBytes: 24 }],
    openedAtIso: "2026-11-18T10:00:00.000Z",
  },
];

export const DEMO_DISPUTE_REASON_PLACEHOLDER = "not chosen (demo placeholder)";
