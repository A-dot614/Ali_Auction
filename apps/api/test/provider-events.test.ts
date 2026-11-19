import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { config } from "../src/config.js";
import { InMemoryPaymentAdapter } from "../src/payments/adapter.js";
import {
  InMemoryProviderEventStore,
  canApplyEvent,
  requireChargebackTreatment,
  stateForEventKind,
} from "../src/payments/providerEvents.js";

const TREATMENT = "PAYMENTS_CHARGEBACK_TREATMENT";
const originalTreatment = process.env[TREATMENT];
const AT = new Date("2026-11-19T12:00:00.000Z");

afterEach(() => {
  if (originalTreatment === undefined) delete process.env[TREATMENT];
  else process.env[TREATMENT] = originalTreatment;
});

describe("provider-neutral refund / failure / dispute records", () => {
  it("chargeback treatment is a required input with no default", () => {
    delete process.env[TREATMENT];
    expect(config.payments.chargebackTreatment).toBe("");
    expect(() => requireChargebackTreatment()).toThrow(/NOT_CONFIGURED/);
    process.env[TREATMENT] = "owner-supplied-value";
    expect(requireChargebackTreatment()).toBe("owner-supplied-value");
  });

  it("records are idempotent on the provider event id and transitions are validated", () => {
    const store = new InMemoryProviderEventStore();
    const event = {
      eventId: "event-1",
      kind: "refund_recorded" as const,
      paymentId: "payment-1",
      amountMinor: 100,
      at: AT,
    };
    expect(store.record(event)).toMatchObject({ outcome: "recorded", state: "refunded" });
    expect(store.record({ ...event, amountMinor: 999 })).toMatchObject({ outcome: "duplicate", amountMinor: 100 });
    expect(store.list()).toHaveLength(1);
    expect(store.stateOf("payment-1")).toBe("refunded");
    expect(canApplyEvent("dispute_closed", "dispute_opened")).toBe(false);
    expect(stateForEventKind("dispute_closed")).toBe("dispute_closed");
    const closed = new InMemoryProviderEventStore();
    closed.record({ eventId: "event-2", kind: "dispute_closed", paymentId: "payment-3", at: AT });
    expect(() =>
      closed.record({ eventId: "event-3", kind: "dispute_opened", paymentId: "payment-3", at: AT })
    ).toThrow(/INVALID_PROVIDER_EVENT/);
  });

  it("records provider-neutral events from fake adapter operations without fee or payout rules", () => {
    const adapter = new InMemoryPaymentAdapter("neutral-test-secret");
    const body = JSON.stringify({ event_type: "refund_recorded" });
    const signature = createHmac("sha256", "neutral-test-secret").update(body).digest("hex");
    expect(adapter.verifyWebhook(body, { "x-neutral-signature": signature })).toBe(true);
    const refund = adapter.recordRefund({
      paymentId: "payment-2",
      amountMinor: 250,
      idempotencyKey: "refund-2",
      at: AT,
    });
    const store = new InMemoryProviderEventStore();
    const record = store.record({
      eventId: refund.refundId,
      kind: "refund_recorded",
      paymentId: "payment-2",
      amountMinor: 250,
      at: AT,
    });
    expect(record).toMatchObject({ outcome: "recorded", state: "refunded", amountMinor: 250 });
    expect(Object.keys(record).some((key) => /fee|payout|tax/i.test(key))).toBe(false);
  });
});
