/**
 * Fee calculation (Slice 6). Integer minor units only, no floats.
 * Placeholder: buyer fee from the source plan (8%), pending approval.
 * TODO(docs/16 §4 #1-#4): fee payer, base, tax and refund treatment are OPEN. NOT FOR PRODUCTION.
 */

function toIntegerMinor(value: number | string): bigint {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("VALIDATION_ERROR: amount must be a non-negative integer in minor units.");
    }
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) {
      throw new Error("VALIDATION_ERROR: amount must be a non-negative integer in minor units.");
    }
    return BigInt(value);
  }
  throw new Error("VALIDATION_ERROR: amount must be a non-negative integer in minor units.");
}

export function calculateFeeMinor(subtotalMinor: number | string, rateBps: number | string): number {
  const subtotal = toIntegerMinor(subtotalMinor);
  const bps = toIntegerMinor(rateBps);
  if (bps > 10000n) throw new Error("VALIDATION_ERROR: rate_bps must be between 0 and 10000.");
  // round-half-up on non-negative integers: floor((subtotal * bps + 5000) / 10000).
  const fee = (subtotal * bps + 5000n) / 10000n;
  return Number(fee);
}
