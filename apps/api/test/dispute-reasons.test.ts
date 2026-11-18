import { describe, expect, it } from "vitest";
import { DISPUTE_OUTCOMES, DISPUTE_REASON_CODES } from "../src/disputes/service.js";

describe("dispute placeholder enums (Slice 12)", () => {
  it("reason code enum: exactly the four placeholder values", () => {
    expect([...DISPUTE_REASON_CODES]).toEqual([
      "item_not_as_described",
      "item_not_received",
      "damaged",
      "other",
    ]);
  });

  it("outcome enum: exactly the four placeholder values", () => {
    expect([...DISPUTE_OUTCOMES]).toEqual(["no_action", "refund_full", "refund_partial", "order_cancelled"]);
  });
});
