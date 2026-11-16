import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { grantRole } from "../src/auth/service.js";
import {
  createAuction,
  placeBid,
  closeAuction,
  closeDueAuctions,
  type Auction,
} from "../src/auction/service.js";
import { publishOutbox } from "../src/outbox/publisher.js";
import { InMemoryOutboxSink } from "../src/outbox/sinks.js";

const app = createApp();
const FIXED_NOW = new Date("2026-11-16T12:00:00.000Z");
const ENDS_AT = new Date(FIXED_NOW.getTime() + 3_600_000);
const PUBLISH_NOW = new Date(FIXED_NOW.getTime() + 7_200_000);

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
     auctions, bids, proxy_bids, auction_events, outbox_events RESTART IDENTITY CASCADE`
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
  return { userId: userId as string, cookie: getSetCookie(login) };
}

const SELLER_PROFILE = {
  sellerType: "individual",
  displayName: "Close Seller",
  publicStoreName: "Close Store",
  legalName: "Close Legal",
  provinceCode: "ON",
};

async function makeSellerWithPublishedListing(email: string): Promise<{ seller: { userId: string; cookie: string }; listingId: string }> {
  const seller = await registerVerifyLogin(email);
  await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: SELLER_PROFILE }, cookie: seller.cookie });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const staff = await registerVerifyLogin(`staff-${randomUUID()}@example.com`);
  await grantRole(staff.userId, "moderator", staff.userId);
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
        title: "Close test listing",
        description: "Auction close test.",
        condition: "used",
        fulfilmentOption: "shipping",
        currency: "CAD",
        startingPriceMinor: "2500",
        requestedStartsAt: null,
        requestedEndsAt: null,
      },
    },
    cookie: seller.cookie,
  });
  if (created.body.errors) throw new Error(JSON.stringify(created.body.errors));
  const listingId = created.body.data.createListingDraft.id;
  await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
  const publisher = await registerVerifyLogin(`publisher-${randomUUID()}@example.com`);
  await grantRole(publisher.userId, "moderator", publisher.userId);
  await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: publisher.cookie });
  return { seller, listingId };
}

async function insertBidderUser(): Promise<string> {
  const email = `bidder-${randomUUID()}@example.com`;
  const res = await query(
    `INSERT INTO users (email, password_hash, status, email_verified_at) VALUES ($1, 'x', 'active', now()) RETURNING id`,
    [email]
  );
  const userId = res.rows[0].id;
  await query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name='buyer'`, [userId]);
  return userId;
}

async function makeAuction(opts?: { endsAt?: Date }): Promise<Auction> {
  const { seller, listingId } = await makeSellerWithPublishedListing(`seller-${randomUUID()}@example.com`);
  return createAuction(
    seller.userId,
    {
      listingId,
      startsAt: new Date(FIXED_NOW.getTime() + 60_000),
      endsAt: opts?.endsAt ?? ENDS_AT,
      startingPriceMinor: 2500,
    },
    { now: () => FIXED_NOW }
  );
}

async function activeAuctionWithBids(count = 3, amountStart = 2500) {
  const auction = await makeAuction();
  const accepted = [];
  for (let i = 0; i < count; i++) {
    const bidderUserId = await insertBidderUser();
    const result = await placeBid(
      bidderUserId,
      { auctionId: auction.id, amountMinor: amountStart + i * 100, requestId: randomUUID() },
      { now: () => auction.startsAt, bidIncrementMinor: 100, liveBiddingEnabled: true }
    );
    expect(result.accepted).toBe(true);
    accepted.push(result);
  }
  return { auction, accepted };
}

async function auctionRow(auctionId: string) {
  return (await query(`SELECT * FROM auctions WHERE id=$1`, [auctionId])).rows[0];
}

async function countWhere(sql: string, params: any[]): Promise<number> {
  return (await query(`SELECT count(*)::int AS c FROM ${sql}`, params)).rows[0].c;
}

const countCloseEvents = (auctionId: string) =>
  countWhere("auction_events WHERE auction_id=$1 AND to_status LIKE 'closed_%'", [auctionId]);
const countCloseAudit = (auctionId: string) =>
  countWhere("audit_logs WHERE action='auction.closed' AND target_id=$1", [auctionId]);
const countCloseOutbox = (auctionId: string) =>
  countWhere("outbox_events WHERE aggregate_id=$1 AND event_type='auction.closed'", [auctionId]);

