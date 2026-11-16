import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { schema } from "../src/graphql/schema.js";
import { GraphQLObjectType } from "graphql";
import { createAuction, placeBid, closeAuction } from "../src/auction/service.js";
import { consumeAuctionClosedEvents, recordFulfilment } from "../src/orders/service.js";
import { createCheckout, handleWebhook } from "../src/payments/service.js";
import { pauseListing, removeListing, rejectListing } from "../src/catalogue/service.js";
import { suspendUser } from "../src/accounts/service.js";
import { reportListing, resolveReport } from "../src/reports/service.js";
import { consumeOutbox } from "../src/outbox/consumer.js";
import { consumeNotifications } from "../src/notifications/consumer.js";
import { deliverPending, myNotifications, unreadCount } from "../src/notifications/service.js";
import { InAppSink } from "../src/notifications/sinks.js";
import { requireAuth, type GraphQLContext } from "../src/auth/authz.js";
import type { OutboxMessage } from "../src/outbox/publisher.js";

const app = createApp();
const FIXED_NOW = new Date("2026-11-16T12:00:00.000Z");
const STARTS_AT = new Date(FIXED_NOW.getTime() + 60_000);
const ENDS_AT = new Date(FIXED_NOW.getTime() + 3_600_000);
const SECRET = "test-notification-webhook-secret";
const clock = () => FIXED_NOW;

type User = { userId: string; cookie: string; email: string; roles: string[] };

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
    `TRUNCATE TABLE notification_deliveries, notification_preferences, notifications,
     audit_logs, reports, password_reset_tokens, email_verification_tokens, sessions,
     user_roles, user_profiles, listing_media, listings, seller_verifications, seller_profiles, users,
     auctions, bids, proxy_bids, auction_events, outbox_events, processed_events,
     shipments, refunds, webhook_events, payment_transactions,
     order_events, order_fee_lines, orders, fee_rules RESTART IDENTITY CASCADE`
  );
  await query(
    `INSERT INTO fee_rules (fee_code, description, rate_bps, effective_from)
     VALUES ('buyer_fee_placeholder', 'Source plan value: 8% buyer fee placeholder - NOT APPROVED', 800, '1970-01-01T00:00:00Z')`
  );
}

async function actor(userId: string): Promise<any> {
  const row = (await query(`SELECT id, email, status, email_verified_at FROM users WHERE id=$1`, [userId])).rows[0];
  const roles = (await query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1`, [userId]
  )).rows.map((r: any) => r.name);
  return { ...row, roles };
}

async function registerVerifyLogin(email: string): Promise<User> {
  const reg = await gql({
    query: `mutation($input:RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const { userId, verificationToken } = reg.body.data.register;
  await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: verificationToken } });
  const login = await gql({
    query: `mutation($input:LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId, cookie: getSetCookie(login), email, roles: ["buyer", "seller"] };
}

async function makeStaff(): Promise<User> {
  const staff = await registerVerifyLogin(`staff-${randomUUID()}@example.com`);
  await query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name='moderator' ON CONFLICT DO NOTHING`,
    [staff.userId]
  );
  return { ...staff, roles: [...staff.roles, "moderator"] };
}

