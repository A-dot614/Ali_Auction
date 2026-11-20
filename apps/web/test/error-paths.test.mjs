import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateForFailure } from "../src/lib/error-state.ts";
import { messageForError } from "../src/lib/errors.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NEUTRAL_MESSAGES = new Set([
  "Not enabled yet.",
  "Bidding is not available yet.",
  "Payments are not available yet.",
  "We could not reach the service. Please try again.",
  "Please sign in to continue.",
  "You do not have permission to do that.",
  "Something went wrong. Please try again.",
]);

test("NOT_ENABLED and disabled-capability codes produce a clear, neutral state", () => {
  for (const raw of [
    "NOT_ENABLED: email change is not implemented.",
    "LIVE_BIDDING_DISABLED: Live bidding is not enabled.",
    "REAL_MONEY_DISABLED: Real-money flows are disabled.",
  ]) {
    const result = stateForFailure(raw);
    assert.equal(result.state, "not-enabled", raw);
    assert.ok(NEUTRAL_MESSAGES.has(result.detail), `${raw} -> ${result.detail}`);
    assert.ok(!/NOT_ENABLED|LIVE_BIDDING|REAL_MONEY|not implemented/.test(result.detail), "no raw server text");
  }
});

test("network failure and empty/unknown responses never crash or echo server text", () => {
  const network = stateForFailure("NETWORK_ERROR");
  assert.equal(network.state, "error");
  assert.equal(network.detail, "We could not reach the service. Please try again.");

  const unknown = stateForFailure("BRAND_NEW_CODE: internal host db-17/secret");
  assert.equal(unknown.state, "error");
  assert.equal(unknown.detail, "Something went wrong. Please try again.");
  assert.ok(!unknown.detail.includes("db-17"), "no raw detail");

  assert.equal(stateForFailure(undefined).state, "error");
  assert.equal(messageForError(undefined), "Something went wrong. Please try again.");
});

test("permission failures keep their own neutral state", () => {
  for (const [raw, expected] of [
    ["FORBIDDEN: secret role details", "permission-denied"],
    ["UNAUTHENTICATED: token from host 10.0.0.1", "permission-denied"],
  ]) {
    const result = stateForFailure(raw);
    assert.equal(result.state, expected);
    assert.ok(NEUTRAL_MESSAGES.has(result.detail));
    assert.ok(!/secret role details|10\.0\.0\.1/.test(result.detail));
  }
});

test("real-mode pages render explicit empty, failure and not-enabled states", () => {
  const listing = fs.readFileSync(path.join(root, "src/app/listings/[slug]/page.tsx"), "utf8");
  assert.match(listing, /catch\s*\{[\s\S]*?failure = "NETWORK_ERROR"/, "transport failures are labelled");
  assert.match(listing, /stateForFailure\(failure\)/, "failures use the shared neutral mapper");
  assert.match(listing, /state === "not-enabled"/, "not-enabled has its own branch");
  assert.match(listing, /<NotEnabled message="Not enabled yet" detail=\{detail\} \/>/);
  assert.match(listing, /<ScreenState state=\{state\} \/>/);
  assert.match(listing, /<p className="muted">\{detail\}<\/p>/, "failure detail is shown as neutral copy");
  assert.match(listing, /!data\?\.listing[\s\S]*?<ScreenState state="empty" \/>/, "missing listing uses empty state");
  assert.match(listing, /auction \?[\s\S]*?:[\s\S]*?<ScreenState state="empty" \/>/, "missing auction uses empty state");
  assert.ok(!/<h1\b/.test(listing), "failure branches do not add a second h1");

  const auth = fs.readFileSync(path.join(root, "src/components/AuthForm.tsx"), "utf8");
  assert.match(auth, /messageForError/, "auth form errors use neutral mapping");

  const states = fs.readFileSync(path.join(root, "src/lib/states.ts"), "utf8");
  assert.ok(states.includes('empty: "Nothing here yet."'), "scaffold pages keep a clear empty message");
  assert.ok(states.includes('error: "Something went wrong. Please try again."'));
});
