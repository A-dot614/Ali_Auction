import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";
import { fakePaymentProvider, type PaymentProvider } from "./fakeProvider.js";
import { assertTransition, type PaymentStatus } from "./paymentStateMachine.js";
import { loadOrder, transitionOrder, type OrderRow } from "../orders/service.js";

/**
 * Checkout, webhook processing and refunds (Slice 6, sandbox only).
 * D1: every money-moving path checks the flag first and writes nothing when OFF.
 * D4/D5/D6/D8. Timestamps come only from the injected clock.
 */

export type PaymentServiceOptions = {
  now?: () => Date;
  moneyEnabled?: boolean;
  provider?: PaymentProvider;
  webhookSecret?: string;
};

export type PaymentView = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amountMinor: string;
  capturedAmountMinor: string;
  refundedAmountMinor: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

type Viewer = { id: string; roles: string[] };

function requireMoneyEnabled(opts?: PaymentServiceOptions): void {
  const enabled = opts?.moneyEnabled ?? config.features.realMoneyPaymentsEnabled;
  if (!enabled) throw new Error("REAL_MONEY_DISABLED: Real-money flows are disabled.");
}

function providerOf(opts?: PaymentServiceOptions): PaymentProvider {
  return opts?.provider ?? fakePaymentProvider;
}

