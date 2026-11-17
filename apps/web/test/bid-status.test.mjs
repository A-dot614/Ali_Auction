import test from "node:test";
import assert from "node:assert/strict";
import { bidStatus } from "../src/lib/bid-status.ts";

test("bid status mapper: submitted, accepted, and each stable error code map to a non-colour status with text", () => {
  const submitted = bidStatus("submitted");
  assert.equal(submitted.tone, "pending");
  assert.match(submitted.text, /Submitted, waiting for confirmation/);

  const accepted = bidStatus("accepted");
  assert.equal(accepted.tone, "success");
  assert.equal(accepted.text, "Accepted");

  const codes = ["BID_TOO_LOW", "AUCTION_NOT_OPEN", "LIVE_BIDDING_DISABLED", "FORBIDDEN", "VALIDATION_ERROR", "UNKNOWN"];
  for (const code of codes) {
    const rejected = bidStatus("rejected", `${code}: raw server detail that must not appear`);
    assert.equal(rejected.tone, "error");
    assert.ok(rejected.text.startsWith("Rejected:"));
    assert.ok(rejected.text.length > "Rejected:".length);
    assert.ok(!rejected.text.includes("raw server detail"), "raw server text must not be rendered");
  }
});
