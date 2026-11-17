import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp, type CreateAppOptions } from "../src/index.js";
import { query } from "../src/db.js";
import { createAuction, placeBid, closeAuction, auctionBids } from "../src/auction/service.js";
import { consumeAuctionClosedEvents, getOrder } from "../src/orders/service.js";
import { createCheckout } from "../src/payments/service.js";
import {
  getMyProfile,
  listMySessions,
  revokeMySession,
} from "../src/auth/service.js";
import { updateListingDraft } from "../src/catalogue/service.js";
import { getReportForStaff, reportListing } from "../src/reports/service.js";
import { requestAccountDeletion } from "../src/accounts/deletion.js";
import { sessionCookieOptions } from "../src/auth/cookies.js";
import type { AppUser } from "../src/auth/service.js";

const FIXED_NOW = new Date("2026-11-17T12:00:00.000Z");
const STARTS_AT = new Date(FIXED_NOW.getTime() + 60_000);
const ENDS_AT = new Date(FIXED_NOW.getTime() + 3_600_000);
const METRICS_TOKEN = "test-metrics-token";
const clock = () => FIXED_NOW;

type User = { userId: string; cookie: string; email: string; roles: string[] };

function opts(extra: Partial<CreateAppOptions> = {}): CreateAppOptions {
  return { clock, metricsToken: METRICS_TOKEN, ...extra };
}

function gql(app: ReturnType<typeof createApp>, queryText: string, variables: any = {}, cookie?: string) {
  const r = request(app).post("/graphql").set("content-type", "application/json");
  if (cookie) r.set("Cookie", cookie);
  return r.send({ query: queryText, variables });
}

function getSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

async function resetDb() {
  await query(
    `TRUNCATE TABLE notification_deliveries, notification_preferences, notifications,
     account_deletion_requests, audit_logs, reports, password_reset_tokens,
     email_verification_tokens, sessions, user_roles, user_profiles, listing_media, listings,
     seller_verifications, seller_profiles, users, auctions, bids, proxy_bids, auction_events,
     outbox_events, processed_events, shipments, refunds, webhook_events, payment_transactions,
     order_events, order_fee_lines, orders, fee_rules RESTART IDENTITY CASCADE`
  );
  await query(
    `INSERT INTO fee_rules (fee_code, description, rate_bps, effective_from)
     VALUES ('buyer_fee_placeholder', 'placeholder', 800, '1970-01-01T00:00:00Z')`
  );
}

async function actor(userId: string): Promise<AppUser> {
  const row = (await query(`SELECT id, email, status, email_verified_at FROM users WHERE id=$1`, [userId])).rows[0];
  const roles = (await query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1`, [userId]
  )).rows.map((r: any) => r.name);
  return { ...row, roles };
}

async function registerVerifyLogin(app: ReturnType<typeof createApp>, email: string): Promise<User> {
  const reg = await gql(app, `mutation($input:RegisterInput!){ register(input:$input){ ok userId verificationToken } }`, { input: { email, password: "Str0ngPass!1" } });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const { userId, verificationToken } = reg.body.data.register;
  await gql(app, `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, { t: verificationToken });
  const login = await gql(app, `mutation($input:LoginInput!){ login(input:$input){ ok } }`, { input: { email, password: "Str0ngPass!1" } });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId, cookie: getSetCookie(login), email, roles: ["buyer", "seller"] };
}

async function makeApprovedSeller(app: ReturnType<typeof createApp>): Promise<User> {
  const seller = await registerVerifyLogin(app, `seller-${randomUUID()}@example.com`);
  await gql(app, `mutation($input:SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, {
    input: { sellerType: "individual", displayName: "Security Seller", publicStoreName: "Security Store", legalName: "Restricted", provinceCode: "ON" },
  }, seller.cookie);
  await gql(app, `mutation{ submitSellerVerification { id } }`, {}, seller.cookie);
  const staff = await registerVerifyLogin(app, `staff-${randomUUID()}@example.com`);
  await query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name='admin' ON CONFLICT DO NOTHING`, [staff.userId]);
  const pending = await gql(app, `query{ pendingSellerVerifications { items { id } } }`, {}, staff.cookie);
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  for (const decision of ["under_review", "approved"]) {
    await gql(app, `mutation($input:ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, { input: { verificationId: vid, decision } }, staff.cookie);
  }
  return seller;
}

async function makeListing(app: ReturnType<typeof createApp>, seller: User, status: string): Promise<string> {
  const category = (await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`)).rows[0].id;
  const res = await gql(app, `mutation($input:ListingDraftInput!){ createListingDraft(input:$input){ id } }`, {
    input: { categoryId: category, title: "Security Listing", description: "Security listing description", condition: "used", fulfilmentOption: "both", currency: "CAD", startingPriceMinor: "2500" },
  }, seller.cookie);
  if (res.body.errors) throw new Error(JSON.stringify(res.body.errors));
  const id = res.body.data.createListingDraft.id as string;
  if (status !== "draft") await query(`UPDATE listings SET status=$2 WHERE id=$1`, [id, status]);
  if (status === "published") await query(`UPDATE listings SET published_at=$2 WHERE id=$1`, [id, FIXED_NOW]);
  return id;
}

