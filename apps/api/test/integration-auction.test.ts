import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { graphql } from "graphql";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { grantRole } from "../src/auth/service.js";
import { schema } from "../src/graphql/schema.js";
import { config } from "../src/config.js";
import { createAuction, getAuction, auctionForListing, placeBid, setProxyBid } from "../src/auction/service.js";

const app = createApp();

const FIXED_NOW = new Date("2026-11-16T12:00:00.000Z");

async function gql(opts: { query: string; variables?: any; cookie?: string }) {
  const r = request(app).post("/graphql").set("content-type", "application/json");
  if (opts.cookie) r.set("Cookie", opts.cookie);
  return r.send({ query: opts.query, variables: opts.variables });
}

async function resetDb() {
  // Keep seeded categories (placeholder taxonomy) intact.
  await query(
    `TRUNCATE TABLE audit_logs, password_reset_tokens, email_verification_tokens, sessions, user_roles, user_profiles,
     listing_media, listings, seller_verifications, seller_profiles, users,
     auctions, bids, proxy_bids, auction_events, outbox_events RESTART IDENTITY CASCADE`
  );
}

function getSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

async function registerVerifyLogin(email: string, password = "Str0ngPass!1") {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
    variables: { input: { email, password } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const { userId, verificationToken } = reg.body.data.register;
  const ver = await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: verificationToken } });
  if (ver.body.errors) throw new Error(JSON.stringify(ver.body.errors));
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId: userId as string, cookie: getSetCookie(login) };
}

async function registerLoginUnverified(email: string, password = "Str0ngPass!1") {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId } }`,
    variables: { input: { email, password } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId: reg.body.data.register.userId as string, cookie: getSetCookie(login) };
}

const SELLER_PROFILE = {
  sellerType: "individual",
  displayName: "Listing Seller",
  publicStoreName: "Store",
  legalName: "Legal",
  provinceCode: "ON",
};

async function makeApprovedSeller(email: string) {
  const seller = await registerVerifyLogin(email);
  await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: SELLER_PROFILE }, cookie: seller.cookie });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const staff = await registerVerifyLogin(`staff-${Date.now()}-${Math.random()}@example.com`);
  await grantRole(staff.userId, "moderator", staff.userId);
  const pending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "under_review" } }, cookie: staff.cookie });
  const approved = await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "approved" } }, cookie: staff.cookie });
  if (approved.body.errors) throw new Error(JSON.stringify(approved.body.errors));
  return seller;
}

async function getPlaceholderCategoryId() {
  const res = await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`);
  return res.rows[0].id as string;
}

function baseListingInput(categoryId: string) {
  return {
    categoryId,
    title: "  Vintage Maple Chair  ",
    description: "Solid wood chair in good condition.",
    condition: "used",
    fulfilmentOption: "both",
    currency: "CAD",
    startingPriceMinor: "2500",
    requestedStartsAt: null,
    requestedEndsAt: null,
  };
}

async function makeSellerWithPublishedListing(email: string) {
  const seller = await makeApprovedSeller(email);
  const categoryId = await getPlaceholderCategoryId();
  const created = await gql({
    query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id slug status } }`,
    variables: { input: baseListingInput(categoryId) },
    cookie: seller.cookie,
  });
  if (created.body.errors) throw new Error(JSON.stringify(created.body.errors));
  const listingId = created.body.data.createListingDraft.id;
  const sub = await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
  if (sub.body.errors) throw new Error(JSON.stringify(sub.body.errors));
  // Seller is already approved by makeApprovedSeller; a moderator just publishes the listing.
  const staff = await registerVerifyLogin(`staff-${Date.now()}-${Math.random()}@example.com`);
  await grantRole(staff.userId, "moderator", staff.userId);
  const ap = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
  if (ap.body.errors) throw new Error(JSON.stringify(ap.body.errors));
  return { seller, listingId };
}

async function insertBidderUser(email: string): Promise<string> {
  const res = await query(
    `INSERT INTO users (email, password_hash, status, email_verified_at) VALUES ($1, 'x', 'active', now()) RETURNING id`,
    [email]
  );
  const userId = res.rows[0].id;
  await query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name='buyer'`, [userId]);
  return userId;
}

