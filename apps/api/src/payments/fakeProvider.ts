import { createHmac } from "node:crypto";
import { hostedRedirectPath, isAllowedHostedUrl } from "./hostedSession.js";

/**
 * Fake/sandbox payment provider only (Slice 6, hosted contract added in Slice 13).
 * No real provider, SDK or network call is used.
 * NOT FOR PRODUCTION (docs/16 §5 OPEN).
 */

export type PaymentIntentInput = {
  orderId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
};

export type HostedSessionInput = {
  paymentId: string;
  amountMinor: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  at: Date;
  ttlMinutes: number;
};

export type HostedSession = {
  sessionId: string;
  redirectUrl: string;
  expiresAt: Date;
};

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: PaymentIntentInput): { providerPaymentId: string };
  createHostedSession(input: HostedSessionInput): HostedSession;
  verifyWebhook(rawBody: string, headers: Record<string, unknown>, secret: string): boolean;
}

export const fakePaymentProvider: PaymentProvider = {
  name: "fake",
  createPaymentIntent(input: PaymentIntentInput) {
    // Deterministic reference derived from the idempotency key; no clock/network.
    return { providerPaymentId: `fake_pi_${input.idempotencyKey}` };
  },
  createHostedSession(input: HostedSessionInput): HostedSession {
    if (!isAllowedHostedUrl(input.returnUrl) || !isAllowedHostedUrl(input.cancelUrl)) {
      throw new Error("VALIDATION_ERROR: returnUrl and cancelUrl must be allowlisted relative paths.");
    }
    // Deterministic fake session reference; no clock read outside the injected `at`.
    const sessionId = `fake_hs_${input.paymentId}`;
    return {
      sessionId,
      redirectUrl: hostedRedirectPath(sessionId),
      expiresAt: new Date(input.at.getTime() + input.ttlMinutes * 60_000),
    };
  },
  verifyWebhook(rawBody: string, headers: Record<string, unknown>, secret: string): boolean {
    const signature = headers["x-fake-signature"];
    if (typeof signature !== "string") return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (signature.length !== expected.length) return false;
    return signature === expected;
  },
};
