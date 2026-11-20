"use client";

import { useState } from "react";
import {
  confirmDemoSession,
  createDemoHostedSession,
  recordDemoRefund,
  type DemoConfirmation,
  type DemoHostedSession,
  type DemoRefund,
} from "../lib/demo-payments";

/**
 * Demo-only checkout walkthrough. It renders provider-neutral fake adapter
 * shapes from local data. It never fetches, posts, redirects off-site or touches
 * a real payment path. The global demo banner is rendered by PageShell.
 */

type Step = "idle" | "session" | "success" | "failure" | "refunded";

const ORDER_ID = "demo-order-1";
const PAYMENT_ID = "fake_payment_demo_order_1";

export default function DemoCheckout() {
  const [step, setStep] = useState<Step>("idle");
  const [session, setSession] = useState<DemoHostedSession | null>(null);
  const [confirmation, setConfirmation] = useState<DemoConfirmation | null>(null);
  const [refund, setRefund] = useState<DemoRefund | null>(null);

  function startSession() {
    setSession(createDemoHostedSession(PAYMENT_ID, "demo-checkout-1"));
    setConfirmation(null);
    setRefund(null);
    setStep("session");
  }

  function confirm() {
    if (!session) return;
    setConfirmation(confirmDemoSession(session, "demo-confirm-1"));
    setStep("success");
  }

  function simulateFailure() {
    setConfirmation(null);
    setRefund(null);
    setStep("failure");
  }

  function simulateRefund() {
    setRefund(recordDemoRefund(PAYMENT_ID, "demo-refund-1"));
    setStep("refunded");
  }

  return (
    <section className="card" aria-labelledby="demo-checkout-heading">
      <h2 id="demo-checkout-heading">Demo checkout walkthrough</h2>
      <p><strong>Simulation only: nothing is charged and no payment decision is made.</strong></p>
      <p className="muted">Demo order: {ORDER_ID}. Amounts are not derived from any fee or shipping rule.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={startSession}>Start fake hosted session</button>
        <button type="button" onClick={confirm} disabled={!session}>Simulate success</button>
        <button type="button" onClick={simulateFailure}>Simulate failure</button>
        <button type="button" onClick={simulateRefund}>Simulate refund</button>
      </div>
      {session ? (
        <dl>
          <dt>Session ID</dt><dd>{session.sessionId}</dd>
          <dt>Payment ID</dt><dd>{session.paymentId}</dd>
          <dt>Redirect path (internal demo path)</dt><dd>{session.redirectPath}</dd>
          <dt>Expires at</dt><dd>{session.expiresAt}</dd>
        </dl>
      ) : null}
      {step === "failure" ? (
        <p role="status" className="tone-error">Demo failure state recorded locally. No charge was attempted.</p>
      ) : null}
      {confirmation ? (
        <p role="status" className="tone-success">
          Demo success state: {confirmation.status} for {confirmation.paymentId}.
        </p>
      ) : null}
      {refund ? (
        <p role="status">Demo refund state: {refund.status} ({refund.refundId}). No money moved.</p>
      ) : null}
    </section>
  );
}