function mapPayment(row: any): PaymentView {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    amountMinor: String(row.amount_minor),
    capturedAmountMinor: String(row.captured_amount_minor),
    refundedAmountMinor: String(row.refunded_amount_minor),
    currency: row.currency,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** D4: server computes the total; the client's acceptedTotal is only compared, never charged. */
export async function createCheckout(
  orderId: string,
  buyerUserId: string,
  input: { acceptedTotalMinor: number | string; fulfilmentChoice: string; requestId: string },
  opts?: PaymentServiceOptions
): Promise<PaymentView> {
  requireMoneyEnabled(opts);
  const now = opts?.now ?? (() => new Date());
  const at = now();
  const provider = providerOf(opts);
  const order = await loadOrder(orderId);
  if (!order || order.buyer_user_id !== buyerUserId) throw new Error("NOT_FOUND: Order not found.");
  if (input.fulfilmentChoice !== "shipping" && input.fulfilmentChoice !== "local_pickup") {
    throw new Error("VALIDATION_ERROR: Invalid fulfilment_choice.");
  }
  const accepted = typeof input.acceptedTotalMinor === "string" ? Number(input.acceptedTotalMinor) : input.acceptedTotalMinor;
  if (!Number.isInteger(accepted) || accepted !== Number(order.total_minor)) {
    throw new Error("TOTAL_MISMATCH: Accepted total does not match the server total.");
  }
  const existing = await query(`SELECT * FROM payment_transactions WHERE idempotency_key = $1`, [input.requestId]);
  if ((existing.rowCount ?? 0) > 0) {
    const row = existing.rows[0];
    if (row.order_id !== orderId || row.provider !== provider.name) {
      throw new Error("REQUEST_ID_CONFLICT: request_id was already used for another payment.");
    }
    return mapPayment(row);
  }
  const intent = provider.createPaymentIntent({
    orderId,
    amountMinor: Number(order.total_minor),
    currency: "CAD",
    idempotencyKey: input.requestId,
  });
  const inserted = await query(
    `INSERT INTO payment_transactions (order_id, provider, provider_payment_id, idempotency_key, status,
                                       amount_minor, currency, captured_amount_minor, refunded_amount_minor, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'created',$5,'CAD',0,0,$6,$6)
     RETURNING *`,
    [orderId, provider.name, intent.providerPaymentId, input.requestId, Number(order.total_minor), at]
  );
  return mapPayment(inserted.rows[0]);
}

export type WebhookResult = { outcome: "processed" | "duplicate" | "unknown"; eventType?: string };

/** D5/D6: verify signature first, dedupe, then process in one transaction. */
export async function handleWebhook(
  providerName: string,
  rawBody: string,
  headers: Record<string, unknown>,
  opts?: PaymentServiceOptions
): Promise<WebhookResult> {
  requireMoneyEnabled(opts);
  const now = opts?.now ?? (() => new Date());
  const at = now();
  const provider = providerOf(opts);
  if (providerName !== provider.name) throw new Error("UNSUPPORTED_PROVIDER: Only the fake provider is available.");
  const secret = opts?.webhookSecret ?? config.payments.fakeWebhookSecret;
  if (!provider.verifyWebhook(rawBody, headers, secret)) {
    throw new Error("INVALID_SIGNATURE: Webhook signature verification failed.");
  }
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error("VALIDATION_ERROR: Invalid webhook payload.");
  }
  const eventId = String(body?.provider_event_id ?? "");
  const eventType = String(body?.event_type ?? "");
  const providerPaymentId = String(body?.provider_payment_id ?? "");
  if (!eventId || !providerPaymentId) throw new Error("VALIDATION_ERROR: Missing provider event/payment id.");

  return withTransaction(async (client) => {
    const recorded = await client.query(
      `INSERT INTO webhook_events (provider, provider_event_id, event_type, payload, received_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      [providerName, eventId, eventType, JSON.stringify(body), at]
    );
    if ((recorded.rowCount ?? 0) === 0) return { outcome: "duplicate", eventType };

    const paymentRes = await client.query(
      `SELECT * FROM payment_transactions WHERE provider=$1 AND provider_payment_id=$2`,
      [providerName, providerPaymentId]
    );
    if ((paymentRes.rowCount ?? 0) === 0) {
      // Unknown payment: event is stored but left unprocessed (processed_at stays NULL).
      return { outcome: "unknown", eventType };
    }
    const payment = paymentRes.rows[0];
    if (eventType === "payment.succeeded" && payment.status === "created") {
      assertTransition(payment.status as PaymentStatus, "captured");
      await client.query(
        `UPDATE payment_transactions SET status='captured', captured_amount_minor=$2, updated_at=$3 WHERE id=$1`,
        [payment.id, payment.amount_minor, at]
      );
      await recordAudit(
        { actorUserId: null, action: "payment.captured", targetType: "payment_transaction", targetId: payment.id, metadata: { eventId } },
        client
      );
      const order = await client.query(`SELECT * FROM orders WHERE id=$1`, [payment.order_id]);
      if ((order.rowCount ?? 0) > 0 && (order.rows[0] as OrderRow).status === "awaiting_payment") {
        await transitionOrder(client, order.rows[0] as OrderRow, "paid", null, "payment.succeeded", at);
        // Slice 8 (D2): order transition to paid notifies the seller via the outbox.
        await client.query(
          `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
           VALUES ('order', $1, 'order.paid', $2::jsonb, $3)`,
          [payment.order_id, JSON.stringify({ orderId: payment.order_id }), at]
        );
      }
    } else if (eventType === "payment.failed" && payment.status === "created") {
      assertTransition(payment.status as PaymentStatus, "failed");
      await client.query(`UPDATE payment_transactions SET status='failed', updated_at=$2 WHERE id=$1`, [payment.id, at]);
      await recordAudit(
        { actorUserId: null, action: "payment.failed", targetType: "payment_transaction", targetId: payment.id, metadata: { eventId } },
        client
      );
    }
    await client.query(`UPDATE webhook_events SET processed_at=$1 WHERE provider=$2 AND provider_event_id=$3`, [at, providerName, eventId]);
    return { outcome: "processed", eventType };
  });
}

/** D8: staff-only internal refund record; nothing is sent to any provider. */
export async function refundPayment(
  paymentId: string,
  actor: Viewer,
  amountMinor: number,
  reason: string | null,
  opts?: PaymentServiceOptions
): Promise<PaymentView> {
  requireMoneyEnabled(opts);
  if (!actor.roles.some((r) => r === "admin" || r === "moderator" || r === "support")) {
    throw new Error("FORBIDDEN: Insufficient permissions.");
  }
  const trimmedReason = (reason || "").trim();
  if (!trimmedReason) throw new Error("VALIDATION_ERROR: Reason is required.");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("VALIDATION_ERROR: Refund amount must be a positive integer.");
  }
  const now = opts?.now ?? (() => new Date());
  const at = now();
  return withTransaction(async (client) => {
    const res = await client.query(`SELECT * FROM payment_transactions WHERE id=$1 FOR UPDATE`, [paymentId]);
    if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Payment not found.");
    const payment = res.rows[0];
    const captured = Number(payment.captured_amount_minor);
    const refunded = Number(payment.refunded_amount_minor);
    if (captured <= 0 || amountMinor > captured - refunded) {
      throw new Error("VALIDATION_ERROR: Refund exceeds remaining captured amount.");
    }
    const newRefunded = refunded + amountMinor;
    const to: PaymentStatus = newRefunded >= captured ? "refunded" : "refunded_partial";
    assertTransition(payment.status as PaymentStatus, to);
    await client.query(
      `INSERT INTO refunds (payment_transaction_id, amount_minor, currency, reason, created_by_user_id, created_at)
       VALUES ($1,$2,'CAD',$3,$4,$5)`,
      [paymentId, amountMinor, trimmedReason, actor.id, at]
    );
    await client.query(
      `UPDATE payment_transactions SET status=$2, refunded_amount_minor=$3, updated_at=$4 WHERE id=$1`,
      [paymentId, to, newRefunded, at]
    );
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "payment.refunded",
        targetType: "payment_transaction",
        targetId: paymentId,
        reason: trimmedReason,
        metadata: { amountMinor, after: to },
      },
      client
    );
    const updated = await client.query(`SELECT * FROM payment_transactions WHERE id=$1`, [paymentId]);
    return mapPayment(updated.rows[0]);
  });
}
