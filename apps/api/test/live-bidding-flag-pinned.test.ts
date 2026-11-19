import { afterEach, describe, expect, it } from "vitest";
import { assertSafeFeatureFlags, config } from "../src/config.js";

const FLAG = "FEATURE_LIVE_BIDDING_ENABLED";
const originalFlag = process.env[FLAG];

afterEach(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
});

describe("live bidding flag pinned OFF", () => {
  it("default config has liveBiddingEnabled === false", () => {
    delete process.env[FLAG];
    expect(config.features.liveBiddingEnabled).toBe(false);
  });

  it("assertSafeFeatureFlags() throws when FEATURE_LIVE_BIDDING_ENABLED=true", () => {
    process.env[FLAG] = "true";
    expect(config.features.liveBiddingEnabled).toBe(true);
    // The guard is unconditional: it does not require NODE_ENV=production.
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_LIVE_BIDDING_ENABLED/);
  });

  it("assertSafeFeatureFlags() does not throw while the flag is OFF", () => {
    delete process.env[FLAG];
    expect(config.features.liveBiddingEnabled).toBe(false);
    expect(() => assertSafeFeatureFlags()).not.toThrow();
  });
});