async function makeOrder(app: ReturnType<typeof createApp>, seller: User, buyer: User) {
  const listingId = await makeListing(app, seller, "published");
  const auction = await createAuction(seller.userId, { listingId, startsAt: STARTS_AT, endsAt: ENDS_AT, startingPriceMinor: 2500 }, { now: clock });
  const bid = await placeBid(buyer.userId, { auctionId: auction.id, amountMinor: 3000, requestId: randomUUID() }, { now: () => STARTS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true });
  await closeAuction(auction.id, { now: () => ENDS_AT });
  await consumeAuctionClosedEvents({ now: () => ENDS_AT });
  const order = (await query(`SELECT * FROM orders LIMIT 1`)).rows[0];
  return { listingId, auction, bid, order };
}

async function counts() {
  const audit = (await query(`SELECT count(*)::int AS c FROM audit_logs`)).rows[0].c;
  const outbox = (await query(`SELECT count(*)::int AS c FROM outbox_events`)).rows[0].c;
  const orderEvents = (await query(`SELECT count(*)::int AS c FROM order_events`)).rows[0].c;
  return { audit, outbox, orderEvents };
}

function expectNoWrites(before: Awaited<ReturnType<typeof counts>>, after: Awaited<ReturnType<typeof counts>>) {
  expect(after).toEqual(before);
}

describe("request IDs, logs, metrics and health (Slice 10)", () => {
  beforeAll(async () => { await query("SELECT 1"); });
  beforeEach(async () => { await resetDb(); });

  it("request id: valid incoming UUID is kept; invalid is replaced; response echoes x-request-id", async () => {
    const app = createApp(opts());
    const valid = "123e4567-e89b-42d3-a456-426614174000";
    const good = await request(app).get("/health/live").set("x-request-id", valid);
    expect(good.headers["x-request-id"]).toBe(valid);
    const bad = await request(app).get("/health/live").set("x-request-id", "not-a-uuid");
    expect(bad.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(bad.headers["x-request-id"]).not.toBe("not-a-uuid");
  });

  it("login with a wrong password: the password value never appears in any captured log line", async () => {
    const lines: string[] = [];
    const app = createApp(opts({ logSink: (line) => lines.push(line) }));
    const user = await registerVerifyLogin(app, `login-${randomUUID()}@example.com`);
    const secret = "WrongPassword!999999";
    await gql(app, `mutation($input:LoginInput!){ login(input:$input){ ok } }`, { input: { email: user.email, password: secret } });
    await gql(app, `mutation($input:LoginInput!){ login(input:$input){ ok } }`, { input: { email: user.email, password: secret } });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain(secret);
      expect(line).not.toContain("variables");
      expect(line).not.toContain(user.email);
    }
  });

  it("GET /metrics without token returns 401; with the test token returns 200 and Prometheus text", async () => {
    const app = createApp(opts());
    const denied = await request(app).get("/metrics");
    expect(denied.status).toBe(401);
    const allowed = await request(app).get("/metrics").set("authorization", `Bearer ${METRICS_TOKEN}`);
    expect(allowed.status).toBe(200);
    expect(allowed.text).toContain("# TYPE");
    expect(allowed.text).toContain("outbox_unpublished_rows");
  });

  it("GET /health/live returns 200 with no dependency access", async () => {
    let touched = false;
    const app = createApp(opts({
      healthDeps: {
        postgres: async () => { touched = true; },
        redis: async () => { touched = true; },
      },
    }));
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(touched).toBe(false);
  });

  it("health ready endpoint reports fail with injected failing dependency and no error text", async () => {
    const app = createApp(opts({
      healthDeps: { postgres: async () => undefined, redis: async () => { throw new Error("secret-host user@example.com"); } },
    }));
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("secret-host");
    expect(JSON.stringify(res.body)).not.toContain("user@example.com");
  });

  it("session cookie attributes: HttpOnly and SameSite set; Secure set when production config is injected", () => {
    const dev = sessionCookieOptions(false);
    expect(dev.httpOnly).toBe(true);
    expect(dev.sameSite).toBe("lax");
    expect(dev.secure).toBe(false);
    const prod = sessionCookieOptions(true);
    expect(prod.secure).toBe(true);
    expect(prod.httpOnly).toBe(true);
  });
});

