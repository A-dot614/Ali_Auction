import { describe, expect, it } from "vitest";
import { calculateFeeMinor } from "../src/orders/fee.js";

describe("fee calculation (Slice 6)", () => {
  it("8% of 1000 = 80", () => {
    expect(calculateFeeMinor(1000, 800)).toBe(80);
  });

  it("rounds half up at .5 boundaries using integers only", () => {
    // 1 * 800bps = 0.08 -> 0; 7 * 800bps = 0.56 -> 1 (>= .5 rounds up)
    expect(calculateFeeMinor(1, 800)).toBe(0);
    expect(calculateFeeMinor(7, 800)).toBe(1);
    expect(calculateFeeMinor(6, 800)).toBe(0);
    expect(calculateFeeMinor(13, 800)).toBe(1);
    expect(calculateFeeMinor("1001", "800")).toBe(80);
  });

  it("zero subtotal = 0", () => {
    expect(calculateFeeMinor(0, 800)).toBe(0);
    expect(calculateFeeMinor("0", "0")).toBe(0);
  });

  it("rejects non-integer input", () => {
    expect(() => calculateFeeMinor(10.5, 800)).toThrow(/VALIDATION_ERROR/);
    expect(() => calculateFeeMinor("10.5", 800)).toThrow(/VALIDATION_ERROR/);
    expect(() => calculateFeeMinor(-1, 800)).toThrow(/VALIDATION_ERROR/);
  });
});