async function makeApprovedSeller(): Promise<User> {
  const seller = await registerVerifyLogin(`seller-${randomUUID()}@example.com`);
  await gql({
    query: `mutation($input:SellerProfileInput!){ createSellerProfile(input:$input){ id } }`,
    variables: { input: { sellerType: "individual", displayName: "Notice Seller", publicStoreName: "Notice Store", legalName: "Restricted", provinceCode: "ON" } },
    cookie: seller.cookie,
  });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const staff = await makeStaff();
  const pending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  for (const decision of ["under_review", "approved"]) {
    await gql({
      query: `mutation($input:ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
      variables: { input: { verificationId: vid, decision } },
      cookie: staff.cookie,
    });
  }
  return seller;
}

async function makeListing(seller: User, status: string): Promise<string> {
  const category = (await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`)).rows[0].id;
  const res = await gql({
    query: `mutation($input:ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
    variables: { input: { categoryId: category, title: "Notice Listing", description: "Notice listing description", condition: "used", fulfilmentOption: "both", currency: "CAD", startingPriceMinor: "2500" } },
    cookie: seller.cookie,
  });
  if (res.body.errors) throw new Error(JSON.stringify(res.body.errors));
  const id = res.body.data.createListingDraft.id as string;
  if (status !== "draft") await query(`UPDATE listings SET status='pending_review' WHERE id=$1`, [id]);
  if (status !== "draft" && status !== "pending_review") {
    await query(`UPDATE listings SET status=$2, published_at=$3 WHERE id=$1`, [id, status, FIXED_NOW]);
  }
  return id;
}

async function notificationsFor(userId: string, category?: string) {
  const res = category
    ? await query(`SELECT * FROM notifications WHERE user_id=$1 AND category=$2`, [userId, category])
    : await query(`SELECT * FROM notifications WHERE user_id=$1`, [userId]);
  return res.rows;
}

async function insertEvent(eventType: string, payload: Record<string, any>, aggregateId = randomUUID(), createdAt = FIXED_NOW) {
  const res = await query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
     VALUES ('test', $1, $2, $3::jsonb, $4) RETURNING id`,
    [aggregateId, eventType, JSON.stringify(payload), createdAt]
  );
  return res.rows[0].id as string;
}

describe("consumer framework (Slice 8)", () => {
  beforeAll(async () => { await query("SELECT 1"); });
  beforeEach(async () => { await resetDb(); });

  it("consumer framework: processed rows are not reprocessed", async () => {
    await insertEvent("test.event", { value: 1 });
    let calls = 0;
    const handler = async (_m: OutboxMessage) => { calls += 1; };
    const first = await consumeOutbox("test-once", handler, { now: clock });
    expect(first).toEqual({ processed: 1, skipped: 0 });
    const second = await consumeOutbox("test-once", handler, { now: clock });
    expect(second).toEqual({ processed: 0, skipped: 0 });
    expect(calls).toBe(1);
  });

  it("consumer framework: handler failure leaves the row unprocessed and stops the batch", async () => {
    await insertEvent("test.event", { n: 1 }, randomUUID(), FIXED_NOW);
    await insertEvent("test.event", { n: 2 }, randomUUID(), new Date(FIXED_NOW.getTime() + 1));
    let calls = 0;
    const failing = async () => { calls += 1; throw new Error("boom"); };
    const failed = await consumeOutbox("test-fail", failing, { now: clock });
    expect(failed.processed).toBe(0);
    expect(calls).toBe(1);
    expect((await query(`SELECT count(*)::int AS c FROM processed_events WHERE consumer='test-fail'`)).rows[0].c).toBe(0);
    const succeeding = async () => { calls += 1; };
    const ok = await consumeOutbox("test-fail", succeeding, { now: clock });
    expect(ok.processed).toBe(2);
  });
});

describe("notifications (Slice 8)", () => {
  beforeAll(async () => { await query("SELECT 1"); });
  beforeEach(async () => { await resetDb(); });

  it("a bid that outbids the previous high bidder creates one notification for that bidder and one for the seller, both with opaque labels only", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "pending_review");
    await query(`UPDATE listings SET status='published', published_at=$2 WHERE id=$1`, [listingId, FIXED_NOW]);
    const auction = await createAuction(seller.userId, { listingId, startsAt: STARTS_AT, endsAt: ENDS_AT, startingPriceMinor: 2500 }, { now: clock });
    const bidder1 = await registerVerifyLogin(`bidder1-${randomUUID()}@example.com`);
    const bidder2 = await registerVerifyLogin(`bidder2-${randomUUID()}@example.com`);
    await placeBid(bidder1.userId, { auctionId: auction.id, amountMinor: 3000, requestId: randomUUID() }, { now: () => STARTS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true });
    await consumeNotifications({ now: clock });
    const sellerBefore = (await notificationsFor(seller.userId, "auction_result")).length;
    await placeBid(bidder2.userId, { auctionId: auction.id, amountMinor: 3100, requestId: randomUUID() }, { now: () => new Date(STARTS_AT.getTime() + 1000), bidIncrementMinor: 100, liveBiddingEnabled: true });
    await consumeNotifications({ now: clock });

    const bidderNotes = await notificationsFor(bidder1.userId);
    const sellerNotes = await notificationsFor(seller.userId, "auction_result");
    expect(bidderNotes).toHaveLength(1);
    expect(bidderNotes[0].category).toBe("auction_outbid");
    expect(sellerNotes).toHaveLength(sellerBefore + 1);
    expect(await notificationsFor(bidder2.userId)).toHaveLength(0);
    const allText = `${bidderNotes[0].body} ${sellerNotes[sellerNotes.length - 1].body}`;
    expect(allText).toMatch(/bidder-[0-9a-f]{16}/);
    expect(allText).not.toContain(bidder1.userId);
    expect(allText).not.toContain(bidder2.userId);
  });

  it("replaying the same outbox batch creates no duplicate notifications", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    await pauseListing(listingId, (await makeStaff()).userId, "review", undefined, { clock });
    const first = await consumeNotifications({ now: clock });
    expect(first.processed).toBeGreaterThanOrEqual(1);
    const countAfterFirst = (await query(`SELECT count(*)::int AS c FROM notifications`)).rows[0].c;
    await consumeNotifications({ now: clock });
    expect((await query(`SELECT count(*)::int AS c FROM notifications`)).rows[0].c).toBe(countAfterFirst);
  });

  it("closed_sold creates a winner notification and a seller notification; closed_unsold creates only a seller notification", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const buyer = await registerVerifyLogin(`buyer-${randomUUID()}@example.com`);
    const auction = await createAuction(seller.userId, { listingId, startsAt: STARTS_AT, endsAt: ENDS_AT, startingPriceMinor: 2500 }, { now: clock });
    await placeBid(buyer.userId, { auctionId: auction.id, amountMinor: 3000, requestId: randomUUID() }, { now: () => STARTS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true });
    await consumeNotifications({ now: clock }); // settle the bid event first
    const sellerBeforeClose = (await notificationsFor(seller.userId, "auction_result")).length;
    await closeAuction(auction.id, { now: () => ENDS_AT });
    await consumeNotifications({ now: clock });
    expect(await notificationsFor(buyer.userId, "auction_result")).toHaveLength(1);
    expect((await notificationsFor(seller.userId, "auction_result")).length).toBe(sellerBeforeClose + 1);

    const seller2 = await makeApprovedSeller();
    const listing2 = await makeListing(seller2, "published");
    const auction2 = await createAuction(seller2.userId, { listingId: listing2, startsAt: STARTS_AT, endsAt: ENDS_AT, startingPriceMinor: 2500 }, { now: clock });
    await closeAuction(auction2.id, { now: () => ENDS_AT });
    await consumeNotifications({ now: clock });
    expect(await notificationsFor(seller2.userId, "auction_result")).toHaveLength(1);
  });

  it("a listing pause and remove each create one seller notification, and the reject path creates one seller notification (replaces the 3b TODO)", async () => {
    const seller = await makeApprovedSeller();
    const staff = await makeStaff();
    const pausedId = await makeListing(seller, "published");
    const removedId = await makeListing(seller, "published");
    const rejectedId = await makeListing(seller, "pending_review");
    await pauseListing(pausedId, staff.userId, "hide", undefined, { clock });
    await removeListing(removedId, staff.userId, "remove", { clock });
    await rejectListing(rejectedId, staff.userId, "reject", { clock });
    await consumeNotifications({ now: clock });
    const notes = await notificationsFor(seller.userId, "listing_moderation");
    expect(notes).toHaveLength(3);
    expect(notes.map((n: any) => n.resource_id).sort()).toEqual([pausedId, removedId, rejectedId].sort());
    for (const n of notes) {
      expect(n.body).not.toContain("hide");
      expect(n.body).not.toContain("remove");
      expect(n.body).not.toContain("reject");
    }
  });

  it("order created notifies the buyer; paid notifies the seller; shipped and ready_for_pickup notify the buyer (replaces the Slice 6 TODO)", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const buyer = await registerVerifyLogin(`buyer-${randomUUID()}@example.com`);
    const auction = await createAuction(seller.userId, { listingId, startsAt: STARTS_AT, endsAt: ENDS_AT, startingPriceMinor: 2500 }, { now: clock });
    await placeBid(buyer.userId, { auctionId: auction.id, amountMinor: 3000, requestId: randomUUID() }, { now: () => STARTS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true });
    await closeAuction(auction.id, { now: () => ENDS_AT });
    await consumeAuctionClosedEvents({ now: () => ENDS_AT });
    await consumeNotifications({ now: clock });
    expect(await notificationsFor(buyer.userId, "order_update")).toHaveLength(1);

    const order = (await query(`SELECT * FROM orders LIMIT 1`)).rows[0];
    await createCheckout(order.id, buyer.userId, { acceptedTotalMinor: String(order.total_minor), fulfilmentChoice: "shipping", requestId: randomUUID() }, { now: clock, moneyEnabled: true });
    const providerPaymentId = (await query(`SELECT provider_payment_id FROM payment_transactions WHERE order_id=$1`, [order.id])).rows[0].provider_payment_id;
    const raw = JSON.stringify({ provider_event_id: randomUUID(), event_type: "payment.succeeded", provider_payment_id: providerPaymentId });
    const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
    await handleWebhook("fake", raw, { "x-fake-signature": sig }, { now: clock, moneyEnabled: true, webhookSecret: SECRET });
    await consumeNotifications({ now: clock });
    expect(await notificationsFor(seller.userId, "payment_update")).toHaveLength(1);

    await query(`UPDATE orders SET status='processing' WHERE id=$1`, [order.id]);
    await recordFulfilment(order.id, await actor(seller.userId), "mark_shipped", { carrier: "Test", trackingNumber: "X1" }, { now: clock });
    await consumeNotifications({ now: clock });
    expect(await notificationsFor(buyer.userId, "fulfilment_update")).toHaveLength(1);

    await query(`UPDATE orders SET status='paid' WHERE id=$1`, [order.id]);
    await recordFulfilment(order.id, await actor(seller.userId), "ready_for_pickup", {}, { now: clock });
    await consumeNotifications({ now: clock });
    expect(await notificationsFor(buyer.userId, "fulfilment_update")).toHaveLength(2);
  });

  it("account suspension notifies the affected user with neutral text only", async () => {
    const target = await registerVerifyLogin(`target-${randomUUID()}@example.com`);
    const moderator = await makeStaff();
    await suspendUser(target.userId, await actor(moderator.userId), "SECRET-STAFF-REASON", { clock });
    await consumeNotifications({ now: clock });
    const notes = await notificationsFor(target.userId, "account_status");
    expect(notes).toHaveLength(1);
    expect(notes[0].body).not.toContain("SECRET-STAFF-REASON");
  });

  it("report resolution notifies the reporter with outcome category only, never the target identity (replaces the Slice 7 TODO)", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    const moderator = await makeStaff();
    const report = await reportListing(await actor(reporter.userId), listingId, "spam", "SECRET-PRIVATE-DETAILS", { clock });
    await resolveReport(report.report.id, await actor(moderator.userId), "dismissed", "STAFF-ONLY-REASON", "none", { clock });
    await consumeNotifications({ now: clock });
    const reporterNotes = await notificationsFor(reporter.userId, "report_result");
    expect(reporterNotes).toHaveLength(1);
    expect(reporterNotes[0].body).toContain("dismissed");
    expect(reporterNotes[0].body).not.toContain(seller.userId);
    expect(reporterNotes[0].body).not.toContain(listingId);
    expect(reporterNotes[0].body).not.toContain("SECRET-PRIVATE-DETAILS");
    expect(reporterNotes[0].body).not.toContain("STAFF-ONLY-REASON");
    expect(await notificationsFor(seller.userId, "report_result")).toHaveLength(0);

    const actionReport = await reportListing(await actor(reporter.userId), listingId, "spam", null, { clock });
    await resolveReport(actionReport.report.id, await actor(moderator.userId), "actioned", "STAFF-ONLY-REASON", "hide_listing", { clock });
    await consumeNotifications({ now: clock });
    expect(await notificationsFor(seller.userId, "report_result")).toHaveLength(1);
  });

  it("transactional categories cannot be disabled through notification_preferences", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    await query(
      `INSERT INTO notification_preferences (user_id, category, channel, enabled) VALUES ($1,'listing_moderation','in_app',false)`,
      [seller.userId]
    );
    await pauseListing(listingId, (await makeStaff()).userId, "review", undefined, { clock });
    await consumeNotifications({ now: clock });
    const delivery = await query(
      `SELECT d.* FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id
       WHERE n.user_id=$1 AND d.channel='in_app'`,
      [seller.userId]
    );
    expect(delivery.rows).toHaveLength(1);
    expect(delivery.rows[0].status).toBe("pending");
  });

  it("a failing sink increments attempts, records an error category with no raw error text, and retries until the cap; after the cap the delivery stays failed", async () => {
    await insertEvent("account.suspended", { userId: (await registerVerifyLogin(`u-${randomUUID()}@example.com`)).userId });
    await consumeNotifications({ now: clock });
    const failing = { channel: "email_console", deliver: async () => { throw new Error("SECRET-RAW-SINK-ERROR-12345"); } };
    const first = await deliverPending([failing], { now: clock, maxAttempts: 2 });
    expect(first.failed).toBeGreaterThanOrEqual(1);
    let row = (await query(`SELECT * FROM notification_deliveries WHERE channel='email_console' LIMIT 1`)).rows[0];
    expect(row.attempts).toBe(1);
    expect(row.status).toBe("failed");
    expect(row.last_error_category).toBeTruthy();
    expect(row.last_error_category).not.toContain("SECRET-RAW-SINK-ERROR-12345");
    await deliverPending([failing], { now: clock, maxAttempts: 2 });
    row = (await query(`SELECT * FROM notification_deliveries WHERE channel='email_console' LIMIT 1`)).rows[0];
    expect(row.attempts).toBe(2);
    const third = await deliverPending([failing], { now: clock, maxAttempts: 2 });
    expect(third.failed).toBe(0);
    row = (await query(`SELECT * FROM notification_deliveries WHERE channel='email_console' LIMIT 1`)).rows[0];
    expect(row.attempts).toBe(2);
    expect(row.status).toBe("failed");
  });

  it("a successful sink marks delivery sent with sent_at = injected clock", async () => {
    await insertEvent("account.suspended", { userId: (await registerVerifyLogin(`u-${randomUUID()}@example.com`)).userId });
    await consumeNotifications({ now: clock });
    const sink = new InAppSink();
    const result = await deliverPending([sink], { now: clock });
    expect(result.sent).toBeGreaterThanOrEqual(1);
    const row = (await query(`SELECT * FROM notification_deliveries WHERE channel='in_app' AND status='sent' LIMIT 1`)).rows[0];
    expect(new Date(row.sent_at).toISOString()).toBe(FIXED_NOW.toISOString());
  });

  it("myNotifications returns only the caller's notifications; another user gets NOT_FOUND on markNotificationRead", async () => {
    const seller = await makeApprovedSeller();
    const other = await registerVerifyLogin(`other-${randomUUID()}@example.com`);
    await pauseListing(await makeListing(seller, "published"), (await makeStaff()).userId, "review", undefined, { clock });
    await consumeNotifications({ now: clock });
    const mine = await gql({ query: `query{ myNotifications { items { id category title } } }`, cookie: seller.cookie });
    expect(mine.body.errors).toBeUndefined();
    expect(mine.body.data.myNotifications.items.length).toBe(1);
    const theirs = await gql({ query: `query{ myNotifications { items { id } } }`, cookie: other.cookie });
    expect(theirs.body.data.myNotifications.items).toHaveLength(0);
    const id = mine.body.data.myNotifications.items[0].id;
    const denied = await gql({ query: `mutation($id:ID!){ markNotificationRead(id:$id){ id } }`, variables: { id }, cookie: other.cookie });
    expect(denied.body.errors?.[0]?.message).toMatch(/NOT_FOUND/);
  });

  it("markNotificationRead is idempotent and sets read_at once", async () => {
    const seller = await makeApprovedSeller();
    await pauseListing(await makeListing(seller, "published"), (await makeStaff()).userId, "review", undefined, { clock });
    await consumeNotifications({ now: clock });
    const note = (await notificationsFor(seller.userId))[0];
    expect(note.read_at).toBeNull();
    const first = await gql({ query: `mutation($id:ID!){ markNotificationRead(id:$id){ id readAt } }`, variables: { id: note.id }, cookie: seller.cookie });
    expect(first.body.errors).toBeUndefined();
    const firstRead = (await query(`SELECT read_at FROM notifications WHERE id=$1`, [note.id])).rows[0].read_at;
    expect(firstRead).toBeTruthy();
    const second = await gql({ query: `mutation($id:ID!){ markNotificationRead(id:$id){ id readAt } }`, variables: { id: note.id }, cookie: seller.cookie });
    expect(second.body.errors).toBeUndefined();
    const secondRead = (await query(`SELECT read_at FROM notifications WHERE id=$1`, [note.id])).rows[0].read_at;
    expect(new Date(secondRead).toISOString()).toBe(new Date(firstRead).toISOString());
  });

  it("unreadCount excludes read notifications", async () => {
    const seller = await makeApprovedSeller();
    await pauseListing(await makeListing(seller, "published"), (await makeStaff()).userId, "review", undefined, { clock });
    await consumeNotifications({ now: clock });
    const unreadResponse = await gql({ query: `query{ unreadCount }`, cookie: seller.cookie });
    expect(unreadResponse.body.data.unreadCount).toBe(1);
    const before = await unreadCount(seller.userId);
    expect(before).toBe(1);
    const note = (await notificationsFor(seller.userId))[0];
    await gql({ query: `mutation($id:ID!){ markNotificationRead(id:$id){ id } }`, variables: { id: note.id }, cookie: seller.cookie });
    expect(await unreadCount(seller.userId)).toBe(0);
    const unreadOnly = await myNotifications(seller.userId, { unreadOnly: true });
    expect(unreadOnly.items).toHaveLength(0);
  });

  it("Notification type contains no source_event_id, delivery status, or other user's data (schema test and runtime check)", async () => {
    const typeMap: any = (schema as any).getTypeMap();
    const fields = typeMap.Notification.getFields();
    for (const forbidden of ["sourceEventId", "source_event_id", "deliveryStatus", "status", "attempts", "userId", "recipientEmail"]) {
      expect(fields[forbidden], `Notification must not expose ${forbidden}`).toBeUndefined();
    }
    expect(Object.values(typeMap).filter((t: any) => t instanceof GraphQLObjectType && (t as any).getFields().sourceEventId).map((t: any) => t.name)).toEqual([]);

    const seller = await makeApprovedSeller();
    const other = await registerVerifyLogin(`other-${randomUUID()}@example.com`);
    await pauseListing(await makeListing(seller, "published"), (await makeStaff()).userId, "review", undefined, { clock });
    await consumeNotifications({ now: clock });
    const res = await gql({ query: `query{ myNotifications { items { id category title body link } } }`, cookie: seller.cookie });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("sourceEventId");
    expect(text).not.toContain(other.userId);
    const leak = await gql({ query: `query{ myNotifications { items { sourceEventId } } }`, cookie: seller.cookie });
    expect(leak.body.errors?.[0]?.message).toMatch(/Cannot query field/);
  });

  it("requires authentication for notification reads", async () => {
    const ctx = { user: null, req: {}, res: {} } as GraphQLContext;
    expect(() => requireAuth(ctx)).toThrow(/UNAUTHENTICATED/);
  });
});
