import { createHmac } from "node:crypto";

/**
 * Fake/sandbox payment provider only (Slice 6). No Stripe/PayPal/network calls.
 * NOT FOR PRODUCTION (docs/16 §5 OPEN).
 */

export type PaymentIntentInput = {
  orderId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
};

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: PaymentIntentInput): { providerPaymentId: string };
  verifyWebhook(rawBody: string, headers: Record<string, unknown>, secret: string): boolean;
}

export const fakePaymentProvider: PaymentProvider = {
  name: "fake",
  createPaymentIntent(input: PaymentIntentInput) {
    // Deterministic reference derived from the idempotency key; no clock/network.
    return { providerPaymentId: `fake_pi_${input.idempotencyKey}` };
  },
  verifyWebhook(rawBody: string, headers: Record<string, unknown>, secret: string): boolean {
    const signature = headers["x-fake-signature"];
    if (typeof signature !== "string") return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (signature.length !== expected.length) return false;
    return signature === expected;
  },
};