async function countBids(auctionId: string): Promise<number> {
  const res = await query(`SELECT count(*)::int as c FROM bids WHERE auction_id=$1`, [auctionId]);
  return res.rows[0].c;
}

async function countOutbox(auctionId: string): Promise<number> {
  const res = await query(`SELECT count(*)::int as c FROM outbox_events WHERE aggregate_type='auction' AND aggregate_id=$1`, [auctionId]);
  return res.rows[0].c;
}

async function countAuctionEvents(auctionId: string): Promise<number> {
  const res = await query(`SELECT count(*)::int as c FROM auction_events WHERE auction_id=$1`, [auctionId]);
  return res.rows[0].c;
}

async function countAuctionsForListing(listingId: string): Promise<number> {
  const res = await query(`SELECT count(*)::int as c FROM auctions WHERE listing_id=$1`, [listingId]);
  return res.rows[0].c;
}

async function countAuctionCreatedAudit(listingId: string): Promise<number> {
  const res = await query(
    `SELECT count(*)::int as c FROM audit_logs WHERE action='auction.created' AND metadata->>'listingId'=$1`,
    [listingId]
  );
  return res.rows[0].c;
}

describe("auction create (Slice 4a)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("seller creates an auction for their own published listing; a non-owner cannot (NOT_FOUND)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-own-${Date.now()}@example.com`);
    // createAuction via GraphQL validates startsAt against the real server clock, so the
    // schedule must be derived from runtime time; a fixed date becomes a time bomb.
    const now = Date.now();
    const startsAt = new Date(now + 86_400_000);
    const endsAt = new Date(now + 86_400_000 * 8);
    const created = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id listingId status currentPrice { minorUnits currency } startingPriceMinor endsAt } }`,
      variables: { input: { listingId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), startingPriceMinor: 2500 } },
      cookie: seller.cookie,
    });
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createAuction.status).toBe("scheduled");
    expect(Number(created.body.data.createAuction.currentPrice.minorUnits)).toBe(2500);
    expect(created.body.data.createAuction.currentPrice.currency).toBe("CAD");

    const other = await makeApprovedSeller(`auc-other-${Date.now()}@example.com`);
    const denied = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables: { input: { listingId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), startingPriceMinor: 2500 } },
      cookie: other.cookie,
    });
    expect(denied.body.errors?.[0]?.message || "").toContain("NOT_FOUND");
  });

  it("createAuction rejects a listing that is not published", async () => {
    const seller = await makeApprovedSeller(`auc-draft-${Date.now()}@example.com`);
    const categoryId = await getPlaceholderCategoryId();
    const created = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: { input: baseListingInput(categoryId) },
      cookie: seller.cookie,
    });
    const listingId = created.body.data.createListingDraft.id;
    const res = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables: { input: { listingId, startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 86400000 * 8).toISOString(), startingPriceMinor: 2500 } },
      cookie: seller.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("LISTING_NOT_PUBLISHED");
  });

  it("createAuction rejects startsAt not after server now (INVALID_SCHEDULE)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-sched-${Date.now()}@example.com`);
    const res = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables: { input: { listingId, startsAt: "2020-01-01T00:00:00.000Z", endsAt: new Date(Date.now() + 86400000 * 8).toISOString(), startingPriceMinor: 2500 } },
      cookie: seller.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("INVALID_SCHEDULE");
  });

  it("createAuction rejects a second auction for the same listing (AUCTION_ALREADY_EXISTS)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-dupe-create-${Date.now()}@example.com`);
    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const endsAt = new Date(Date.now() + 86_400_000 * 8).toISOString();
    const variables = { input: { listingId, startsAt, endsAt, startingPriceMinor: 2500 } };

    const first = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables,
      cookie: seller.cookie,
    });
    expect(first.body.errors).toBeUndefined();

    const second = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables,
      cookie: seller.cookie,
    });
    expect(second.body.errors?.[0]?.message || "").toContain("AUCTION_ALREADY_EXISTS");
  });

  it("createAuction rejects a non-positive startingPriceMinor (VALIDATION_ERROR)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-bad-price-${Date.now()}@example.com`);
    const res = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables: {
        input: {
          listingId,
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          endsAt: new Date(Date.now() + 86_400_000 * 8).toISOString(),
          startingPriceMinor: 0,
        },
      },
      cookie: seller.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("VALIDATION_ERROR");
  });

  it.each([0, -100, 12.5])(
    "createAuction(service) rejects startingPriceMinor %s with VALIDATION_ERROR and writes no auction or audit row",
    async (startingPriceMinor) => {
      const { seller, listingId } = await makeSellerWithPublishedListing(
        `auc-svc-price-${Date.now()}-${String(startingPriceMinor).replace(".", "_")}@example.com`
      );
      await expect(
        createAuction(
          seller.userId,
          {
            listingId,
            startsAt: new Date(FIXED_NOW.getTime() + 86_400_000),
            endsAt: new Date(FIXED_NOW.getTime() + 86_400_000 * 8),
            startingPriceMinor,
          },
          { now: () => FIXED_NOW }
        )
      ).rejects.toThrow(/VALIDATION_ERROR/);
      expect(await countAuctionsForListing(listingId)).toBe(0);
      expect(await countAuctionCreatedAudit(listingId)).toBe(0);
    }
  );

  it("createAuction GraphQL rejects a non-integer startingPriceMinor before the service and writes nothing", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-gql-price-${Date.now()}@example.com`);
    const res = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables: {
        input: {
          listingId,
          startsAt: new Date(FIXED_NOW.getTime() + 86_400_000).toISOString(),
          endsAt: new Date(FIXED_NOW.getTime() + 86_400_000 * 8).toISOString(),
          startingPriceMinor: 12.5,
        },
      },
      cookie: seller.cookie,
    });
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors?.[0]?.message || "").toMatch(/Int|integer/i);
    expect(res.body.data?.createAuction ?? null).toBeNull();
    expect(await countAuctionsForListing(listingId)).toBe(0);
    expect(await countAuctionCreatedAudit(listingId)).toBe(0);
  });

  it("createAuction rejects endsAt <= startsAt (VALIDATION_ERROR)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-bad-window-${Date.now()}@example.com`);
    const startsAt = new Date(Date.now() + 86_400_000);
    const res = await gql({
      query: `mutation($input: CreateAuctionInput!){ createAuction(input:$input){ id } }`,
      variables: { input: { listingId, startsAt: startsAt.toISOString(), endsAt: startsAt.toISOString(), startingPriceMinor: 2500 } },
      cookie: seller.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("VALIDATION_ERROR");
  });

  it("two concurrent createAuction calls for one listing: exactly one succeeds, the other is AUCTION_ALREADY_EXISTS", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-race-create-${Date.now()}@example.com`);
    const input = {
      listingId,
      startsAt: new Date(FIXED_NOW.getTime() + 60_000),
      endsAt: new Date(FIXED_NOW.getTime() + 3_600_000),
      startingPriceMinor: 2500,
    };
    const results = await Promise.allSettled([
      createAuction(seller.userId, input, { now: () => FIXED_NOW }),
      createAuction(seller.userId, input, { now: () => FIXED_NOW }),
    ]);
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.message).toContain("AUCTION_ALREADY_EXISTS");
    const rows = await query(`SELECT count(*)::int AS c FROM auctions WHERE listing_id=$1`, [listingId]);
    expect(rows.rows[0].c).toBe(1);
  });
});

describe("placeBid (Slice 4a)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  async function setupOpenAuction(sellerUserId: string, listingId: string, startingPriceMinor = 2500) {
    const startsAt = new Date(FIXED_NOW.getTime() + 60_000);
    const endsAt = new Date(FIXED_NOW.getTime() + 3_600_000);
    const auction = await createAuction(
      sellerUserId,
      { listingId, startsAt, endsAt, startingPriceMinor },
      { now: () => FIXED_NOW }
    );
    return auction;
  }

  it("bid before starts_at is rejected AUCTION_NOT_OPEN; bid exactly at starts_at is accepted; bid exactly at ends_at is rejected; bid one ms before ends_at is accepted (injected clock)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-bid-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const startsAt = auction.startsAt;
    const endsAt = auction.endsAt;

    const before = await placeBid(await insertBidderUser(`auc-bidder-${Date.now()}@example.com`), { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111101" }, { now: () => new Date(startsAt.getTime() - 1), bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(before.accepted).toBe(false);
    expect(before.error?.code).toBe("AUCTION_NOT_OPEN");

    const atStart = await placeBid(await insertBidderUser(`auc-bidder2-${Date.now()}@example.com`), { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111102" }, { now: () => startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(atStart.accepted).toBe(true);
    const persisted = await query(`SELECT accepted_at FROM bids WHERE id=$1`, [atStart.bid!.id]);
    expect(new Date(persisted.rows[0].accepted_at).getTime()).toBe(startsAt.getTime());

    // Every persisted timestamp from this accepted bid uses the same injected clock value.
    const activationEvent = await query(
      `SELECT created_at FROM auction_events WHERE auction_id=$1 AND from_status='scheduled' AND to_status='active'`,
      [auction.id]
    );
    expect(new Date(activationEvent.rows[0].created_at).getTime()).toBe(startsAt.getTime());
    const bidOutbox = await query(
      `SELECT created_at FROM outbox_events WHERE aggregate_type='auction' AND aggregate_id=$1 AND event_type='auction.bid.accepted'`,
      [auction.id]
    );
    expect(new Date(bidOutbox.rows[0].created_at).getTime()).toBe(startsAt.getTime());
    const auctionRow = await query(`SELECT updated_at FROM auctions WHERE id=$1`, [auction.id]);
    expect(new Date(auctionRow.rows[0].updated_at).getTime()).toBe(startsAt.getTime());

    const atEnd = await placeBid(await insertBidderUser(`auc-bidder3-${Date.now()}@example.com`), { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111103" }, { now: () => endsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(atEnd.accepted).toBe(false);
    expect(atEnd.error?.code).toBe("AUCTION_NOT_OPEN");

    const beforeEnd = await placeBid(await insertBidderUser(`auc-bidder4-${Date.now()}@example.com`), { auctionId: auction.id, amountMinor: 2600, requestId: "11111111-1111-4111-8111-111111111104" }, { now: () => new Date(endsAt.getTime() - 1), bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(beforeEnd.accepted).toBe(true);
  });

  it("placeBid reads the injected clock exactly once at the ends_at boundary and persists that value", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-clock-once-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const bidderUserId = await insertBidderUser(`auc-clock-once-bidder-${Date.now()}@example.com`);
    // First call is 1 ms before ends_at (acceptable); a second call would land exactly at ends_at (rejected).
    const firstTick = new Date(auction.endsAt.getTime() - 1);
    const laterTick = new Date(auction.endsAt.getTime());
    const ticks = [firstTick, laterTick, laterTick];
    let clockCalls = 0;
    const now = () => {
      const value = ticks[Math.min(clockCalls, ticks.length - 1)];
      clockCalls += 1;
      return value;
    };

    const res = await placeBid(
      bidderUserId,
      { auctionId: auction.id, amountMinor: 2500, requestId: randomUUID() },
      { now, bidIncrementMinor: 100, liveBiddingEnabled: true }
    );
    expect(clockCalls).toBe(1);
    expect(res.accepted).toBe(true);
    const persisted = await query(`SELECT accepted_at FROM bids WHERE id=$1`, [res.bid!.id]);
    expect(new Date(persisted.rows[0].accepted_at).getTime()).toBe(firstTick.getTime());
    const auctionRow = await query(`SELECT updated_at FROM auctions WHERE id=$1`, [auction.id]);
    expect(new Date(auctionRow.rows[0].updated_at).getTime()).toBe(firstTick.getTime());
  });

  it("bid after ends_at is rejected AUCTION_NOT_OPEN and writes no bid row", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-bid2-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const bidderUserId = await insertBidderUser(`auc-bidder5-${Date.now()}@example.com`);
    const accepted = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111105" }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(accepted.accepted).toBe(true);
    const beforeCount = await countBids(auction.id);
    const after = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 3000, requestId: "11111111-1111-4111-8111-111111111106" }, { now: () => new Date(auction.endsAt.getTime() + 1000), bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(after.accepted).toBe(false);
    expect(after.error?.code).toBe("AUCTION_NOT_OPEN");
    const afterCount = await countBids(auction.id);
    expect(afterCount).toBe(beforeCount);
  });

  it("seller cannot bid on own listing (SELLER_CANNOT_BID)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-seller-bid-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const res = await placeBid(seller.userId, { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111107" }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(res.accepted).toBe(false);
    expect(res.error?.code).toBe("SELLER_CANNOT_BID");
  });

  it("unverified bidder cannot bid (EMAIL_NOT_VERIFIED)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-unv-bid-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const unverified = await registerLoginUnverified(`auc-unv-user-${Date.now()}@example.com`);
    const res = await gql({
      query: `mutation($input: PlaceBidInput!){ placeBid(input:$input){ accepted error { code message } } }`,
      variables: { input: { auctionId: auction.id, amountMinor: 2500, requestId: randomUUID() } },
      cookie: unverified.cookie,
    });
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors?.[0]?.message || "").toContain("EMAIL_NOT_VERIFIED");
  });

  it("bid below minimum is rejected BID_TOO_LOW; a rejected bid leaves current_price unchanged and writes no bid row", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-low-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const bidderUserId = await insertBidderUser(`auc-low-bidder-${Date.now()}@example.com`);
    const first = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111108" }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(first.accepted).toBe(true);
    expect(Number(first.auction?.currentPriceMinor ?? 0)).toBe(2500);
    const beforeCount = await countBids(auction.id);
    const second = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2550, requestId: "11111111-1111-4111-8111-111111111109" }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(second.accepted).toBe(false);
    expect(second.error?.code).toBe("BID_TOO_LOW");
    const afterReject = await query(`SELECT current_price_minor FROM auctions WHERE id=$1`, [auction.id]);
    expect(Number(afterReject.rows[0].current_price_minor)).toBe(2500);
    expect(await countBids(auction.id)).toBe(beforeCount);
    const third = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2600, requestId: "11111111-1111-4111-8111-111111111110" }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(third.accepted).toBe(true);
    const afterCount = await countBids(auction.id);
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("same request_id twice returns the original bid and auction snapshot; replay writes nothing even after a later bid", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-idem-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const bidderUserId = await insertBidderUser(`auc-idem-bidder-${Date.now()}@example.com`);
    const requestId = "11111111-1111-4111-8111-111111111111";
    const first = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(first.accepted).toBe(true);
    expect(first.auction).not.toBeNull();

    const afterFirst = {
      bids: await countBids(auction.id),
      outbox: await countOutbox(auction.id),
      events: await countAuctionEvents(auction.id),
    };
    expect(afterFirst).toEqual({ bids: 1, outbox: 1, events: 2 });

    const replay = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId }, { now: () => new Date(auction.startsAt.getTime() + 30_000), bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(replay.accepted).toBe(true);
    expect(replay.bid?.id).toBe(first.bid?.id);
    expect(replay.auction).toEqual(first.auction);
    expect({
      bids: await countBids(auction.id),
      outbox: await countOutbox(auction.id),
      events: await countAuctionEvents(auction.id),
    }).toEqual(afterFirst);

    // A later accepted bid changes the live auction, but the original replay must still return its snapshot.
    const laterBidder = await insertBidderUser(`auc-idem-later-${Date.now()}@example.com`);
    const later = await placeBid(laterBidder, { auctionId: auction.id, amountMinor: 2600, requestId: randomUUID() }, { now: () => new Date(auction.startsAt.getTime() + 60_000), bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(later.accepted).toBe(true);
    expect(later.auction?.currentPriceMinor).toBe("2600");
    const afterLater = {
      bids: await countBids(auction.id),
      outbox: await countOutbox(auction.id),
      events: await countAuctionEvents(auction.id),
    };
    expect(afterLater).toEqual({ bids: 2, outbox: 2, events: 2 });

    const replayAfterLater = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId }, { now: () => new Date(auction.startsAt.getTime() + 90_000), bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(replayAfterLater.accepted).toBe(true);
    expect(replayAfterLater.bid?.id).toBe(first.bid?.id);
    expect(replayAfterLater.auction).toEqual(first.auction);
    expect({
      bids: await countBids(auction.id),
      outbox: await countOutbox(auction.id),
      events: await countAuctionEvents(auction.id),
    }).toEqual(afterLater);
  });

  it("different request_id with the same amount creates a new bid", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-dup-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const bidderUserId = await insertBidderUser(`auc-dup-bidder-${Date.now()}@example.com`);
    const first = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111112" }, { now: () => auction.startsAt, bidIncrementMinor: 0, liveBiddingEnabled: true });
    expect(first.accepted).toBe(true);
    const second = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111113" }, { now: () => auction.startsAt, bidIncrementMinor: 0, liveBiddingEnabled: true });
    expect(second.accepted).toBe(true);
    expect(await countBids(auction.id)).toBe(2);
  });

  it("N parallel bids (20, distinct bidders, distinct amounts, interleaved): accepted bids recorded, current_price_minor equals max accepted amount, no lost update", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-par-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 1000);
    const bidderIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      bidderIds.push(await insertBidderUser(`auc-par-bidder-${Date.now()}-${i}@example.com`));
    }
    const results = await Promise.all(
      bidderIds.map((bidderUserId, i) =>
        placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 1000 + i * 100, requestId: `22222222-2222-4222-8222-2222222222${String(i).padStart(2, "0")}` }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true })
      )
    );
    // Concurrent bids serialize on the auction row lock; a bid that arrives after a higher one is legitimately BID_TOO_LOW.
    const accepted = results.filter((r) => r.accepted);
    const rejected = results.filter((r) => !r.accepted);
    expect(accepted.length).toBeGreaterThan(0);
    for (const r of rejected) expect(r.error?.code).toBe("BID_TOO_LOW");
    // Exactly the accepted bids are recorded (no duplicates, no lost rows).
    expect(await countBids(auction.id)).toBe(accepted.length);
    // No lost update: the persisted current price is the maximum accepted amount, and every accepted response agrees.
    const maxAccepted = Math.max(...accepted.map((r) => r.bid!.amount.minorUnits));
    expect(maxAccepted).toBe(1000 + 19 * 100);
    const finalRow = await query(`SELECT current_price_minor FROM auctions WHERE id=$1`, [auction.id]);
    expect(Number(finalRow.rows[0].current_price_minor)).toBe(maxAccepted);
  });

  it("a bid writes exactly one outbox_events row in the same transaction; a rolled-back bid writes no outbox row (force a failure after the insert in a test hook)", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-outbox-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const bidderUserId = await insertBidderUser(`auc-outbox-bidder-${Date.now()}@example.com`);
    const accepted = await placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2500, requestId: "11111111-1111-4111-8111-111111111114" }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(accepted.accepted).toBe(true);
    expect(await countOutbox(auction.id)).toBe(1);
    await expect(
      placeBid(bidderUserId, { auctionId: auction.id, amountMinor: 2600, requestId: "11111111-1111-4111-8111-111111111115" }, { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true, beforeCommit: () => { throw new Error("forced failure after insert"); } })
    ).rejects.toThrow("forced failure after insert");
    expect(await countOutbox(auction.id)).toBe(1);
    expect(await countBids(auction.id)).toBe(1);
  });

  it("placeBid GraphQL success path accepts a bid and uses config.auction.bidIncrementMinor", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-gql-bid-${Date.now()}@example.com`);
    const realNow = Date.now();
    const auction = await createAuction(
      seller.userId,
      {
        listingId,
        startsAt: new Date(realNow - 60_000),
        endsAt: new Date(realNow + 3_600_000),
        startingPriceMinor: 2500,
      },
      { now: () => new Date(realNow - 120_000) }
    );
    const bidderUserId = await insertBidderUser(`auc-gql-bidder-${Date.now()}@example.com`);
    const increment = config.auction.bidIncrementMinor;
    expect(increment).toBeGreaterThan(0);
    const contextValue = {
      req: {},
      res: {},
      user: { id: bidderUserId, email_verified_at: new Date(), roles: [] },
      auctionConfig: { auction: { bidIncrementMinor: increment }, features: { liveBiddingEnabled: true } },
    };
    const source = `mutation($input: PlaceBidInput!){ placeBid(input:$input){ accepted bid { id amount { minorUnits currency } acceptedAt bidderLabel } auction { currentPrice { minorUnits } } error { code message } } }`;
    const call = (amountMinor: number) =>
      graphql({
        schema,
        source,
        variableValues: { input: { auctionId: auction.id, amountMinor, requestId: randomUUID() } },
        contextValue,
      });

    const first = await call(2500);
    expect(first.errors).toBeUndefined();
    expect((first.data as any).placeBid.accepted).toBe(true);
    expect((first.data as any).placeBid.bid.amount).toEqual({ minorUnits: 2500, currency: "CAD" });

    const belowIncrement = await call(2500 + increment - 1);
    expect(belowIncrement.errors).toBeUndefined();
    expect((belowIncrement.data as any).placeBid.accepted).toBe(false);
    expect((belowIncrement.data as any).placeBid.error.code).toBe("BID_TOO_LOW");

    const atIncrement = await call(2500 + increment);
    expect(atIncrement.errors).toBeUndefined();
    expect((atIncrement.data as any).placeBid.accepted).toBe(true);
    expect((atIncrement.data as any).placeBid.bid.amount.minorUnits).toBe(2500 + increment);
    expect((atIncrement.data as any).placeBid.auction.currentPrice.minorUnits).toBe(2500 + increment);
  });

  it("setProxyBid returns NOT_IMPLEMENTED_PENDING_DECISION through GraphQL", async () => {
    const res = await gql({
      query: `mutation($input: SetProxyBidInput!){ setProxyBid(input:$input) }`,
      variables: { input: { auctionId: randomUUID(), maxAmountMinor: 10_000 } },
    });
    expect(res.body.errors?.[0]?.message || "").toContain("NOT_IMPLEMENTED_PENDING_DECISION");
  });

  it("flag OFF: placeBid returns LIVE_BIDDING_DISABLED and writes nothing", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-flagoff-${Date.now()}@example.com`);
    const auction = await setupOpenAuction(seller.userId, listingId, 2500);
    const res = await gql({
      query: `mutation($input: PlaceBidInput!){ placeBid(input:$input){ accepted bid { id } auction { id } error { code message } } }`,
      variables: { input: { auctionId: auction.id, amountMinor: 2500, requestId: randomUUID() } },
      cookie: seller.cookie,
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.placeBid.accepted).toBe(false);
    expect(res.body.data.placeBid.error?.code).toBe("LIVE_BIDDING_DISABLED");
    expect(await countBids(auction.id)).toBe(0);
  });

  it("setProxyBid returns NOT_IMPLEMENTED_PENDING_DECISION", async () => {
    await expect(setProxyBid()).rejects.toThrow(/NOT_IMPLEMENTED_PENDING_DECISION/);
  });
});

describe("auction public queries (Slice 4a)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("auction(id) and auctionForListing never expose bidder user ids or proxy rows (schema test)", async () => {
    const auctionType = await graphql({ schema, source: `{ __type(name: "Auction") { fields { name } } }` });
    const auctionFields: string[] = (auctionType.data as any)?.__type?.fields?.map((f: any) => f.name) ?? [];
    expect(auctionFields.some((f: string) => /bidder|proxy|reserve/i.test(f))).toBe(false);
    expect(auctionFields).toContain("status");

    const bidType = await graphql({ schema, source: `{ __type(name: "Bid") { fields { name } } }` });
    const bidFields: string[] = (bidType.data as any)?.__type?.fields?.map((f: any) => f.name) ?? [];
    expect(bidFields).toContain("bidderLabel");
    expect(bidFields.some((f: string) => /bidderId|bidder_id/i.test(f))).toBe(false);
  });

  it("getAuction and auctionForListing return the public auction for a published listing", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-pub-${Date.now()}@example.com`);
    const auction = await createAuction(
      seller.userId,
      { listingId, startsAt: new Date(FIXED_NOW.getTime() + 60_000), endsAt: new Date(FIXED_NOW.getTime() + 3_600_000), startingPriceMinor: 2500 },
      { now: () => FIXED_NOW }
    );
    const got = await getAuction(auction.id);
    expect(got).not.toBeNull();
    expect(got?.status).toBe("scheduled");
    expect(Number(got?.currentPriceMinor)).toBe(2500);

    const slugRes = await query(`SELECT l.slug AS slug FROM listings l WHERE l.id=$1`, [listingId]);
    const bySlug = await auctionForListing((slugRes.rows[0] as any).slug);
    expect(bySlug).not.toBeNull();
  });

  it("Auction.bids returns public accepted bid history paginated by accepted_at and id", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-pub-bids-${Date.now()}@example.com`);
    const auction = await createAuction(
      seller.userId,
      { listingId, startsAt: new Date(FIXED_NOW.getTime() + 60_000), endsAt: new Date(FIXED_NOW.getTime() + 3_600_000), startingPriceMinor: 2500 },
      { now: () => FIXED_NOW }
    );
    const startsAt = auction.startsAt;
    const amounts = [2500, 2600, 2700];
    for (let i = 0; i < amounts.length; i++) {
      const bidderUserId = await insertBidderUser(`auc-pub-bidder-${Date.now()}-${i}@example.com`);
      const res = await placeBid(
        bidderUserId,
        { auctionId: auction.id, amountMinor: amounts[i], requestId: randomUUID() },
        { now: () => new Date(startsAt.getTime() + i * 1000), bidIncrementMinor: 100, liveBiddingEnabled: true }
      );
      expect(res.accepted).toBe(true);
    }

    const firstPage = await gql({
      query: `query($id:ID!){ auction(id:$id){ startsAt bids(first:2){ items { amount { minorUnits currency } acceptedAt bidderLabel } endCursor } } }`,
      variables: { id: auction.id },
    });
    expect(firstPage.body.errors).toBeUndefined();
    const firstData = firstPage.body.data.auction;
    expect(firstData.startsAt).toBe(startsAt.toISOString());
    expect(firstData.bids.items.map((b: any) => b.amount.minorUnits)).toEqual([2700, 2600]);
    for (const item of firstData.bids.items) {
      expect(item).not.toHaveProperty("bidderUserId");
      expect(item.bidderLabel).toMatch(/^bidder-[0-9a-f]{16}$/);
      expect(item.amount.currency).toBe("CAD");
      expect(new Date(item.acceptedAt).toISOString()).toBe(item.acceptedAt);
    }
    expect(typeof firstData.bids.endCursor).toBe("string");

    const secondPage = await gql({
      query: `query($id:ID!, $after:String){ auction(id:$id){ bids(first:1, after:$after){ items { amount { minorUnits } } endCursor } } }`,
      variables: { id: auction.id, after: firstData.bids.endCursor },
    });
    expect(secondPage.body.errors).toBeUndefined();
    expect(secondPage.body.data.auction.bids.items.map((b: any) => b.amount.minorUnits)).toEqual([2500]);
  });

  it("getAuction and auctionForListing return NOT_FOUND for paused or removed listings", async () => {
    const { seller, listingId } = await makeSellerWithPublishedListing(`auc-pub-hidden-${Date.now()}@example.com`);
    const auction = await createAuction(
      seller.userId,
      { listingId, startsAt: new Date(FIXED_NOW.getTime() + 60_000), endsAt: new Date(FIXED_NOW.getTime() + 3_600_000), startingPriceMinor: 2500 },
      { now: () => FIXED_NOW }
    );
    const slug = (await query(`SELECT slug FROM listings WHERE id=$1`, [listingId])).rows[0].slug as string;
    for (const status of ["paused", "removed"]) {
      await query(`UPDATE listings SET status=$2 WHERE id=$1`, [listingId, status]);
      await expect(getAuction(auction.id)).rejects.toThrow(/NOT_FOUND/);
      await expect(auctionForListing(slug)).rejects.toThrow(/NOT_FOUND/);
    }
  });
});
