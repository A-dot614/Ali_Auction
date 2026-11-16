import { createHash } from "node:crypto";
import { query, withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";
import { config } from "../config.js";
import { assertTransition, type AuctionStatus } from "./auctionStateMachine.js";
import { minimumBidMinor } from "./minimumBid.js";

export type { AuctionStatus };

export type Auction = {
  id: string;
  listingId: string;
  status: AuctionStatus;
  currency: string;
  startingPriceMinor: string; // bigint as string (minor units, CAD)
  reservePriceMinor: string | null; // unused in Slice 4a (TODO docs/16 §3 #7)
  currentPriceMinor: string; // bigint as string (minor units, CAD)
  startsAt: Date;
  endsAt: Date;
  winningBidId: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Bid = {
  id: string;
  auctionId: string;
  bidderUserId: string;
  amountMinor: string;
  currency: string;
  bidType: string;
  requestId: string;
  acceptedAt: Date;
  createdAt: Date;
};

export type BidPublic = {
  id: string;
  amount: { minorUnits: number; currency: string };
  acceptedAt: Date;
  // Opaque bidder label only; never expose bidder user id (docs/16 §2).
  bidderLabel: string;
};

export type BidResult = {
  accepted: boolean;
  bid: BidPublic | null;
  auction: Auction | null;
  error: { code: string; message: string } | null;
};

export type CreateAuctionInput = {
  listingId: string;
  startsAt: Date;
  endsAt: Date;
  startingPriceMinor: number | string;
};

export type PlaceBidInput = {
  auctionId: string;
  amountMinor: number;
  requestId: string;
};

export type AuctionServiceOptions = {
  now?: () => Date;
  bidIncrementMinor?: number;
  liveBiddingEnabled?: boolean;
  beforeCommit?: () => Promise<void> | void;
};

function toMinOrThrow(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (typeof value === "string" && !/^\d+$/.test(value)) throw new Error("VALIDATION_ERROR: startingPriceMinor must be a positive integer.");
  if (!Number.isInteger(n) || n <= 0) throw new Error("VALIDATION_ERROR: startingPriceMinor must be a positive integer.");
  return String(n);
}

function bidderLabelFor(userId: string): string {
  const digest = createHash("sha256").update(userId).digest("hex");
  return `bidder-${digest.slice(0, 16)}`;
}

function mapAuction(row: any): Auction {
  return {
    id: row.id,
    listingId: row.listing_id,
    status: row.status as AuctionStatus,
    currency: row.currency,
    startingPriceMinor: String(row.starting_price_minor),
    reservePriceMinor: row.reserve_price_minor == null ? null : String(row.reserve_price_minor),
    currentPriceMinor: String(row.current_price_minor),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    winningBidId: row.winning_bid_id ?? null,
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBid(row: any): Bid {
  return {
    id: row.id,
    auctionId: row.auction_id,
    bidderUserId: row.bidder_user_id,
    amountMinor: String(row.amount_minor),
    currency: row.currency,
    bidType: row.bid_type,
    requestId: row.request_id,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

function mapBidPublic(row: any, bidderUserId: string): BidPublic {
  const bid = mapBid(row);
  return {
    id: bid.id,
    amount: { minorUnits: Number(bid.amountMinor), currency: bid.currency },
    acceptedAt: bid.acceptedAt,
    bidderLabel: bidderLabelFor(bidderUserId),
  };
}

export async function createAuction(
  actorUserId: string,
  input: CreateAuctionInput,
  opts?: { now?: () => Date }
): Promise<Auction> {
  const now = opts?.now ?? (() => new Date());
  const listingRes = await query(`SELECT * FROM listings WHERE id = $1`, [input.listingId]);
  if ((listingRes.rowCount ?? 0) === 0) {
    throw new Error("NOT_FOUND: Listing not found.");
  }
  const listing = listingRes.rows[0];
  if (listing.status !== "published") {
    throw new Error("LISTING_NOT_PUBLISHED: Only published listings can have an auction.");
  }
  const spRes = await query(`SELECT user_id FROM seller_profiles WHERE id = $1`, [listing.seller_profile_id]);
  const sellerUserId = (spRes.rows[0]?.user_id as string) ?? null;
  if (sellerUserId !== actorUserId) {
    throw new Error("NOT_FOUND: Auction not found for this listing.");
  }
  const existing = await query(`SELECT id FROM auctions WHERE listing_id = $1`, [input.listingId]);
  if ((existing.rowCount ?? 0) > 0) {
    throw new Error("AUCTION_ALREADY_EXISTS: Auction already exists for this listing.");
  }
  const startsAt = input.startsAt;
  const endsAt = input.endsAt;
  if (!(startsAt > now())) {
    throw new Error("INVALID_SCHEDULE: Auction starts_at must be strictly after server now.");
  }
  if (!(endsAt > startsAt)) {
    throw new Error("VALIDATION_ERROR: Auction ends_at must be after starts_at.");
  }
  const startingPriceMinor = toMinOrThrow(input.startingPriceMinor);
  return withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO auctions (listing_id, status, currency, starting_price_minor, reserve_price_minor, current_price_minor, starts_at, ends_at, winning_bid_id, closed_at, created_at, updated_at)
       VALUES ($1, 'scheduled', 'CAD', $2, NULL, $2, $3, $4, NULL, NULL, now(), now())
       RETURNING *`,
      [input.listingId, startingPriceMinor, startsAt, endsAt]
    );
    const auction = mapAuction(res.rows[0]);
    await recordAudit(
      {
        actorUserId,
        action: "auction.created",
        targetType: "auction",
        targetId: auction.id,
        metadata: { listingId: input.listingId, status: auction.status },
      },
      client
    );
    await client.query(
      `INSERT INTO auction_events (auction_id, from_status, to_status, actor_user_id) VALUES ($1, NULL, 'scheduled', $2)`,
      [auction.id, actorUserId]
    );
    return auction;
  });
}

export async function getAuction(id: string): Promise<Auction | null> {
  const res = await query(
    `SELECT a.*, l.status AS listing_status FROM auctions a JOIN listings l ON l.id = a.listing_id WHERE a.id = $1`,
    [id]
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const row = res.rows[0];
  if (row.listing_status !== "published") {
    throw new Error("NOT_FOUND: Auction not found.");
  }
  return mapAuction(row);
}

export async function auctionForListing(slug: string): Promise<Auction | null> {
  const res = await query(
    `SELECT a.*, l.status AS listing_status FROM auctions a JOIN listings l ON l.id = a.listing_id WHERE l.slug = $1`,
    [slug]
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const row = res.rows[0];
  if (row.listing_status !== "published") {
    throw new Error("NOT_FOUND: Auction not found.");
  }
  return mapAuction(row);
}

export async function placeBid(
  bidderUserId: string,
  input: PlaceBidInput,
  opts?: AuctionServiceOptions
): Promise<BidResult> {
  const now = opts?.now ?? (() => new Date());
  // Fail-closed: live bidding is OFF unless the caller explicitly enables it (resolver passes config.features).
  const incrementMinor = opts?.bidIncrementMinor ?? config.auction.bidIncrementMinor;
  if (opts?.liveBiddingEnabled !== true) {
    return {
      accepted: false,
      bid: null,
      auction: null,
      error: { code: "LIVE_BIDDING_DISABLED", message: "LIVE_BIDDING_DISABLED: Live bidding is not enabled." },
    };
  }
  return withTransaction(async (client) => {
    const auctionRes = await client.query(`SELECT * FROM auctions WHERE id = $1 FOR UPDATE`, [input.auctionId]);
    if ((auctionRes.rowCount ?? 0) === 0) {
      throw new Error("NOT_FOUND: Auction not found.");
    }
    const auction = auctionRes.rows[0];

    // Idempotency: same request_id returns the original bid and writes nothing new.
    const existingBid = await client.query(`SELECT * FROM bids WHERE request_id = $1`, [input.requestId]);
    if ((existingBid.rowCount ?? 0) > 0) {
      const existing = existingBid.rows[0];
      if (existing.auction_id !== input.auctionId || existing.bidder_user_id !== bidderUserId) {
        throw new Error("REQUEST_ID_CONFLICT: request_id was already used for a different bid.");
      }
      const bidPublic = mapBidPublic(existing, existing.bidder_user_id);
      return { accepted: true, bid: bidPublic, auction: mapAuction(auction), error: null };
    }

    // Seller cannot bid on own listing.
    const listingRes = await client.query(`SELECT * FROM listings WHERE id = $1`, [auction.listing_id]);
    const sellerUserId = listingRes.rows[0]
      ? ((await client.query(`SELECT user_id FROM seller_profiles WHERE id = $1`, [listingRes.rows[0].seller_profile_id])).rows[0]?.user_id as string) ?? null
      : null;
    if (sellerUserId === bidderUserId) {
      return {
        accepted: false,
        bid: null,
        auction: mapAuction(auction),
        error: { code: "SELLER_CANNOT_BID", message: "SELLER_CANNOT_BID: Seller cannot bid on their own listing." },
      };
    }

    // Auction open only if scheduled|active and now within [starts_at, ends_at).
    const isOpen =
      (auction.status === "scheduled" || auction.status === "active") &&
      auction.starts_at instanceof Date &&
      auction.ends_at instanceof Date &&
      auction.starts_at <= now() &&
      now() < auction.ends_at;
    if (!isOpen) {
      return {
        accepted: false,
        bid: null,
        auction: mapAuction(auction),
        error: { code: "AUCTION_NOT_OPEN", message: "AUCTION_NOT_OPEN: Auction is not open for bidding." },
      };
    }

    const currentPriceMinor = Number(auction.current_price_minor);
    const startingPriceMinor = Number(auction.starting_price_minor);
    const bidCountRes = await client.query(`SELECT count(*)::int as c FROM bids WHERE auction_id=$1`, [input.auctionId]);
    const bidCount = bidCountRes.rows[0].c;
    const minAmount = minimumBidMinor({
      bidCount,
      startingPriceMinor,
      currentPriceMinor,
      incrementMinor,
    });
    if (input.amountMinor < minAmount) {
      return {
        accepted: false,
        bid: null,
        auction: mapAuction(auction),
        error: { code: "BID_TOO_LOW", message: "BID_TOO_LOW: Bid amount is below the minimum." },
      };
    }

    // Accept: insert bid, update price/status, write outbox event, no audit row (immutable ledger decision).
    const bidRes = await client.query(
      `INSERT INTO bids (auction_id, bidder_user_id, amount_minor, currency, bid_type, request_id, accepted_at, created_at)
       VALUES ($1,$2,$3,'CAD','manual',$4, now(), now())
       RETURNING *`,
      [input.auctionId, bidderUserId, input.amountMinor, input.requestId]
    );
    const insertedBid = bidRes.rows[0];
    const bidPublic = mapBidPublic(insertedBid, bidderUserId);

    // Status changes go through the state machine; every transition writes an auction_events row.
    if (auction.status === "scheduled") {
      assertTransition("scheduled", "active");
      await client.query(
        `UPDATE auctions SET current_price_minor=$2, status='active', updated_at=now() WHERE id=$1`,
        [input.auctionId, input.amountMinor]
      );
      await client.query(
        `INSERT INTO auction_events (auction_id, from_status, to_status, actor_user_id)
         VALUES ($1, 'scheduled', 'active', $2)`,
        [input.auctionId, bidderUserId]
      );
    } else {
      await client.query(
        `UPDATE auctions SET current_price_minor=$2, updated_at=now() WHERE id=$1`,
        [input.auctionId, input.amountMinor]
      );
    }
    await client.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ('auction', $1, 'auction.bid.accepted', $2::jsonb, now())`,
      [input.auctionId, JSON.stringify({ auctionId: input.auctionId, bidId: insertedBid.id, bidderUserId, amountMinor: input.amountMinor, requestId: input.requestId })]
    );
    const updatedAuction = await client.query(`SELECT * FROM auctions WHERE id = $1`, [input.auctionId]);
    const result: BidResult = {
      accepted: true,
      bid: bidPublic,
      auction: mapAuction(updatedAuction.rows[0]),
      error: null,
    };
    if (opts?.beforeCommit) {
      await opts.beforeCommit();
    }
    return result;
  });
}

export async function setProxyBid(): Promise<never> {
  // TODO(docs/16 §3 #4): proxy bid tie-breaking decision OPEN; not implemented in Slice 4a.
  throw new Error("NOT_IMPLEMENTED_PENDING_DECISION: Proxy bidding is not implemented until the docs/16 §3 decision is approved.");
}
