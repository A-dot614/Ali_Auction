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

export type BidConnection = {
  items: BidPublic[];
  endCursor: string | null;
};

export type BidResult = {
  accepted: boolean;
  bid: BidPublic | null;
  auction: Auction | null;
  error: { code: string; message: string } | null;
};

// Slice 4b close outcome. Money stays integer minor units as a string to avoid float/Number overflow.
export type AuctionOutcome = {
  status: "closed_sold" | "closed_unsold";
  winningBidId: string | null;
  winningAmountMinor: string | null;
  winnerBidderLabel: string | null;
};

export type CloseResult = AuctionOutcome & {
  auctionId: string;
  // false for an idempotent replay of an already-closed auction (no rows written).
  changed: boolean;
};

export type OutcomeBidInput = {
  id: string;
  amountMinor: number | string;
  bidderUserId: string;
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

/**
 * D1 (Slice 4b, proposed placeholder; NOT FOR PRODUCTION, docs/16 §3 #4):
 * highest accepted amount wins. Because every accepted bid must exceed the current price by a
 * strictly positive increment, two accepted bids cannot tie on amount, so no proxy tie-break is
 * needed in 4b. Reserve is ignored (D3, TODO docs/16 §3 #7).
 */
export function determineAuctionOutcome(bids: OutcomeBidInput[]): AuctionOutcome {
  if (bids.length === 0) {
    return {
      status: "closed_unsold",
      winningBidId: null,
      winningAmountMinor: null,
      winnerBidderLabel: null,
    };
  }
  const amountOf = (b: OutcomeBidInput) => BigInt(typeof b.amountMinor === "string" ? b.amountMinor : String(b.amountMinor));
  let winner = bids[0];
  let max = amountOf(winner);
  for (const bid of bids.slice(1)) {
    const amount = amountOf(bid);
    if (amount > max) {
      max = amount;
      winner = bid;
    }
  }
  return {
    status: "closed_sold",
    winningBidId: winner.id,
    winningAmountMinor: max.toString(),
    // Public label only; the bidder user id never enters the outbox payload.
    winnerBidderLabel: bidderLabelFor(winner.bidderUserId),
  };
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

function bidCursor(bid: BidPublic): string {
  return `${new Date(bid.acceptedAt).toISOString()}|${bid.id}`;
}

function parseBidCursor(cursor: string): { acceptedAt: Date; id: string } {
  const sep = cursor.lastIndexOf("|");
  const timestamp = sep > 0 ? cursor.slice(0, sep) : "";
  const id = sep > 0 ? cursor.slice(sep + 1) : "";
  const acceptedAt = new Date(timestamp);
  if (!timestamp || !id || Number.isNaN(acceptedAt.getTime())) {
    throw new Error("VALIDATION_ERROR: Invalid bid cursor.");
  }
  return { acceptedAt, id };
}

export async function createAuction(
  actorUserId: string,
  input: CreateAuctionInput,
  opts?: { now?: () => Date }
): Promise<Auction> {
  const now = opts?.now ?? (() => new Date());
  // One clock read per operation; use it for every check and persisted timestamp.
  const at = now();
  const startsAt = input.startsAt;
  const endsAt = input.endsAt;
  if (!(startsAt > at)) {
    throw new Error("INVALID_SCHEDULE: Auction starts_at must be strictly after server now.");
  }
  if (!(endsAt > startsAt)) {
    throw new Error("VALIDATION_ERROR: Auction ends_at must be after starts_at.");
  }
  const startingPriceMinor = toMinOrThrow(input.startingPriceMinor);

  try {
    return await withTransaction(async (client) => {
      // Lock the listing so ownership/status and the one-auction-per-listing check cannot race.
      const listingRes = await client.query(`SELECT * FROM listings WHERE id = $1 FOR UPDATE`, [input.listingId]);
      if ((listingRes.rowCount ?? 0) === 0) {
        throw new Error("NOT_FOUND: Listing not found.");
      }
      const listing = listingRes.rows[0];
      if (listing.status !== "published") {
        throw new Error("LISTING_NOT_PUBLISHED: Only published listings can have an auction.");
      }
      const spRes = await client.query(`SELECT user_id FROM seller_profiles WHERE id = $1`, [listing.seller_profile_id]);
      const sellerUserId = (spRes.rows[0]?.user_id as string) ?? null;
      if (sellerUserId !== actorUserId) {
        throw new Error("NOT_FOUND: Auction not found for this listing.");
      }
      const existing = await client.query(`SELECT id FROM auctions WHERE listing_id = $1`, [input.listingId]);
      if ((existing.rowCount ?? 0) > 0) {
        throw new Error("AUCTION_ALREADY_EXISTS: Auction already exists for this listing.");
      }
      const res = await client.query(
        `INSERT INTO auctions (listing_id, status, currency, starting_price_minor, reserve_price_minor, current_price_minor, starts_at, ends_at, winning_bid_id, closed_at, created_at, updated_at)
         VALUES ($1, 'scheduled', 'CAD', $2, NULL, $2, $3, $4, NULL, NULL, $5, $5)
         RETURNING *`,
        [input.listingId, startingPriceMinor, startsAt, endsAt, at]
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
        `INSERT INTO auction_events (auction_id, from_status, to_status, actor_user_id, created_at) VALUES ($1, NULL, 'scheduled', $2, $3)`,
        [auction.id, actorUserId, at]
      );
      return auction;
    });
  } catch (err: any) {
    // Only the one-auction-per-listing constraint maps to AUCTION_ALREADY_EXISTS; any other
    // unique violation propagates unchanged. The explicit check above runs under the row lock;
    // this catch also covers the constraint race. No second caller-reachable unique constraint exists here.
    if (err?.code === "23505" && err.constraint === "auctions_listing_id_key") {
      throw new Error("AUCTION_ALREADY_EXISTS: Auction already exists for this listing.");
    }
    throw err;
  }
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

// Public users see accepted bid history but not proxy maximums (docs/16 §2).
export async function auctionBids(
  auctionId: string,
  opts: { first?: number | null; after?: string | null }
): Promise<BidConnection> {
  const limit = Math.min(Math.max(opts.first ?? 20, 1), 100);
  const publicAuction = await query(
    `SELECT a.id FROM auctions a JOIN listings l ON l.id = a.listing_id WHERE a.id = $1 AND l.status = 'published'`,
    [auctionId]
  );
  if ((publicAuction.rowCount ?? 0) === 0) {
    throw new Error("NOT_FOUND: Auction not found.");
  }

  const params: any[] = [auctionId];
  let cursorClause = "";
  if (opts.after) {
    const cursor = parseBidCursor(opts.after);
    params.push(cursor.acceptedAt, cursor.id);
    cursorClause = `AND (b.accepted_at, b.id) < ($2::timestamptz, $3::uuid)`;
  }
  params.push(limit);
  const res = await query(
    `SELECT b.* FROM bids b
     WHERE b.auction_id = $1 ${cursorClause}
     ORDER BY b.accepted_at DESC, b.id DESC
     LIMIT $${params.length}`,
    params
  );
  const items = res.rows.map((row) => mapBidPublic(row, row.bidder_user_id));
  return { items, endCursor: items.length > 0 ? bidCursor(items[items.length - 1]) : null };
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
    // Single clock read for the whole transaction (checks and persisted timestamps).
    const at = now();

    // Idempotency: same request_id returns the original bid and writes nothing new.
    const existingBid = await client.query(`SELECT * FROM bids WHERE request_id = $1`, [input.requestId]);
    if ((existingBid.rowCount ?? 0) > 0) {
      const existing = existingBid.rows[0];
      if (existing.auction_id !== input.auctionId || existing.bidder_user_id !== bidderUserId) {
        throw new Error("REQUEST_ID_CONFLICT: request_id was already used for a different bid.");
      }
      // Replay the auction snapshot captured immediately after the original bid (outbox payload).
      const snapshotRow = await client.query(
        `SELECT payload FROM outbox_events
         WHERE aggregate_type = 'auction' AND aggregate_id = $1
           AND event_type = 'auction.bid.accepted' AND payload->>'bidId' = $2
         ORDER BY created_at DESC LIMIT 1`,
        [input.auctionId, existing.id]
      );
      const snapshot = snapshotRow.rows[0]?.payload as
        | { currentPriceMinor?: number; statusAfter?: string; updatedAt?: string }
        | undefined;
      const replayedAuction = mapAuction(auction);
      if (snapshot?.currentPriceMinor != null) {
        replayedAuction.currentPriceMinor = String(snapshot.currentPriceMinor);
      }
      if (snapshot?.statusAfter) {
        replayedAuction.status = snapshot.statusAfter as AuctionStatus;
      }
      if (snapshot?.updatedAt) {
        replayedAuction.updatedAt = new Date(snapshot.updatedAt);
      }
      const bidPublic = mapBidPublic(existing, existing.bidder_user_id);
      return { accepted: true, bid: bidPublic, auction: replayedAuction, error: null };
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
      auction.starts_at <= at &&
      at < auction.ends_at;
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
       VALUES ($1,$2,$3,'CAD','manual',$4,$5,$5)
       RETURNING *`,
      [input.auctionId, bidderUserId, input.amountMinor, input.requestId, at]
    );
    const insertedBid = bidRes.rows[0];
    const bidPublic = mapBidPublic(insertedBid, bidderUserId);

    // Status changes go through the state machine; every transition writes an auction_events row.
    if (auction.status === "scheduled") {
      assertTransition("scheduled", "active");
      await client.query(
        `UPDATE auctions SET current_price_minor=$2, status='active', updated_at=$3 WHERE id=$1`,
        [input.auctionId, input.amountMinor, at]
      );
      await client.query(
        `INSERT INTO auction_events (auction_id, from_status, to_status, actor_user_id, created_at)
         VALUES ($1, 'scheduled', 'active', $2, $3)`,
        [input.auctionId, bidderUserId, at]
      );
    } else {
      await client.query(
        `UPDATE auctions SET current_price_minor=$2, updated_at=$3 WHERE id=$1`,
        [input.auctionId, input.amountMinor, at]
      );
    }
    const updatedAuction = await client.query(`SELECT * FROM auctions WHERE id = $1`, [input.auctionId]);
    const updatedRow = updatedAuction.rows[0];
    await client.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ('auction', $1, 'auction.bid.accepted', $2::jsonb, $3)`,
      [
        input.auctionId,
        JSON.stringify({
          auctionId: input.auctionId,
          bidId: insertedBid.id,
          bidderUserId,
          amountMinor: input.amountMinor,
          requestId: input.requestId,
          // Snapshot immediately after this bid, replayed verbatim for idempotent retries.
          currentPriceMinor: Number(updatedRow.current_price_minor),
          statusAfter: updatedRow.status,
          updatedAt: new Date(updatedRow.updated_at).toISOString(),
        }),
        at,
      ]
    );
    const result: BidResult = {
      accepted: true,
      bid: bidPublic,
      auction: mapAuction(updatedRow),
      error: null,
    };
    if (opts?.beforeCommit) {
      await opts.beforeCommit();
    }
    return result;
  });
}

export type CloseAuctionOptions = {
  now?: () => Date;
  // Test hooks, both invoked inside the close transaction.
  afterStatusUpdate?: (auctionId: string) => Promise<void> | void;
  beforeCommit?: (auctionId: string) => Promise<void> | void;
};

export type CloseDueResult = {
  closed: number;
  skipped: number; // selected but already closed (idempotent no-op)
  failed: number;
  errors: Array<{ auctionId: string; message: string }>;
};

async function existingCloseResult(client: any, auction: any, auctionId: string): Promise<CloseResult> {
  const outbox = await client.query(
    `SELECT payload FROM outbox_events
     WHERE aggregate_type='auction' AND aggregate_id=$1 AND event_type='auction.closed'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [auctionId]
  );
  const payload = outbox.rows[0]?.payload as
    | { status?: string; winningBidId?: string | null; winningAmountMinor?: string | null; winnerBidderLabel?: string | null }
    | undefined;
  if (payload) {
    return {
      auctionId,
      status: (payload.status ?? auction.status) as "closed_sold" | "closed_unsold",
      winningBidId: payload.winningBidId ?? null,
      winningAmountMinor: payload.winningAmountMinor ?? null,
      winnerBidderLabel: payload.winnerBidderLabel ?? null,
      changed: false,
    };
  }
  // Defensive fallback if the close event is missing: derive from the immutable bid ledger.
  const bidRes = await client.query(
    `SELECT id, amount_minor, bidder_user_id FROM bids WHERE auction_id=$1
     ORDER BY amount_minor DESC, accepted_at DESC, id DESC LIMIT 1`,
    [auctionId]
  );
  const top = bidRes.rows[0];
  return {
    auctionId,
    status: auction.status as "closed_sold" | "closed_unsold",
    winningBidId: top?.id ?? null,
    winningAmountMinor: top ? String(top.amount_minor) : null,
    winnerBidderLabel: top ? bidderLabelFor(top.bidder_user_id) : null,
    changed: false,
  };
}

/**
 * Server-authoritative close (Slice 4b). All writes and the row lock live in one transaction;
 * every timestamp is bound to the injected clock, never SQL now().
 */
export async function closeAuction(auctionId: string, opts?: CloseAuctionOptions): Promise<CloseResult> {
  const now = opts?.now ?? (() => new Date());
  return withTransaction(async (client) => {
    const auctionRes = await client.query(`SELECT * FROM auctions WHERE id=$1 FOR UPDATE`, [auctionId]);
    if ((auctionRes.rowCount ?? 0) === 0) {
      throw new Error("NOT_FOUND: Auction not found.");
    }
    const auction = auctionRes.rows[0];
    const at = now();

    // Idempotent no-op: an already-closed auction returns its existing outcome and writes nothing.
    if (auction.status === "closed_sold" || auction.status === "closed_unsold") {
      return existingCloseResult(client, auction, auctionId);
    }
    if (!(at >= auction.ends_at)) {
      throw new Error("AUCTION_NOT_DUE: Auction has not reached ends_at.");
    }

    const bidsRes = await client.query(
      `SELECT id, amount_minor, bidder_user_id FROM bids WHERE auction_id=$1
       ORDER BY amount_minor DESC, accepted_at DESC, id DESC`,
      [auctionId]
    );
    const outcome = determineAuctionOutcome(
      bidsRes.rows.map((row: any) => ({
        id: row.id,
        amountMinor: String(row.amount_minor),
        bidderUserId: row.bidder_user_id,
      }))
    );

    // Every status change goes through the state machine (D2: scheduled -> closed_unsold allowed).
    assertTransition(auction.status, outcome.status);
    await client.query(
      `UPDATE auctions SET status=$2, winning_bid_id=$3, closed_at=$4, updated_at=$4 WHERE id=$1`,
      [auctionId, outcome.status, outcome.winningBidId, at]
    );
    if (opts?.afterStatusUpdate) await opts.afterStatusUpdate(auctionId);

    await client.query(
      `INSERT INTO auction_events (auction_id, from_status, to_status, actor_user_id, created_at)
       VALUES ($1, $2, $3, NULL, $4)`,
      [auctionId, auction.status, outcome.status, at]
    );
    // D7: system action uses a NULL actor; before/after statuses live in metadata.
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, reason, metadata, created_at)
       VALUES (NULL, 'auction.closed', 'auction', $1, 'system_close', $2::jsonb, $3)`,
      [auctionId, JSON.stringify({ beforeStatus: auction.status, afterStatus: outcome.status }), at]
    );
    // D4: one auction.closed event; Slice 6 will consume it to create the order.
    await client.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ('auction', $1, 'auction.closed', $2::jsonb, $3)`,
      [
        auctionId,
        JSON.stringify({
          auctionId,
          status: outcome.status,
          winningBidId: outcome.winningBidId,
          winningAmountMinor: outcome.winningAmountMinor,
          winnerBidderLabel: outcome.winnerBidderLabel,
        }),
        at,
      ]
    );
    if (opts?.beforeCommit) await opts.beforeCommit(auctionId);
    return { auctionId, ...outcome, changed: true };
  });
}

/**
 * D5: close all due auctions, each in its own transaction. Scheduling (cron/worker) is a
 * deployment decision (TODO docs/16 §10 / docs/13); this is a callable job function only.
 */
export async function closeDueAuctions(opts?: CloseAuctionOptions): Promise<CloseDueResult> {
  const now = opts?.now ?? (() => new Date());
  const at = now();
  const due = await query(
    `SELECT id FROM auctions WHERE ends_at <= $1 AND status IN ('scheduled', 'active') ORDER BY ends_at, id`,
    [at]
  );
  const result: CloseDueResult = { closed: 0, skipped: 0, failed: 0, errors: [] };
  for (const row of due.rows) {
    const auctionId = row.id as string;
    try {
      const outcome = await closeAuction(auctionId, {
        now: () => at,
        afterStatusUpdate: opts?.afterStatusUpdate ? (id) => opts.afterStatusUpdate!(id) : undefined,
        beforeCommit: opts?.beforeCommit ? (id) => opts.beforeCommit!(id) : undefined,
      });
      if (outcome.changed) result.closed += 1;
      else result.skipped += 1;
    } catch (err: any) {
      result.failed += 1;
      result.errors.push({ auctionId, message: err?.message ?? String(err) });
    }
  }
  return result;
}

export async function setProxyBid(): Promise<never> {
  // TODO(docs/16 §3 #4): proxy bid tie-breaking decision OPEN; not implemented in Slice 4a.
  throw new Error("NOT_IMPLEMENTED_PENDING_DECISION: Proxy bidding is not implemented until the docs/16 §3 decision is approved.");
}
