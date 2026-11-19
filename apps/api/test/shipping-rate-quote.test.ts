import { afterEach, describe, expect, it } from "vitest";
import { config, assertSafeFeatureFlags } from "../src/config.js";
import {
  assertRealRateModeAllowed,
  fakeShippingQuoter,
  quoteShipping,
  requireRealRateInputs,
  unimplementedShippingQuoter,
} from "../src/shipping/rateQuote.js";
import { createCheckout, startHostedCheckout } from "../src/payments/service.js";

const ENV_KEYS = [
  "FEATURE_REAL_SHIPPING_RATES_ENABLED",
  "SHIPPING_RATE_CURRENCY",
  "SHIPPING_CARRIERS",
  "SHIPPING_SCOPE",
  "SHIPPING_RATE_AMOUNT_MINOR",
] as const;
const originals = ENV_KEYS.map((key) => process.env[key]);

afterEach(() => {
  ENV_KEYS.forEach((key, i) => {
    if (originals[i] === undefined) delete process.env[key];
    else process.env[key] = originals[i];
  });
});

function setRealRateConfig() {
  process.env.SHIPPING_RATE_CURRENCY = "CAD";
  process.env.SHIPPING_CARRIERS = "owner-supplied-carrier-list";
  process.env.SHIPPING_SCOPE = "owner-supplied-scope";
  process.env.SHIPPING_RATE_AMOUNT_MINOR = "1250";
}

describe("shipping rate quotes (decision-independent structure)", () => {
  it("real-rate flag defaults OFF and the startup guard throws when enabled", () => {
    delete process.env.FEATURE_REAL_SHIPPING_RATES_ENABLED;
    expect(config.features.realShippingRatesEnabled).toBe(false);
    process.env.FEATURE_REAL_SHIPPING_RATES_ENABLED = "true";
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_REAL_SHIPPING_RATES_ENABLED/);
  });

  it("rate inputs have no defaults and real-rate mode refuses while unset", () => {
    for (const key of ENV_KEYS.slice(1)) delete process.env[key];
    expect(config.fulfilment.rateCurrency).toBe("");
    expect(() => requireRealRateInputs()).toThrow(/NOT_CONFIGURED/);
    expect(() => assertRealRateModeAllowed("real_rates")).toThrow(/NOT_ENABLED/);
    expect(() => quoteShipping("flat", { fromProvince: "AB", toProvince: "BC" })).not.toThrow();
  });

  it("real-rate mode requires both the flag and the rate inputs", () => {
    setRealRateConfig();
    expect(() => quoteShipping("real_rates", { fromProvince: "AB", toProvince: "BC" })).toThrow(/NOT_ENABLED/);
    process.env.FEATURE_REAL_SHIPPING_RATES_ENABLED = "true";
    const quote = quoteShipping("real_rates", { fromProvince: "AB", toProvince: "BC" }, fakeShippingQuoter);
    expect(quote).toMatchObject({ mode: "real_rates", source: "fake", amountMinor: 1250, currency: "CAD" });
    expect(() =>
      quoteShipping("real_rates", { fromProvince: "AB", toProvince: "BC" }, unimplementedShippingQuoter)
    ).toThrow(/NOT_IMPLEMENTED/);
  });

  it("checkout refuses real-rate mode before any database work", async () => {
    await expect(
      createCheckout(
        "order-1",
        "buyer-1",
        { acceptedTotalMinor: 1, fulfilmentChoice: "shipping", requestId: "r1", shippingMode: "real_rates" },
        { moneyEnabled: true }
      )
    ).rejects.toThrow(/NOT_ENABLED/);
    await expect(
      startHostedCheckout("order-1", "buyer-1", "r2", { moneyEnabled: true, shippingMode: "real_rates" })
    ).rejects.toThrow(/NOT_ENABLED/);
  });
});
