import { createHmac } from "node:crypto";
import { config } from "../config.js";
import { isAllowedHostedUrl } from "./hostedSession.js";

/**
 * Provider-neutral hosted-payment adapter contract (decision-independent structure).
 * No real provider is named, chosen or integrated. Only an in-memory fake and an
 * unimplemented real-adapter slot exist. FR-042 stays NOT MET (decision-log FR-042).
 */

export type AdapterSessionInput = {
  paymentId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  returnUrl: string;
  cancelUrl: string;
  at: Date;
};
export type AdapterSession = {
  sessionId: string;
  paymentId: string;
  redirectPath: string;
  expiresAt: Date;
};
export type AdapterConfirmInput = { sessionId: string; idempotencyKey: string; at: Date };
export type AdapterConfirmation = { paymentId: string; status: "confirmation_recorded" };
export type AdapterRefundInput = {
  paymentId: string;
  amountMinor: number;
  idempotencyKey: string;
  at: Date;
};
export type AdapterRefund = { refundId: string; status: "refund_recorded" };

export interface HostedPaymentAdapter {
  readonly kind: string;
  createSession(input: AdapterSessionInput): AdapterSession;
  confirmSession(input: AdapterConfirmInput): AdapterConfirmation;
  verifyWebhook(rawBody: string, headers: Record<string, unknown>): boolean;
  recordRefund(input: AdapterRefundInput): AdapterRefund;
}

/** Required decision-dependent input: no default value exists. */
export function requireConfiguredAdapterKind(): string {
  const kind = config.payments.adapterKind.trim();
  if (!kind) {
    throw new Error("NOT_CONFIGURED: PAYMENTS_PROVIDER_ADAPTER_KIND has no default; a decision is required.");
  }
  return kind;
}

/** Real-adapter slot: an interface only, with no implementation and no credentials. */
export const unimplementedPaymentAdapter: HostedPaymentAdapter = {
  kind: "unimplemented",
  createSession() {
    throw new Error("NOT_IMPLEMENTED: no real payment adapter exists.");
  },
  confirmSession() {
    throw new Error("NOT_IMPLEMENTED: no real payment adapter exists.");
  },
  verifyWebhook() {
    return false;
  },
  recordRefund() {
    throw new Error("NOT_IMPLEMENTED: no real payment adapter exists.");
  },
};

/**
 * In-memory fake used for contract tests only. Deterministic references derived from
 * the idempotency key; no clock read outside the injected `at`, no network, no storage.
 */
export class InMemoryPaymentAdapter implements HostedPaymentAdapter {
  readonly kind = "in-memory-fake";
  private readonly sessionsByKey = new Map<string, AdapterSession>();
  private readonly sessionsById = new Map<string, AdapterSession>();
  private readonly confirmationsByKey = new Map<string, AdapterConfirmation>();
  private readonly refundsByKey = new Map<string, AdapterRefund>();

  constructor(private readonly webhookSecret: string) {}

  createSession(input: AdapterSessionInput): AdapterSession {
    if (!isAllowedHostedUrl(input.returnUrl) || !isAllowedHostedUrl(input.cancelUrl)) {
      throw new Error("VALIDATION_ERROR: return/cancel paths must be allowlisted.");
    }
    const prior = this.sessionsByKey.get(input.idempotencyKey);
    if (prior) return prior;
    const sessionId = `fake_session_${input.idempotencyKey}`;
    const session: AdapterSession = {
      sessionId,
      paymentId: input.paymentId,
      redirectPath: `/test/payments/hosted-session/${sessionId}`,
      expiresAt: new Date(input.at.getTime() + 30 * 60_000),
    };
    this.sessionsByKey.set(input.idempotencyKey, session);
    this.sessionsById.set(sessionId, session);
    return session;
  }

  confirmSession(input: AdapterConfirmInput): AdapterConfirmation {
    const prior = this.confirmationsByKey.get(input.idempotencyKey);
    if (prior) return prior;
    const session = this.sessionsById.get(input.sessionId);
    if (!session) throw new Error("NOT_FOUND: Hosted session not found.");
    const confirmation: AdapterConfirmation = {
      paymentId: session.paymentId,
      status: "confirmation_recorded",
    };
    this.confirmationsByKey.set(input.idempotencyKey, confirmation);
    return confirmation;
  }

  verifyWebhook(rawBody: string, headers: Record<string, unknown>): boolean {
    const signature = headers["x-neutral-signature"];
    if (typeof signature !== "string") return false;
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    if (signature.length !== expected.length) return false;
    return signature === expected;
  }

  recordRefund(input: AdapterRefundInput): AdapterRefund {
    const prior = this.refundsByKey.get(input.idempotencyKey);
    if (prior) return prior;
    const refund: AdapterRefund = {
      refundId: `fake_refund_${input.idempotencyKey}`,
      status: "refund_recorded",
    };
    this.refundsByKey.set(input.idempotencyKey, refund);
    return refund;
  }
}
