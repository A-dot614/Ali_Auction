import test from "node:test";
import assert from "node:assert/strict";
import {
  serverOffsetMs,
  remainingMs,
  remainingFromServer,
  formatCountdown,
} from "../src/lib/countdown.ts";

const NOW = 1_700_000_000_000;

test("countdown: remaining time computed from server offset", () => {
  const serverTime = new Date(NOW + 5_000).toISOString(); // server 5s ahead of client
  const offset = serverOffsetMs(serverTime, NOW);
  assert.equal(offset, 5_000);
  const endsAt = NOW + 65_000;
  assert.equal(remainingMs(endsAt, NOW, offset), 60_000);
  assert.equal(remainingFromServer(endsAt, serverTime), 60_000);
});

test("countdown: never negative", () => {
  assert.equal(remainingMs(NOW - 10, NOW, 0), 0);
  const aheadServer = new Date(NOW + 3_000).toISOString();
  assert.equal(remainingFromServer(NOW + 1_000, aheadServer), 0);
});

test("countdown: formats to placeholder text", () => {
  assert.equal(formatCountdown(0), "Auction ended");
  assert.match(formatCountdown(90_000), /1m 30s remaining/);
  assert.match(formatCountdown(3_600_000), /1h 0m remaining/);
  assert.match(formatCountdown(172_800_000), /2d 0h remaining/);
});
