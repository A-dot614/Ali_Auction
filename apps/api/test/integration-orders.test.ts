import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { grantRole } from "../src/auth/service.js";
import { config, assertMoneyFlagsOffForProduction } from "../src/config.js";
import { createAuction, placeBid, closeAuction } from "../src/auction/service.js";
import { consumeAuctionClosedEvents, getOrder, getMyOrders, sellerOrders, recordFulfilment } from "../src/orders/service.js";
import { createCheckout, handleWebhook, refundPayment } from "../src/payments/service.js";

const app = createApp();
const FIXED_NOW = new Date("2026-11-16T12:00:00.000Z");
const STARTS_AT = new Date(FIXED_NOW.getTime() + 60_000);
const ENDS_AT = new Date(FIXED_NOW.getTime() + 3_600_000);
const SECRET = "test-fake-webhook-secret";

async function gql(opts: { query: string; variables?: any; cookie?: string }) {
  const r = request(app).post("/graphql").set("content-type", "application/json");
  if (opts.cookie) r.set("Cookie", opts.cookie);
  return r.send({ query: opts.query, variables: opts.variables });
}

function getSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

async function resetDb() {
  await query(
    `TRUNCATE TABLE audit_logs, password_reset_tokens, email_verification_tokens, sessions, user_roles, user_profiles,
     listing_media, listings, seller_verifications, seller_profiles, users,
     auctions, bids, proxy_bids, auction_events, outbox_events,
     shipments, refunds, webhook_events, payment_transactions, processed_events, order_events, order_fee_lines, orders, fee_rules
     RESTART IDENTITY CASCADE`
  );
  await query(
    `INSERT INTO fee_rules (fee_code, description, rate_bps, effective_from) VALUES
     ('buyer_fee_placeholder', 'Source plan value: 8% buyer fee placeholder - NOT APPROVED', 800, '1970-01-01T00:00:00Z')`
  );
}

async function registerVerifyLogin(email: string) {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const { userId, verificationToken } = reg.body.data.register;
  await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: verificationToken } });
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId: userId as string, cookie: getSetCookie(login), roles: ["buyer", "seller"] as string[] };
}

async function makeStaff() {
  const staff = await registerVerifyLogin(`staff-${randomUUID()}@example.com`);
  await grantRole(staff.userId, "moderator", staff.userId);
  return { ...staff, roles: [...staff.roles, "moderator"] };
}

