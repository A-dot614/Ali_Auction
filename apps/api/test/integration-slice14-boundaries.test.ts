import { beforeEach, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { query } from "../src/db.js";
import { getOrder, sellerOrders } from "../src/orders/service.js";
import { createCheckout, handleWebhook, refundPayment } from "../src/payments/service.js";
import { gql, grantDisputeRole, makePaidOrder, registerVerifyLogin, resetDisputeDb } from "./dispute-helpers.js";

/** Slice 14 no-decision hardening: characterization and boundary tests only. */

const SECRET = "test-fake-webhook-secret";

function opts() {
  return { now: () => new Date(), moneyEnabled: true, webhookSecret: SECRET } as any;
}
function viewer(u: { userId: string; roles: string[] }) {
  return { id: u.userId, roles: u.roles };
}
function sendWebhook(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  return handleWebhook(
    "fake",
    raw,
    { "x-fake-signature": createHmac("sha256", SECRET).update(raw).digest("hex") },
    opts()
  );
}

describe("Slice 14 — no-decision hardening", () => {
  beforeEach(async () => {
    await resetDisputeDb();
  });

  it("current behaviour, pending owner decision: support role can call refundPayment (docs/09 lists support refund as No by default)", async () => {
    const { order, payment } = await makePaidOrder();
    const support = await registerVerifyLogin("support");
    await grantDisputeRole(support.userId, "support");
    // This asserts what the code does TODAY, not what policy requires.
    const refunded = await refundPayment(
      payment.id,
      { id: support.userId, roles: ["support"] },
      100,
      "characterization of current behaviour",
      opts()
    );
    expect(refunded.status).toBe("refunded_partial");
    const row = await query(`SELECT created_by_user_id FROM refunds WHERE payment_transaction_id=$1`, [payment.id]);
    expect(row.rows[0].created_by_user_id).toBe(support.userId);
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("paid");
  });

  it("buyer cannot view another buyer's order address (NOT_FOUND)", async () => {
    const a = await makePaidOrder();
    const outsider = await registerVerifyLogin("address-outsider");
    await expect(getOrder(a.order.id, viewer(outsider))).rejects.toThrow(/NOT_FOUND/);
    const own = await getOrder(a.order.id, viewer(a.buyer));
    expect(own).toHaveProperty("shippingAddressSnapshot");
  });

  it("seller cannot view another seller's orders (empty sellerOrders)", async () => {
    const a = await makePaidOrder();
    const otherSeller = await registerVerifyLogin("other-seller");
    const result = await sellerOrders(viewer(otherSeller), {});
    expect(result.items.some((i) => i.id === a.order.id)).toBe(false);
  });

  it("moderator cannot alter fee configuration: no fee mutation surface exists", async () => {
    const introspection = await gql({ query: `{ __schema { mutationType { fields { name } } } }` });
    const names: string[] = introspection.body.data.__schema.mutationType.fields.map((f: any) => f.name);
    expect(names.some((n) => /fee/i.test(n))).toBe(false);
  });

  it("finance operator cannot assign roles: no role-assignment mutation surface exists", async () => {
    const introspection = await gql({ query: `{ __schema { mutationType { fields { name } } } }` });
    const names: string[] = introspection.body.data.__schema.mutationType.fields.map((f: any) => f.name);
    expect(names.some((n) => /role/i.test(n))).toBe(false);
  });

  it("webhook replay after success: a second distinct payment.succeeded event changes no state", async () => {
    const { order, buyer } = await makePaidOrder(false);
    await createCheckout(
      order.id,
      buyer.userId,
      { acceptedTotalMinor: String(order.total_minor), fulfilmentChoice: "shipping", requestId: randomUUID() },
      opts()
    );
    const payment = (await query(`SELECT provider_payment_id FROM payment_transactions WHERE order_id=$1`, [order.id])).rows[0];
    const first = await sendWebhook({
      provider_event_id: randomUUID(),
      event_type: "payment.succeeded",
      provider_payment_id: payment.provider_payment_id,
    });
    expect(first.outcome).toBe("processed");
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("paid");
    const second = await sendWebhook({
      provider_event_id: randomUUID(),
      event_type: "payment.succeeded",
      provider_payment_id: payment.provider_payment_id,
    });
    expect(second.outcome).toBe("processed");
    expect((await query(`SELECT status FROM payment_transactions WHERE order_id=$1`, [order.id])).rows[0].status).toBe("captured");
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("paid");
  });
});
