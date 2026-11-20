/**
 * Demo shipping quote in the API's fake quoter response shape. Carrier, scope
 * and cost are placeholders, not approved values: no shipping decision is made.
 */

export type DemoShippingQuote = {
  mode: "flat" | "real_rates";
  amountMinor: number;
  currency: "CAD";
  carriers: string;
  scope: string;
  source: "fake" | "unimplemented";
};

export const DEMO_SHIPPING_QUOTE: DemoShippingQuote = {
  mode: "real_rates",
  amountMinor: 1250,
  currency: "CAD",
  carriers: "not chosen (demo placeholder)",
  scope: "not chosen (demo placeholder)",
  source: "fake",
};

export function demoQuoteForRoute(_fromProvince: string, _toProvince: string): DemoShippingQuote {
  // Route is accepted for the quote form but never used to infer a decision.
  return DEMO_SHIPPING_QUOTE;
}