async function makeSellerWithPublishedListing() {
  const seller = await registerVerifyLogin(`seller-${randomUUID()}@example.com`);
  await gql({
    query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`,
    variables: {
      input: {
        sellerType: "individual",
        displayName: "Order Seller",
        publicStoreName: "Order Store",
        legalName: "Restricted Legal Name",
        provinceCode: "ON",
      },
    },
    cookie: seller.cookie,
  });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const staff = await makeStaff();
  const pending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "under_review" } }, cookie: staff.cookie });
  await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "approved" } }, cookie: staff.cookie });
  const category = await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`);
  const created = await gql({
    query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
    variables: {
      input: {
        categoryId: category.rows[0].id,
        title: "Order Test Listing",
        description: "Order test.",
        condition: "used",
        fulfilmentOption: "both",
        currency: "CAD",
        startingPriceMinor: "2500",
        requestedStartsAt: null,
        requestedEndsAt: null,
      },
    },
    cookie: seller.cookie,
  });
  const listingId = created.body.data.createListingDraft.id;
  await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id } }`, variables: { id: listingId }, cookie: seller.cookie });
  await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
  return { seller, staff, listingId };
}

async function makeSoldOrder(sold = true) {
  const { seller, staff, listingId } = await makeSellerWithPublishedListing();
  const buyer = await registerVerifyLogin(`buyer-${randomUUID()}@example.com`);
  const auction = await createAuction(
    seller.userId,
    { listingId, startsAt: STARTS_AT, endsAt: ENDS_AT, startingPriceMinor: 2500 },
    { now: () => FIXED_NOW }
  );
  if (sold) {
    const bid = await placeBid(
      buyer.userId,
      { auctionId: auction.id, amountMinor: 3000, requestId: randomUUID() },
      { now: () => STARTS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true }
    );
    expect(bid.accepted).toBe(true);
  }
  await closeAuction(auction.id, { now: () => ENDS_AT });
  const consumed = await consumeAuctionClosedEvents({ now: () => ENDS_AT });
  const orders = await query(`SELECT * FROM orders WHERE auction_id=$1`, [auction.id]);
  return { seller, staff, buyer, auction, consumed, order: orders.rows[0] ?? null };
}

function opts() {
  return { now: () => ENDS_AT, moneyEnabled: true, provider: undefined, webhookSecret: SECRET };
}

function webhookBody(eventType: string, providerPaymentId: string, eventId = randomUUID()) {
  return { provider_event_id: eventId, event_type: eventType, provider_payment_id: providerPaymentId };
}

function sendWebhook(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  return handleWebhook("fake", raw, { "x-fake-signature": sig }, opts());
}

async function paymentForOrder(orderId: string) {
  return (await query(`SELECT * FROM payment_transactions WHERE order_id=$1`, [orderId])).rows[0];
}

describe("orders & sandbox payments (Slice 6)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("closed_sold auction creates exactly one order; running the consumer twice creates no second order", async () => {
    const first = await makeSoldOrder();
    expect(first.consumed.created).toBe(1);
    expect(first.order.status).toBe("awaiting_payment");
    expect(String(first.order.hammer_price_minor)).toBe("3000");
    expect(String(first.order.total_minor)).toBe("3240");
    const second = await consumeAuctionClosedEvents({ now: () => ENDS_AT });
    expect(second).toEqual({ created: 0, skipped: 0 });
    expect((await query(`SELECT count(*)::int AS c FROM orders`)).rows[0].c).toBe(1);
  });

  it("closed_unsold creates no order", async () => {
    const setup = await makeSoldOrder(false);
    expect(setup.consumed.created).toBe(0);
    expect((await query(`SELECT count(*)::int AS c FROM orders`)).rows[0].c).toBe(0);
  });

  it("order fee snapshot is written once and unchanged after fee_rules changes", async () => {
    const { order } = await makeSoldOrder();
    const before = await query(`SELECT * FROM order_fee_lines WHERE order_id=$1`, [order.id]);
    expect(before.rows).toHaveLength(1);
    expect(String(before.rows[0].amount_minor)).toBe("240");
    await query(`UPDATE fee_rules SET rate_bps=1500 WHERE fee_code='buyer_fee_placeholder'`);
    await consumeAuctionClosedEvents({ now: () => ENDS_AT });
    const after = await query(`SELECT * FROM order_fee_lines WHERE order_id=$1`, [order.id]);
    expect(after.rows).toHaveLength(1);
    expect(String(after.rows[0].amount_minor)).toBe("240");
  });

  it("createCheckout with a mismatched total returns TOTAL_MISMATCH and writes nothing", async () => {
    const { order, buyer } = await makeSoldOrder();
    await expect(
      createCheckout(order.id, buyer.userId, { acceptedTotalMinor: 1, fulfilmentChoice: "shipping", requestId: randomUUID() }, opts())
    ).rejects.toThrow(/TOTAL_MISMATCH/);
    expect((await query(`SELECT count(*)::int AS c FROM payment_transactions`)).rows[0].c).toBe(0);
  });

  it("createCheckout with the correct total creates a payment in created status; retry with the same requestId returns the same payment", async () => {
    const { order, buyer } = await makeSoldOrder();
    const requestId = randomUUID();
    const first = await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId }, opts());
    expect(first.status).toBe("created");
    expect(first.amountMinor).toBe("3240");
    const second = await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId }, opts());
    expect(second.id).toBe(first.id);
    expect((await query(`SELECT count(*)::int AS c FROM payment_transactions`)).rows[0].c).toBe(1);
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("awaiting_payment");
  });

  it("another buyer cannot check out the order (NOT_FOUND)", async () => {
    const { order } = await makeSoldOrder();
    const other = await registerVerifyLogin(`other-${randomUUID()}@example.com`);
    await expect(
      createCheckout(order.id, other.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId: randomUUID() }, opts())
    ).rejects.toThrow(/NOT_FOUND/);
  });

  it("flag OFF: createCheckout and refundPayment return REAL_MONEY_DISABLED and write nothing", async () => {
    const { order, buyer, staff } = await makeSoldOrder();
    const off = { now: () => ENDS_AT, moneyEnabled: false, webhookSecret: SECRET };
    await expect(
      createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId: randomUUID() }, off)
    ).rejects.toThrow(/REAL_MONEY_DISABLED/);
    await expect(refundPayment(randomUUID(), { id: staff.userId, roles: staff.roles }, 100, "reason", off)).rejects.toThrow(/REAL_MONEY_DISABLED/);
    expect((await query(`SELECT count(*)::int AS c FROM payment_transactions`)).rows[0].c).toBe(0);
    expect((await query(`SELECT count(*)::int AS c FROM refunds`)).rows[0].c).toBe(0);
  });

  it("webhook with invalid signature returns INVALID_SIGNATURE and writes nothing", async () => {
    await expect(
      handleWebhook("fake", JSON.stringify(webhookBody("payment.succeeded", "fake_pi_x")), { "x-fake-signature": "bad" }, opts())
    ).rejects.toThrow(/INVALID_SIGNATURE/);
    expect((await query(`SELECT count(*)::int AS c FROM webhook_events`)).rows[0].c).toBe(0);
  });

  it("payment.succeeded moves order to paid and payment to captured; duplicate delivery changes nothing", async () => {
    const { order, buyer } = await makeSoldOrder();
    const requestId = randomUUID();
    await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId }, opts());
    const payment = await paymentForOrder(order.id);
    const body = webhookBody("payment.succeeded", payment.provider_payment_id);
    const first = await sendWebhook(body);
    expect(first.outcome).toBe("processed");
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("paid");
    expect((await query(`SELECT status FROM payment_transactions WHERE id=$1`, [payment.id])).rows[0].status).toBe("captured");
    const duplicate = await sendWebhook(body);
    expect(duplicate.outcome).toBe("duplicate");
    expect((await query(`SELECT count(*)::int AS c FROM order_events WHERE order_id=$1 AND to_status='paid'`, [order.id])).rows[0].c).toBe(1);
  });

  it("payment.failed leaves order awaiting_payment and payment failed", async () => {
    const { order, buyer } = await makeSoldOrder();
    await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId: randomUUID() }, opts());
    const payment = await paymentForOrder(order.id);
    const result = await sendWebhook(webhookBody("payment.failed", payment.provider_payment_id));
    expect(result.outcome).toBe("processed");
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("awaiting_payment");
    expect((await query(`SELECT status FROM payment_transactions WHERE id=$1`, [payment.id])).rows[0].status).toBe("failed");
  });

  it("out-of-order succeeded for an unknown payment is stored unprocessed and changes no order state", async () => {
    const { order } = await makeSoldOrder();
    const result = await sendWebhook(webhookBody("payment.succeeded", "fake_pi_unknown"));
    expect(result.outcome).toBe("unknown");
    const webhook = await query(`SELECT * FROM webhook_events`);
    expect(webhook.rows).toHaveLength(1);
    expect(webhook.rows[0].processed_at).toBeNull();
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("awaiting_payment");
  });

  it("success query string on a redirect route changes no payment state", async () => {
    const { order, buyer } = await makeSoldOrder();
    await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId: randomUUID() }, opts());
    await request(app).get("/?payment=success&status=paid").expect(404);
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [order.id])).rows[0].status).toBe("awaiting_payment");
  });

  it("recordFulfilment shipping: paid -> processing -> shipped; local pickup: paid -> ready_for_pickup; buyer confirms completion", async () => {
    const shipping = await makeSoldOrder();
    await createCheckout(shipping.order.id, shipping.buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId: randomUUID() }, opts());
    const payment = await paymentForOrder(shipping.order.id);
    await sendWebhook(webhookBody("payment.succeeded", payment.provider_payment_id));
    const sellerViewer = { id: shipping.seller.userId, roles: shipping.seller.roles };
    const buyerViewer = { id: shipping.buyer.userId, roles: shipping.buyer.roles };
    await recordFulfilment(shipping.order.id, sellerViewer, "start_processing", {}, opts());
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [shipping.order.id])).rows[0].status).toBe("processing");
    await recordFulfilment(shipping.order.id, sellerViewer, "mark_shipped", { carrier: "Canada Post", trackingNumber: "TRACK-1" }, opts());
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [shipping.order.id])).rows[0].status).toBe("shipped");
    await recordFulfilment(shipping.order.id, buyerViewer, "complete", {}, opts());
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [shipping.order.id])).rows[0].status).toBe("completed");

    await resetDb();
    const pickup = await makeSoldOrder();
    await createCheckout(pickup.order.id, pickup.buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "local_pickup", requestId: randomUUID() }, opts());
    const payment2 = await paymentForOrder(pickup.order.id);
    await sendWebhook(webhookBody("payment.succeeded", payment2.provider_payment_id));
    await recordFulfilment(pickup.order.id, { id: pickup.seller.userId, roles: pickup.seller.roles }, "ready_for_pickup", {}, opts());
    expect((await query(`SELECT status FROM orders WHERE id=$1`, [pickup.order.id])).rows[0].status).toBe("ready_for_pickup");
  });

  it("refund over captured amount is rejected; refund within amount succeeds and is recorded with actor and reason", async () => {
    const { order, buyer, staff } = await makeSoldOrder();
    await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId: randomUUID() }, opts());
    const payment = await paymentForOrder(order.id);
    await sendWebhook(webhookBody("payment.succeeded", payment.provider_payment_id));
    const staffViewer = { id: staff.userId, roles: staff.roles };
    await expect(refundPayment(payment.id, staffViewer, 3241, "too much", opts())).rejects.toThrow(/VALIDATION_ERROR/);
    const refunded = await refundPayment(payment.id, staffViewer, 1000, "customer request", opts());
    expect(refunded.status).toBe("refunded_partial");
    const row = await query(`SELECT * FROM refunds WHERE payment_transaction_id=$1`, [payment.id]);
    expect(row.rows).toHaveLength(1);
    expect(String(row.rows[0].amount_minor)).toBe("1000");
    expect(row.rows[0].reason).toBe("customer request");
    expect(row.rows[0].created_by_user_id).toBe(staff.userId);
  });

  it("buyer sees only own orders; seller sees only orders for their seller profile; staff sees all; non-participant gets NOT_FOUND", async () => {
    const a = await makeSoldOrder();
    const b = await makeSoldOrder();
    const outsider = await registerVerifyLogin(`outsider-${randomUUID()}@example.com`);
    const buyerA = await getMyOrders({ id: a.buyer.userId, roles: a.buyer.roles }, {});
    expect(buyerA.items.every((i) => i.id === a.order.id)).toBe(true);
    const sellerB = await sellerOrders({ id: b.seller.userId, roles: b.seller.roles }, {});
    expect(sellerB.items.every((i) => i.id === b.order.id)).toBe(true);
    expect(sellerB.items.some((i) => i.id === a.order.id)).toBe(false);
    const staff = await query(`SELECT count(*)::int AS c FROM orders`);
    const staffResult = await import("../src/orders/service.js").then((m) =>
      m.ordersAll({ id: a.staff.userId, roles: a.staff.roles }, {})
    );
    expect(staffResult.items).toHaveLength(staff.rows[0].c);
    await expect(getOrder(a.order.id, { id: outsider.userId, roles: outsider.roles })).rejects.toThrow(/NOT_FOUND/);
  });

  it("order, myOrders, and sellerOrders never expose provider IDs, webhook payloads, or staff notes", async () => {
    const { order, buyer, seller } = await makeSoldOrder();
    await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: "3240", fulfilmentChoice: "shipping", requestId: randomUUID() }, opts());
    const view = await getOrder(order.id, { id: buyer.userId, roles: buyer.roles });
    const serialized = JSON.stringify(view);
    for (const forbidden of ["provider_payment_id", "providerPaymentId", "payload", "idempotencyKey", "staffNotes", "Restricted Legal Name"]) {
      expect(serialized).not.toContain(forbidden);
    }
    const mine = await getMyOrders({ id: buyer.userId, roles: buyer.roles }, {});
    const theirs = await sellerOrders({ id: seller.userId, roles: seller.roles }, {});
    expect(JSON.stringify(mine.items) + JSON.stringify(theirs.items)).not.toContain("provider_payment_id");
  });

  it("no SQL now() or Date.now() in new source", () => {
    const files = [
      "../src/orders/service.ts",
      "../src/orders/fee.ts",
      "../src/orders/orderStateMachine.ts",
      "../src/payments/service.ts",
      "../src/payments/fakeProvider.ts",
      "../src/payments/paymentStateMachine.ts",
      "../src/graphql/resolvers/orders.ts",
    ];
    for (const file of files) {
      const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      expect(source).not.toMatch(/Date\.now\(\)/);
      // Injected-clock calls `now()` are allowed; SQL now() inside queries is not.
      const literals = [...source.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]);
      for (const literal of literals) expect(literal.toLowerCase()).not.toMatch(/\bnow\(\)/);
    }
  });

  it("production startup assertion forces both money flags OFF", () => {
    expect(config.features.realMoneyPaymentsEnabled).toBe(false);
    expect(config.features.liveBiddingEnabled).toBe(false);
    const prevEnv = process.env.NODE_ENV;
    const prevFlag = process.env.FEATURE_REAL_MONEY_PAYMENTS_ENABLED;
    try {
      process.env.NODE_ENV = "production";
      process.env.FEATURE_REAL_MONEY_PAYMENTS_ENABLED = "true";
      expect(() => assertMoneyFlagsOffForProduction()).toThrow(/REAL_MONEY/);
      process.env.FEATURE_REAL_MONEY_PAYMENTS_ENABLED = "false";
      expect(() => assertMoneyFlagsOffForProduction()).not.toThrow();
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevFlag === undefined) delete process.env.FEATURE_REAL_MONEY_PAYMENTS_ENABLED;
      else process.env.FEATURE_REAL_MONEY_PAYMENTS_ENABLED = prevFlag;
    }
  });
});
