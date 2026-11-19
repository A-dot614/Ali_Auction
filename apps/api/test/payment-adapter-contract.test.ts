import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { config, assertSafeFeatureFlags } from "../src/config.js";
import {
  InMemoryPaymentAdapter,
  requireConfiguredAdapterKind,
  unimplementedPaymentAdapter,
  type AdapterSessionInput,
} from "../src/payments/adapter.js";

const ADAPTER_KIND = "PAYMENTS_PROVIDER_ADAPTER_KIND";
const MONEY_FLAG = "FEATURE_REAL_MONEY_PAYMENTS_ENABLED";
const originalAdapterKind = process.env[ADAPTER_KIND];
const originalMoneyFlag = process.env[MONEY_FLAG];

afterEach(() => {
  for (const [name, original] of [
    [ADAPTER_KIND, originalAdapterKind],
    [MONEY_FLAG, originalMoneyFlag],
  ] as const) {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

const AT = new Date("2026-11-19T12:00:00.000Z");
const sessionInput: AdapterSessionInput = {
  paymentId: "payment-1",
  amountMinor: 5000,
  currency: "CAD",
  idempotencyKey: "request-1",
  returnUrl: "/checkout/return",
  cancelUrl: "/checkout/cancel",
  at: AT,
};

describe("provider-neutral hosted-payment adapter contract", () => {
  it("has no adapter kind by default and refuses to construct a real adapter", () => {
    delete process.env[ADAPTER_KIND];
    expect(config.payments.adapterKind).toBe("");
    expect(() => requireConfiguredAdapterKind()).toThrow(/NOT_CONFIGURED/);
  });

  it("fake adapter session creation is idempotent on the request key", () => {
    const adapter = new InMemoryPaymentAdapter("neutral-test-secret");
    const first = adapter.createSession(sessionInput);
    const second = adapter.createSession({ ...sessionInput, amountMinor: 9999 });
    expect(second).toEqual(first);
    expect(first.expiresAt.toISOString()).toBe("2026-11-19T12:30:00.000Z");
  });

  it("fake adapter confirmation and refund are idempotent on the request key", () => {
    const adapter = new InMemoryPaymentAdapter("neutral-test-secret");
    const session = adapter.createSession(sessionInput);
    const first = adapter.confirmSession({ sessionId: session.sessionId, idempotencyKey: "confirm-1", at: AT });
    expect(first.paymentId).toBe("payment-1");
    expect(adapter.confirmSession({ sessionId: session.sessionId, idempotencyKey: "confirm-1", at: AT })).toEqual(first);
    const refund = adapter.recordRefund({ paymentId: "payment-1", amountMinor: 100, idempotencyKey: "refund-1", at: AT });
    expect(
      adapter.recordRefund({ paymentId: "payment-1", amountMinor: 100, idempotencyKey: "refund-1", at: AT })
    ).toEqual(refund);
  });

  it("fake adapter verifies signatures and rejects tampered bodies", () => {
    const adapter = new InMemoryPaymentAdapter("neutral-test-secret");
    const body = '{"event_type":"payment.session_completed"}';
    const signature = createHmac("sha256", "neutral-test-secret").update(body).digest("hex");
    expect(adapter.verifyWebhook(body, { "x-neutral-signature": signature })).toBe(true);
    expect(adapter.verifyWebhook(`${body} `, { "x-neutral-signature": signature })).toBe(false);
    expect(adapter.verifyWebhook(body, { "x-neutral-signature": "short" })).toBe(false);
    expect(adapter.verifyWebhook(body, {})).toBe(false);
  });

  it("real-adapter slot is interface-only and throws NOT_IMPLEMENTED", () => {
    expect(() =>
      unimplementedPaymentAdapter.createSession({ ...sessionInput, idempotencyKey: "real-1" })
    ).toThrow(/NOT_IMPLEMENTED/);
    expect(() =>
      unimplementedPaymentAdapter.confirmSession({ sessionId: "x", idempotencyKey: "real-1", at: AT })
    ).toThrow(/NOT_IMPLEMENTED/);
    expect(() =>
      unimplementedPaymentAdapter.recordRefund({ paymentId: "x", amountMinor: 1, idempotencyKey: "real-1", at: AT })
    ).toThrow(/NOT_IMPLEMENTED/);
    expect(unimplementedPaymentAdapter.verifyWebhook("body", {})).toBe(false);
  });

  it("real-money flag still defaults OFF and the startup guard still throws when enabled", () => {
    delete process.env[MONEY_FLAG];
    expect(config.features.realMoneyPaymentsEnabled).toBe(false);
    process.env[MONEY_FLAG] = "true";
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_REAL_MONEY_PAYMENTS_ENABLED/);
  });
});