describe("auction close (Slice 4b)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("closeAuction before ends_at throws AUCTION_NOT_DUE and writes no row", async () => {
    const auction = await makeAuction();
    await expect(
      closeAuction(auction.id, { now: () => new Date(ENDS_AT.getTime() - 1) })
    ).rejects.toThrow(/AUCTION_NOT_DUE/);
    expect((await auctionRow(auction.id)).status).toBe("scheduled");
    expect(await countCloseEvents(auction.id)).toBe(0);
    expect(await countCloseAudit(auction.id)).toBe(0);
    expect(await countCloseOutbox(auction.id)).toBe(0);
  });

  it("closeAuction one ms before ends_at does not close; exactly at ends_at closes", async () => {
    const auction = await makeAuction();
    await expect(
      closeAuction(auction.id, { now: () => new Date(ENDS_AT.getTime() - 1) })
    ).rejects.toThrow(/AUCTION_NOT_DUE/);
    expect((await auctionRow(auction.id)).status).toBe("scheduled");

    const result = await closeAuction(auction.id, { now: () => ENDS_AT });
    expect(result.status).toBe("closed_unsold");
    expect((await auctionRow(auction.id)).status).toBe("closed_unsold");
  });

  it("closing an active auction with bids sets closed_sold, winning bid = highest bid, closed_at = injected now, and writes one event, audit and outbox row", async () => {
    const { auction, accepted } = await activeAuctionWithBids(3);
    const winner = accepted[accepted.length - 1];
    const result = await closeAuction(auction.id, { now: () => ENDS_AT });

    expect(result.status).toBe("closed_sold");
    expect(result.changed).toBe(true);
    expect(result.winningAmountMinor).toBe("2700");
    const row = await auctionRow(auction.id);
    expect(row.status).toBe("closed_sold");
    expect(row.winning_bid_id).toBe(winner.bid!.id);
    expect(new Date(row.closed_at).getTime()).toBe(ENDS_AT.getTime());
    expect(new Date(row.updated_at).getTime()).toBe(ENDS_AT.getTime());

    expect(await countCloseEvents(auction.id)).toBe(1);
    expect(await countCloseAudit(auction.id)).toBe(1);
    expect(await countCloseOutbox(auction.id)).toBe(1);
    const audit = (await query(`SELECT * FROM audit_logs WHERE action='auction.closed' AND target_id=$1`, [auction.id])).rows[0];
    expect(audit.actor_user_id).toBeNull();
    expect(audit.reason).toBe("system_close");
    expect(audit.metadata).toMatchObject({ beforeStatus: "active", afterStatus: "closed_sold" });

    const event = (await query(`SELECT payload, created_at FROM outbox_events WHERE aggregate_id=$1 AND event_type='auction.closed'`, [auction.id])).rows[0];
    expect(event.payload).toMatchObject({
      auctionId: auction.id,
      status: "closed_sold",
      winningBidId: winner.bid!.id,
      winningAmountMinor: "2700",
      winnerBidderLabel: winner.bid!.bidderLabel,
    });
    expect(event.payload).not.toHaveProperty("winnerBidderUserId");
    expect(new Date(event.created_at).getTime()).toBe(ENDS_AT.getTime());
  });

  it("closing an auction with no bids sets closed_unsold with winning_bid_id null", async () => {
    const auction = await makeAuction();
    const result = await closeAuction(auction.id, { now: () => ENDS_AT });
    expect(result.status).toBe("closed_unsold");
    expect(result.winningBidId).toBeNull();
    const row = await auctionRow(auction.id);
    expect(row.status).toBe("closed_unsold");
    expect(row.winning_bid_id).toBeNull();
  });

  it("closing a scheduled auction past ends_at sets closed_unsold (D2 expired without activation)", async () => {
    const auction = await makeAuction();
    const result = await closeAuction(auction.id, { now: () => new Date(ENDS_AT.getTime() + 60_000) });
    expect(result.status).toBe("closed_unsold");
    expect((await auctionRow(auction.id)).status).toBe("closed_unsold");
    const event = (await query(`SELECT from_status, to_status FROM auction_events WHERE auction_id=$1 AND to_status='closed_unsold'`, [auction.id])).rows[0];
    expect(event).toMatchObject({ from_status: "scheduled", to_status: "closed_unsold" });
  });

  it("closeAuction twice: second call writes nothing new and returns the same outcome", async () => {
    const { auction, accepted } = await activeAuctionWithBids(2);
    const first = await closeAuction(auction.id, { now: () => ENDS_AT });
    const countsAfterFirst = {
      events: await countCloseEvents(auction.id),
      audit: await countCloseAudit(auction.id),
      outbox: await countCloseOutbox(auction.id),
    };
    const second = await closeAuction(auction.id, { now: () => new Date(ENDS_AT.getTime() + 60_000) });

    expect(second.changed).toBe(false);
    expect({
      auctionId: second.auctionId,
      status: second.status,
      winningBidId: second.winningBidId,
      winningAmountMinor: second.winningAmountMinor,
      winnerBidderLabel: second.winnerBidderLabel,
    }).toEqual({
      auctionId: first.auctionId,
      status: first.status,
      winningBidId: first.winningBidId,
      winningAmountMinor: first.winningAmountMinor,
      winnerBidderLabel: first.winnerBidderLabel,
    });
    expect(second.winningBidId).toBe(accepted[accepted.length - 1].bid!.id);
    expect({
      events: await countCloseEvents(auction.id),
      audit: await countCloseAudit(auction.id),
      outbox: await countCloseOutbox(auction.id),
    }).toEqual(countsAfterFirst);
  });

  it("forced failure after the status update rolls back status, event, audit and outbox writes", async () => {
    const { auction } = await activeAuctionWithBids(1);
    await expect(
      closeAuction(auction.id, {
        now: () => ENDS_AT,
        afterStatusUpdate: () => {
          throw new Error("forced failure after status update");
        },
      })
    ).rejects.toThrow("forced failure after status update");
    const row = await auctionRow(auction.id);
    expect(row.status).toBe("active");
    expect(row.winning_bid_id).toBeNull();
    expect(row.closed_at).toBeNull();
    expect(await countCloseEvents(auction.id)).toBe(0);
    expect(await countCloseAudit(auction.id)).toBe(0);
    expect(await countCloseOutbox(auction.id)).toBe(0);
  });

  it("placeBid at or after the close boundary is rejected AUCTION_NOT_OPEN and writes no bid row", async () => {
    const { auction } = await activeAuctionWithBids(1);
    await closeAuction(auction.id, { now: () => ENDS_AT });
    const before = (await query(`SELECT count(*)::int AS c FROM bids WHERE auction_id=$1`, [auction.id])).rows[0].c;
    const at = await placeBid(await insertBidderUser(), { auctionId: auction.id, amountMinor: 2800, requestId: randomUUID() }, { now: () => ENDS_AT, bidIncrementMinor: 100, liveBiddingEnabled: true });
    const after = await placeBid(await insertBidderUser(), { auctionId: auction.id, amountMinor: 2800, requestId: randomUUID() }, { now: () => new Date(ENDS_AT.getTime() + 1), bidIncrementMinor: 100, liveBiddingEnabled: true });
    expect(at.accepted).toBe(false);
    expect(at.error?.code).toBe("AUCTION_NOT_OPEN");
    expect(after.accepted).toBe(false);
    expect(after.error?.code).toBe("AUCTION_NOT_OPEN");
    expect((await query(`SELECT count(*)::int AS c FROM bids WHERE auction_id=$1`, [auction.id])).rows[0].c).toBe(before);
  });

  it("parallel race: concurrent placeBid calls and one closeAuction at the boundary end consistently with one close event", async () => {
    const auction = await makeAuction();
    const bidderIds = await Promise.all(Array.from({ length: 10 }, () => insertBidderUser()));
    const bids = bidderIds.map((bidderUserId, i) =>
      placeBid(
        bidderUserId,
        { auctionId: auction.id, amountMinor: 2500 + i * 100, requestId: randomUUID() },
        { now: () => new Date(ENDS_AT.getTime() - 1), bidIncrementMinor: 100, liveBiddingEnabled: true }
      )
    );
    const [bidResults, closeResult] = await Promise.all([
      Promise.all(bids),
      closeAuction(auction.id, { now: () => ENDS_AT }),
    ]);
    const accepted = bidResults.filter((r) => r.accepted);
    for (const result of accepted) {
      expect(new Date(result.bid!.acceptedAt).getTime()).toBeLessThan(ENDS_AT.getTime());
    }
    expect((await query(`SELECT count(*)::int AS c FROM bids WHERE auction_id=$1`, [auction.id])).rows[0].c).toBe(accepted.length);

    if (accepted.length > 0) {
      const max = accepted.reduce((m, r) => (r.bid!.amount.minorUnits > m.bid!.amount.minorUnits ? r : m));
      expect(closeResult.status).toBe("closed_sold");
      expect(closeResult.winningBidId).toBe(max.bid!.id);
      expect(closeResult.winningAmountMinor).toBe(String(max.bid!.amount.minorUnits));
    } else {
      expect(closeResult.status).toBe("closed_unsold");
      expect(closeResult.winningBidId).toBeNull();
    }
    expect((await auctionRow(auction.id)).status).toBe(closeResult.status);
    expect(await countCloseOutbox(auction.id)).toBe(1);
    expect(await countCloseEvents(auction.id)).toBe(1);
  });

  it("closeDueAuctions closes only due auctions with correct counts; a second run closes nothing new", async () => {
    const jobNow = new Date(ENDS_AT.getTime() + 60_000);
    const dueA = await makeAuction();
    const dueB = await makeAuction();
    const notDue = await makeAuction({ endsAt: new Date(jobNow.getTime() + 3_600_000) });

    const first = await closeDueAuctions({ now: () => jobNow });
    expect(first).toMatchObject({ closed: 2, skipped: 0, failed: 0, errors: [] });
    expect((await auctionRow(dueA.id)).status).toBe("closed_unsold");
    expect((await auctionRow(dueB.id)).status).toBe("closed_unsold");
    expect((await auctionRow(notDue.id)).status).toBe("scheduled");

    const second = await closeDueAuctions({ now: () => jobNow });
    expect(second).toMatchObject({ closed: 0, skipped: 0, failed: 0, errors: [] });
    expect(await countCloseOutbox(dueA.id)).toBe(1);
    expect(await countCloseOutbox(dueB.id)).toBe(1);
  });

  it("closeDueAuctions with one failing auction still closes the others and reports the failure", async () => {
    const jobNow = new Date(ENDS_AT.getTime() + 60_000);
    const good = await makeAuction();
    const bad = await makeAuction();

    const result = await closeDueAuctions({
      now: () => jobNow,
      afterStatusUpdate: (auctionId) => {
        if (auctionId === bad.id) throw new Error("forced close failure");
      },
    });
    expect(result.closed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([{ auctionId: bad.id, message: "forced close failure" }]);
    expect((await auctionRow(good.id)).status).toBe("closed_unsold");
    expect((await auctionRow(bad.id)).status).toBe("scheduled");
    expect(await countCloseAudit(bad.id)).toBe(0);
    expect(await countCloseOutbox(bad.id)).toBe(0);
  });
});

