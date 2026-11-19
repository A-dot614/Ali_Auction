import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { config, assertSafeFeatureFlags, assertMoneyFlagsOffForProduction } from "../src/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.resolve(here, "../src/index.ts"), "utf8");

const GUARD_FLAGS = [
  "FEATURE_LIVE_BIDDING_ENABLED",
  "FEATURE_REAL_MONEY_PAYMENTS_ENABLED",
  "FEATURE_REAL_SHIPPING_RATES_ENABLED",
  "FEATURE_DISPUTE_EVIDENCE_UPLOADS_ENABLED",
  "FEATURE_APPROVED_DISPUTE_OUTCOMES_ENABLED",
  "FEATURE_EMAIL_CHANGE_ENABLED",
] as const;
const originals = GUARD_FLAGS.map((key) => process.env[key]);
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  GUARD_FLAGS.forEach((key, i) => {
    if (originals[i] === undefined) delete process.env[key];
    else process.env[key] = originals[i];
  });
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("startup guard pinning (no auction-rule behaviour)", () => {
  it("index invokes both existing guards unconditionally before serving requests", () => {
    expect(indexSource).toMatch(/assertSafeFeatureFlags\(\);/);
    expect(indexSource).toMatch(/assertMoneyFlagsOffForProduction\(\);/);
  });

  it("every decision-dependent feature flag defaults to false", () => {
    for (const key of GUARD_FLAGS) delete process.env[key];
    expect(config.features.liveBiddingEnabled).toBe(false);
    expect(config.features.realMoneyPaymentsEnabled).toBe(false);
    expect(config.features.realShippingRatesEnabled).toBe(false);
    expect(config.features.disputeEvidenceUploadsEnabled).toBe(false);
    expect(config.features.approvedDisputeOutcomesEnabled).toBe(false);
    expect(config.features.emailChangeEnabled).toBe(false);
  });

  it("the safe-flags guard rejects the live-bidding flag and the money flag", () => {
    for (const key of GUARD_FLAGS) delete process.env[key];
    process.env.FEATURE_LIVE_BIDDING_ENABLED = "true";
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_LIVE_BIDDING_ENABLED/);
    delete process.env.FEATURE_LIVE_BIDDING_ENABLED;
    process.env.FEATURE_REAL_MONEY_PAYMENTS_ENABLED = "true";
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_REAL_MONEY_PAYMENTS_ENABLED/);
  });

  it("the production money guard remains production-only", () => {
    process.env.NODE_ENV = "development";
    process.env.FEATURE_REAL_MONEY_PAYMENTS_ENABLED = "true";
    expect(() => assertMoneyFlagsOffForProduction()).not.toThrow();
    process.env.NODE_ENV = "production";
    expect(() => assertMoneyFlagsOffForProduction()).toThrow(/REAL_MONEY/);
  });
});