describe("account deletion stub (Slice 10)", () => {
  beforeAll(async () => { await query("SELECT 1"); });
  beforeEach(async () => { await resetDb(); });

  it("requestAccountDeletion records one row, writes one audit row, sessions remain valid, and a repeat call writes nothing", async () => {
    const app = createApp(opts());
    const user = await registerVerifyLogin(app, `delete-${randomUUID()}@example.com`);
    // second active session
    await gql(app, `mutation($input:LoginInput!){ login(input:$input){ ok } }`, { input: { email: user.email, password: "Str0ngPass!1" } });
    const before = await counts();
    const first = await requestAccountDeletion(user.userId, "no longer needed", { clock });
    expect(first.created).toBe(true);
    const rows = await query(`SELECT * FROM account_deletion_requests`);
    expect(rows.rows).toHaveLength(1);
    expect(new Date(rows.rows[0].requested_at).toISOString()).toBe(FIXED_NOW.toISOString());
    expect((await counts()).audit).toBe(before.audit + 1);
    const activeSessions = await query(`SELECT count(*)::int AS c FROM sessions WHERE user_id=$1 AND revoked_at IS NULL`, [user.userId]);
    expect(activeSessions.rows[0].c).toBe(2);
    const after = await counts();
    const second = await requestAccountDeletion(user.userId, "again", { clock });
    expect(second.created).toBe(false);
    expect(second.requestId).toBe(first.requestId);
    expectNoWrites(after, await counts());
  });

  it("deletion request state: unique while requested; suspended may request, closed writes nothing", async () => {
    const app = createApp(opts());
    const suspended = await registerVerifyLogin(app, `suspended-${randomUUID()}@example.com`);
    await query(`UPDATE users SET status='suspended' WHERE id=$1`, [suspended.userId]);
    expect((await requestAccountDeletion(suspended.userId, null, { clock })).created).toBe(true);
    const closed = await registerVerifyLogin(app, `closed-${randomUUID()}@example.com`);
    await query(`UPDATE users SET status='closed' WHERE id=$1`, [closed.userId]);
    const before = await counts();
    const result = await requestAccountDeletion(closed.userId, null, { clock });
    expect(result).toEqual({ requestId: null, created: false, reason: "closed" });
    expectNoWrites(before, await counts());
  });
});

