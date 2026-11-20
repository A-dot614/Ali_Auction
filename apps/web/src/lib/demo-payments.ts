/**
 * Demo payment helper. Uses only the provider-neutral response shapes from the
 * API's in-memory fake adapter. No provider, SDK, credential, network call or
 * money movement is involved. No fee, capture or payout rule is represented.
 */

export type DemoHostedSession = {
  sessionId: string;
  paymentId: string;
  redirectPath: string;
  expiresAt: string;
};

export type DemoConfirmation = { paymentId: string; status: "confirmation_recorded" };
export type DemoRefund = { refundId: string; status: "refund_recorded" };

export function createDemoHostedSession(paymentId: string, requestId: string): DemoHostedSession {
  const sessionId = `fake_session_${requestId}`;
  return {
    sessionId,
    paymentId,
    redirectPath: `/test/payments/hosted-session/${sessionId}`,
    expiresAt: "2026-11-20T12:30:00.000Z",
  };
}

export function confirmDemoSession(session: DemoHostedSession, requestId: string): DemoConfirmation {
  void requestId;
  return { paymentId: session.paymentId, status: "confirmation_recorded" };
}

export function recordDemoRefund(paymentId: string, requestId: string): DemoRefund {
  void paymentId;
  return { refundId: `fake_refund_${requestId}`, status: "refund_recorded" };
}