describe("outbox publisher (Slice 4b)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  async function makeOutboxRows(count: number): Promise<string[]> {
    for (let i = 0; i < count; i++) {
      const { auction } = await activeAuctionWithBids(1);
      await closeAuction(auction.id, { now: () => ENDS_AT });
    }
    const rows = await query(
      `SELECT id FROM outbox_events ORDER BY created_at ASC, id ASC`
    );
    return rows.rows.map((r: any) => r.id as string);
  }

  it("publishOutbox with a working sink marks all rows published with published_at = injected now; second run publishes nothing", async () => {
    const ids = await makeOutboxRows(2);
    const sink = new InMemoryOutboxSink();
    const first = await publishOutbox(sink, { now: () => PUBLISH_NOW });
    expect(first.published).toBe(ids.length);
    expect(first.failed).toBe(0);
    expect(sink.delivered.map((m) => m.id)).toEqual(ids);

    const unpublished = await query(`SELECT count(*)::int AS c FROM outbox_events WHERE published_at IS NULL`);
    expect(unpublished.rows[0].c).toBe(0);
    const wrongTime = await query(`SELECT count(*)::int AS c FROM outbox_events WHERE published_at <> $1`, [PUBLISH_NOW]);
    expect(wrongTime.rows[0].c).toBe(0);

    const secondSink = new InMemoryOutboxSink();
    const second = await publishOutbox(secondSink, { now: () => PUBLISH_NOW });
    expect(second).toEqual({ published: 0, failed: 0 });
    expect(secondSink.delivered).toHaveLength(0);
  });

  it("publishOutbox with a sink failing on the second row stops the batch; a retry publishes the rest exactly once", async () => {
    const ids = await makeOutboxRows(3);
    const failingSink = new InMemoryOutboxSink(1);
    const first = await publishOutbox(failingSink, { now: () => PUBLISH_NOW });
    expect(first).toEqual({ published: 1, failed: 1 });
    expect(failingSink.delivered.map((m) => m.id)).toEqual([ids[0]]);
    const afterFirst = await query(`SELECT id FROM outbox_events WHERE published_at IS NOT NULL ORDER BY created_at ASC, id ASC`);
    expect(afterFirst.rows.map((r: any) => r.id)).toEqual([ids[0]]);

    const retrySink = new InMemoryOutboxSink();
    const retry = await publishOutbox(retrySink, { now: () => PUBLISH_NOW });
    expect(retry).toEqual({ published: ids.length - 1, failed: 0 });
    expect(retrySink.delivered.map((m) => m.id)).toEqual(ids.slice(1));
    const all = await query(`SELECT count(*)::int AS c FROM outbox_events WHERE published_at IS NOT NULL`);
    expect(all.rows[0].c).toBe(ids.length);
  });

  it("no SQL now() or Date.now() in close/publish source paths", () => {
    const files = [
      "../src/auction/service.ts",
      "../src/auction/closeJob.ts",
      "../src/outbox/publisher.ts",
      "../src/outbox/sinks.ts",
    ];
    for (const file of files) {
      const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      expect(source).not.toMatch(/Date\.now\(\)/);
      const templateLiterals = [...source.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]);
      for (const literal of templateLiterals) {
        expect(literal.toLowerCase()).not.toMatch(/\bnow\(\)/);
      }
    }
  });
});
