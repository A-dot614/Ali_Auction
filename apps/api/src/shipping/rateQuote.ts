import { config } from "../config.js";

/**
 * Provider-neutral shipping rate-quote interface and fake quoter (decision-independent
 * structure for FR-051). No carrier is named or selected. Currency, carriers, scope and
 * cost are required configuration inputs with NO defaults; real-rate mode refuses to run
 * until they are supplied and the flag is enabled. Decision-log FR-051 is still pending.
 */

export type ShippingQuoteRequest = {
  fromProvince: string;
  toProvince: string;
};

export type ShippingQuote = {
  mode: "flat" | "real_rates";
  amountMinor: number;
  currency: string;
  carriers: string;
  scope: string;
  source: "fake" | "unimplemented";
};

export interface ShippingQuoter {
  quote(request: ShippingQuoteRequest): ShippingQuote;
}

export type RealRateInputs = {
  currency: string;
  carriers: string;
  scope: string;
  amountMinor: number;
};

/** Required decision-dependent inputs: no default values exist. */
export function requireRealRateInputs(): RealRateInputs {
  const f = config.fulfilment;
  const missing = [
    !f.rateCurrency.trim() && "SHIPPING_RATE_CURRENCY",
    !f.rateCarriers.trim() && "SHIPPING_CARRIERS",
    !f.rateScope.trim() && "SHIPPING_SCOPE",
    f.rateAmountMinor.trim() === "" && "SHIPPING_RATE_AMOUNT_MINOR",
  ].filter((name): name is string => typeof name === "string");
  if (missing.length > 0) {
    throw new Error(`NOT_CONFIGURED: real shipping rates require ${missing.join(", ")} (no defaults).`);
  }
  const amountMinor = Number(f.rateAmountMinor);
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error("VALIDATION_ERROR: SHIPPING_RATE_AMOUNT_MINOR must be a non-negative integer.");
  }
  return {
    currency: f.rateCurrency.trim(),
    carriers: f.rateCarriers.trim(),
    scope: f.rateScope.trim(),
    amountMinor,
  };
}

/** Checkout guard: real-rate mode stays unavailable until the decision and inputs exist. */
export function assertRealRateModeAllowed(mode?: "flat" | "real_rates"): void {
  if (mode !== "real_rates") return;
  if (!config.features.realShippingRatesEnabled) {
    throw new Error("NOT_ENABLED: real shipping rates are not enabled.");
  }
  requireRealRateInputs();
}

export const fakeShippingQuoter: ShippingQuoter = {
  quote() {
    const inputs = requireRealRateInputs();
    return { mode: "real_rates", source: "fake", ...inputs };
  },
};

/** Real quoter slot: interface only, no integration, no network client. */
export const unimplementedShippingQuoter: ShippingQuoter = {
  quote() {
    throw new Error("NOT_IMPLEMENTED: no real shipping-rate adapter exists.");
  },
};

export function quoteShipping(
  mode: "flat" | "real_rates" = "flat",
  request: ShippingQuoteRequest,
  quoter: ShippingQuoter = fakeShippingQuoter
): ShippingQuote {
  assertRealRateModeAllowed(mode);
  if (mode === "flat") {
    return {
      mode: "flat",
      amountMinor: config.fulfilment.flatShippingEstimateMinor,
      currency: "CAD",
      carriers: "",
      scope: "",
      source: "fake",
    };
  }
  void request;
  return quoter.quote(request);
}
