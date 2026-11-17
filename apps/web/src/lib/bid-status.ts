import { messageForError } from "./errors";

/**
 * Bid status mapper (D3). Every status is conveyed by text, never colour alone.
 * PLACEHOLDER COPY (docs/16 §8 #6).
 */

export type BidTone = "pending" | "success" | "error";
export type BidStatus = { text: string; tone: BidTone };

export function bidStatus(state: "submitted" | "accepted" | "rejected", rawError?: string): BidStatus {
  if (state === "accepted") {
    return { text: "Accepted", tone: "success" }; // PLACEHOLDER COPY (docs/16 §8 #6)
  }
  if (state === "rejected") {
    return { text: `Rejected: ${messageForError(rawError)}`, tone: "error" }; // PLACEHOLDER COPY (docs/16 §8 #6)
  }
  return { text: "Submitted, waiting for confirmation", tone: "pending" }; // PLACEHOLDER COPY (docs/16 §8 #6)
}