describe("IDOR suite (Slice 10)", () => {
  beforeAll(async () => { await query("SELECT 1"); });
  beforeEach(async () => { await resetDb(); });

  it("IDOR: orders — user B cannot read or act on user A's order", async () => {
    const app = createApp(opts());
    const a = await makeApprovedSeller(app);
    const b = await makeApprovedSeller(app);
    const buyerA = await registerVerifyLogin(app, `buyer-${randomUUID()}@example.com`);
    const { order } = await makeOrder(app, a, buyerA);
    const before = await counts();
    await expect(getOrder(order.id, { id: b.userId, roles: b.roles })).rejects.toThrow(/NOT_FOUND/);
    await expect(
      (await import("../src/payments/service.js")).createCheckout(
        order.id,
        b.userId,
        { acceptedTotalMinor: String(order.total_minor), fulfilmentChoice: "shipping", requestId: randomUUID() },
        { now: clock, moneyEnabled: true }
      )
    ).rejects.toThrow(/NOT_FOUND/);
    expectNoWrites(before, await counts());
  });

  it("IDOR: payments — user B cannot create a payment on user A's order", async () => {
    const app = createApp(opts());
    const a = await makeApprovedSeller(app);
    const b = await registerVerifyLogin(app, `b-${randomUUID()}@example.com`);
    const buyerA = await registerVerifyLogin(app, `buyer-${randomUUID()}@example.com`);
    const { order } = await makeOrder(app, a, buyerA);
    const before = await counts();
    await expect(
      createCheckout(
        order.id,
        b.userId,
        { acceptedTotalMinor: String(order.total_minor), fulfilmentChoice: "shipping", requestId: randomUUID() },
        { now: clock, moneyEnabled: true }
      )
    ).rejects.toThrow(/NOT_FOUND/);
    expect((await query(`SELECT count(*)::int AS c FROM payment_transactions`)).rows[0].c).toBe(0);
    expectNoWrites(before, await counts());
  });

  it("IDOR: bids — bid history exposes only opaque labels and user B cannot reuse user A's request id", async () => {
    const app = createApp(opts());
    const a = await makeApprovedSeller(app);
    const b = await registerVerifyLogin(app, `b-${randomUUID()}@example.com`);
    const buyerA = await registerVerifyLogin(app, `buyer-${randomUUID()}@example.com`);
    const listingId = await makeListing(app, a, "published");
    const auction = await createAuction(a.userId, { listingId, startsAt: STARTS_AT, endsAt: ENDS_AT, startingPriceMinor: 2500 }, { now: clock });
    const requestId = randomUUID();
    const firstBid = await placeBid(buyerA.userId, { auctionId: auction.id, amountMinor: 3000, requestId }, { now: () => STARTS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true });
    const before = await counts();
    const history = await auctionBids(auction.id, { first: 20 });
    const text = JSON.stringify(history);
    expect(text).not.toContain(buyerA.userId);
    expect(text).not.toContain("bidderUserId");
    expect(firstBid.accepted).toBe(true);
    await expect(
      placeBid(b.userId, { auctionId: auction.id, amountMinor: 4000, requestId }, { now: () => STARTS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true })
    ).rejects.toThrow(/REQUEST_ID_CONFLICT/);
    expectNoWrites(before, await counts());
  });

  it("IDOR: notifications — user B cannot mark user A's notification read or list it", async () => {
    const app = createApp(opts());
    const a = await registerVerifyLogin(app, `a-${randomUUID()}@example.com`);
    const b = await registerVerifyLogin(app, `b-${randomUUID()}@example.com`);
    const inserted = await query(
      `INSERT INTO notifications (user_id, category, title, body, source_event_id, created_at)
       VALUES ($1,'account_status','Notice','Body',$2,$3) RETURNING id`,
      [a.userId, randomUUID(), FIXED_NOW]
    );
    const before = await counts();
    const res = await gql(app, `mutation($id:ID!){ markNotificationRead(id:$id){ id } }`, { id: inserted.rows[0].id }, b.cookie);
    expect(res.body.errors?.[0]?.message).toMatch(/NOT_FOUND/);
    const list = await gql(app, `query{ myNotifications { items { id } } }`, {}, b.cookie);
    expect(list.body.data.myNotifications.items).toHaveLength(0);
    expect((await query(`SELECT read_at FROM notifications WHERE id=$1`, [inserted.rows[0].id])).rows[0].read_at).toBeNull();
    expectNoWrites(before, await counts());
  });

  it("IDOR: listing drafts — user B cannot update user A's draft", async () => {
    const app = createApp(opts());
    const a = await makeApprovedSeller(app);
    const b = await makeApprovedSeller(app);
    const listingId = await makeListing(app, a, "draft");
    const category = (await query(`SELECT id FROM categories LIMIT 1`)).rows[0].id;
    const before = await counts();
    await expect(
      updateListingDraft(b.userId, listingId, {
        categoryId: category, title: "Hijacked Title", description: "Hijacked description", condition: "used",
        fulfilmentOption: "both", currency: "CAD", startingPriceMinor: "2500",
      })
    ).rejects.toThrow(/NOT_FOUND/);
    expect((await query(`SELECT title FROM listings WHERE id=$1`, [listingId])).rows[0].title).toBe("Security Listing");
    expectNoWrites(before, await counts());
  });

  it("IDOR: seller verification — user B cannot view or review user A's verification", async () => {
    const app = createApp(opts());
    const a = await makeApprovedSeller(app);
    const b = await makeApprovedSeller(app);
    const aVerification = (await query(`SELECT id FROM seller_verifications WHERE seller_profile_id=(SELECT id FROM seller_profiles WHERE user_id=$1)`, [a.userId])).rows[0].id;
    const before = await counts();
    const mine = await gql(app, `query{ mySellerVerification { id } }`, {}, b.cookie);
    expect(JSON.stringify(mine.body)).not.toContain(aVerification);
    const review = await gql(app, `mutation($input:ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ id } }`, {
      input: { verificationId: aVerification, decision: "approved" },
    }, b.cookie);
    expect(review.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    expectNoWrites(before, await counts());
  });

  it("IDOR: reports — non-staff user B cannot read user A's report", async () => {
    const app = createApp(opts());
    const seller = await makeApprovedSeller(app);
    const reporterA = await registerVerifyLogin(app, `reporter-a-${randomUUID()}@example.com`);
    const b = await registerVerifyLogin(app, `b-${randomUUID()}@example.com`);
    const listingId = await makeListing(app, seller, "published");
    const report = await reportListing(await actor(reporterA.userId), listingId, "spam", null, { clock });
    const before = await counts();
    await expect(getReportForStaff(await actor(b.userId), report.report.id)).rejects.toThrow(/FORBIDDEN/);
    const gqlRes = await gql(app, `query($id:ID!){ reportForStaff(id:$id){ id } }`, { id: report.report.id }, b.cookie);
    expect(gqlRes.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    expectNoWrites(before, await counts());
  });

  it("IDOR: account sessions — user B cannot revoke user A's session", async () => {
    const app = createApp(opts());
    const a = await registerVerifyLogin(app, `a-${randomUUID()}@example.com`);
    const b = await registerVerifyLogin(app, `b-${randomUUID()}@example.com`);
    const aSessions = await listMySessions(a.userId);
    const before = await counts();
    await expect(
      revokeMySession({ userId: b.userId, sessionId: aSessions[0].id, actorUserId: b.userId })
    ).rejects.toThrow(/NOT_FOUND/);
    const bSessions = await listMySessions(b.userId);
    expect(JSON.stringify(bSessions)).not.toContain(aSessions[0].id);
    expect((await query(`SELECT revoked_at FROM sessions WHERE id=$1`, [aSessions[0].id])).rows[0].revoked_at).toBeNull();
    expectNoWrites(before, await counts());
  });

  it("IDOR: profile — user B cannot read or modify user A's profile", async () => {
    const app = createApp(opts());
    const a = await registerVerifyLogin(app, `a-${randomUUID()}@example.com`);
    const b = await registerVerifyLogin(app, `b-${randomUUID()}@example.com`);
    await gql(app, `mutation($input:UpdateProfileInput!){ updateMyProfile(input:$input){ userId } }`, { input: { displayName: "A-PROFILE-SECRET" } }, a.cookie);
    const before = await counts();
    const bProfile = await getMyProfile(b.userId);
    expect(JSON.stringify(bProfile)).not.toContain("A-PROFILE-SECRET");
    const gqlProfile = await gql(app, `query{ myProfile { displayName } }`, {}, b.cookie);
    expect(JSON.stringify(gqlProfile.body)).not.toContain("A-PROFILE-SECRET");
    expectNoWrites(before, await counts());
  });

  it("IDOR: deletion request — user B cannot read or act on user A's request", async () => {
    const app = createApp(opts());
    const a = await registerVerifyLogin(app, `a-${randomUUID()}@example.com`);
    const b = await registerVerifyLogin(app, `b-${randomUUID()}@example.com`);
    const aRequest = await requestAccountDeletion(a.userId, null, { clock });
    const before = await counts();
    const bRequest = await requestAccountDeletion(b.userId, null, { clock });
    expect(bRequest.requestId).not.toBe(aRequest.requestId);
    const rows = await query(`SELECT user_id FROM account_deletion_requests`);
    expect(rows.rows.map((r: any) => r.user_id).sort()).toEqual([a.userId, b.userId].sort());
    expect((await query(`SELECT id FROM account_deletion_requests WHERE user_id=$1`, [a.userId])).rows[0].id).toBe(aRequest.requestId);
    expect((await counts()).audit).toBe(before.audit + 1); // B's own request only
  });
});

describe("rate limits (Slice 10)", () => {
  beforeAll(async () => { await query("SELECT 1"); });
  beforeEach(async () => { await resetDb(); });

  const operations = [
    ["register", `mutation($input:RegisterInput!){ register(input:$input){ ok } }`],
    ["login", `mutation($input:LoginInput!){ login(input:$input){ ok } }`],
    ["requestPasswordReset", `mutation($email:String!){ requestPasswordReset(email:$email){ ok } }`],
    ["resendVerification", `mutation($email:String!){ resendVerification(email:$email){ ok } }`],
    ["placeBid", `mutation($input:PlaceBidInput!){ placeBid(input:$input){ accepted } }`],
    ["createCheckout", `mutation($input:CheckoutInput!){ createCheckout(input:$input){ id } }`],
    ["reportListing", `mutation($id:ID!){ reportListing(listingId:$id, category:spam){ id } }`],
  ] as const;

  for (const [name, queryText] of operations) {
    it(`rate limit present on ${name} (429 reached after configured limit)`, async () => {
      const app = createApp(opts({ rateLimits: { windowMs: 60_000, generalLimit: 1, strictLimit: 1 } }));
      const first = await gql(app, queryText, {});
      expect(first.status).not.toBe(429);
      const second = await gql(app, queryText, {});
      expect(second.status).toBe(429);
      expect(JSON.stringify(second.body)).toContain("RATE_LIMITED");
    });
  }
});
