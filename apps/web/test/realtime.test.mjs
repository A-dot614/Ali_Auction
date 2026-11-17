import test from "node:test";
import assert from "node:assert/strict";
import { realtimeEnabled, subscribeOrFallback } from "../src/lib/realtime.ts";

test("real-time flag: OFF by default; ON falls back to refetch", async () => {
  assert.equal(realtimeEnabled({ realtimeEnabled: false }), false);
  assert.equal(realtimeEnabled({ realtimeEnabled: true }), true);

  let refetches = 0;
  const refetch = () => { refetches += 1; };
  await subscribeOrFallback(refetch, { realtimeEnabled: false });
  await subscribeOrFallback(refetch, { realtimeEnabled: true });
  assert.equal(refetches, 2);

  const logs = [];
  await subscribeOrFallback(refetch, { realtimeEnabled: true }, (m) => logs.push(m));
  assert.equal(refetches, 3);
  assert.ok(logs.some((l) => l.includes("TODO")));
});
