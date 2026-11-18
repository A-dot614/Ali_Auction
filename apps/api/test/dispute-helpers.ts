import { randomUUID, createHmac } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { createAuction, placeBid, closeAuction } from "../src/auction/service.js";
import { consumeAuctionClosedEvents } from "../src/orders/service.js";
import { createCheckout, handleWebhook } from "../src/payments/service.js";

/** Shared fixtures for Slice 12 dispute tests. All times are runtime-relative. */

const app = createApp();
const SECRET = "test-fake-webhook-secret";

export function gql(opts: { query: string; variables?: any; cookie?: string }) {
  const r = request(app).post("/graphql").set("content-type", "application/json");
  if (opts.cookie) r.set("Cookie", opts.cookie);
  return r.send({ query: opts.query, variables: opts.variables });
}

export function getSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

export async function resetDisputeDb() {
  await query(
    `TRUNCATE TABLE audit_logs, password_reset_tokens, email_verification_tokens, sessions, user_roles, user_profiles,
     listing_media, listings, seller_verifications, seller_profiles, users,
     auctions, bids, proxy_bids, auction_events, outbox_events,
     dispute_messages, dispute_requests, disputes,
     shipments, refunds, webhook_events, payment_transactions, processed_events, order_events, order_fee_lines, orders, fee_rules,
     notifications, notification_deliveries, notification_preferences
     RESTART IDENTITY CASCADE`
  );
  await query(
    `INSERT INTO fee_rules (fee_code, description, rate_bps, effective_from) VALUES
     ('buyer_fee_placeholder', 'Source plan value: 8% buyer fee placeholder - NOT APPROVED', 800, '1970-01-01T00:00:00Z')`
  );
}

export async function registerVerifyLogin(label = "user") {
  const email = `${label}-${randomUUID()}@example.com`;
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
  return { email, userId: userId as string, cookie: getSetCookie(login), roles: ["buyer", "seller"] as string[] };
}

export async function grantDisputeRole(userId: string, role: string) {
  await query(`INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [role]);
  await query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name=$2 ON CONFLICT DO NOTHING`,
    [userId, role]
  );
}

export async function makePublishedListing(seller: { userId: string; cookie: string }) {
  const moderator = await registerVerifyLogin("moderator");
  await grantDisputeRole(moderator.userId, "moderator");
  await gql({
    query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`,
    variables: {
      input: {
        sellerType: "individual",
        displayName: "Dispute Seller",
        publicStoreName: "Dispute Store",
        legalName: "Restricted Legal Name",
        provinceCode: "ON",
      },
    },
    cookie: seller.cookie,
  });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const pending = await gql({
    query: `query{ pendingSellerVerifications { items { id } } }`,
    cookie: moderator.cookie,
  });
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  await gql({
    query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
    variables: { input: { verificationId: vid, decision: "under_review" } },
    cookie: moderator.cookie,
  });
  await gql({
    query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
    variables: { input: { verificationId: vid, decision: "approved" } },
    cookie: moderator.cookie,
  });
  const category = await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`);
  const created = await gql({
    query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
    variables: {
      input: {
        categoryId: category.rows[0].id,
        title: "Dispute Test Listing",
        description: "Dispute test.",
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
  await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: moderator.cookie });
  return { listingId, moderator: { ...moderator, roles: [...moderator.roles, "moderator"] } };
}

/** Creates a paid order (runtime-relative schedule) with a captured fake payment. */
export async function makePaidOrder(pay = true) {
  const seller = await registerVerifyLogin("seller");
  const { listingId, moderator } = await makePublishedListing(seller);
  const buyer = await registerVerifyLogin("buyer");
  const base = Date.now();
  const startsAt = new Date(base - 60_000);
  const endsAt = new Date(base + 3_600_000);
  const auction = await createAuction(
    seller.userId,
    { listingId, startsAt, endsAt, startingPriceMinor: 2500 },
    { now: () => new Date(base - 120_000) }
  );
  const bid = await placeBid(
    buyer.userId,
    { auctionId: auction.id, amountMinor: 3000, requestId: randomUUID() },
    { now: () => startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true }
  );
  if (!bid.accepted) throw new Error(`fixture bid rejected: ${bid.error?.code}`);
  await closeAuction(auction.id, { now: () => endsAt });
  const consumed = await consumeAuctionClosedEvents({ now: () => endsAt });
  if (consumed.created !== 1) throw new Error("fixture order not created");
  const orderRes = await query(`SELECT * FROM orders WHERE auction_id=$1`, [auction.id]);
  const order = orderRes.rows[0];
  let payment: any = null;
  if (pay) {
    const checkout = await createCheckout(
      order.id,
      buyer.userId,
      { acceptedTotalMinor: String(order.total_minor), fulfilmentChoice: "shipping", requestId: randomUUID() },
      { now: () => endsAt, moneyEnabled: true, webhookSecret: SECRET }
    );
    const providerPaymentId = (await query(`SELECT provider_payment_id FROM payment_transactions WHERE id=$1`, [checkout.id])).rows[0].provider_payment_id;
    const raw = JSON.stringify({
      provider_event_id: randomUUID(),
      event_type: "payment.succeeded",
      provider_payment_id: providerPaymentId,
    });
    await handleWebhook(
      "fake",
      raw,
      { "x-fake-signature": createHmac("sha256", SECRET).update(raw).digest("hex") },
      { now: () => endsAt, moneyEnabled: true, webhookSecret: SECRET }
    );
    payment = (await query(`SELECT * FROM payment_transactions WHERE id=$1`, [checkout.id])).rows[0];
  }
  return { seller, buyer, moderator, order, payment };
}

/** Directly inserts a dispute (used to test resolve paths D1 intentionally cannot open). */
export async function insertDisputeDirect(orderId: string, openedByUserId: string, status = "open", outcome: string | null = null) {
  const res = await query(
    `INSERT INTO disputes (order_id, opened_by_user_id, reason_code, description, status, outcome, created_at, updated_at)
     VALUES ($1,$2,'other','Direct fixture dispute',$3,$4, $5, $5) RETURNING *`,
    [orderId, openedByUserId, status, outcome, new Date()]
  );
  return res.rows[0];
}
