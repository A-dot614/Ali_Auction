/**
 * Slice 4a: auctions, bids, proxy_bids, auction_events, outbox_events (reviewed migration).
 *
 * - One listing has at most one auction in the MVP auction format (docs/04 relationships).
 * - Auction status enum: scheduled, active, closed_sold, closed_unsold, cancelled.
 *   - "extended" is OPEN per docs/16 §3 #5 and is NOT created in Slice 4a (snipe protection disabled).
 * - Money: bigint minor units (CAD only); currency char(3) default 'CAD' with CHECK = 'CAD'.
 * - Auctions: listing_id unique FK listings, starting_price_minor > 0, reserve_price_minor nullable (unused in 4a, TODO docs/16 §3 #7), current_price_minor >= 0, starts_at/ends_at with CHECK (ends_at > starts_at), winning_bid_id nullable, closed_at nullable.
 * - Bids: manual only in Slice 4a (bid_type enum manual); amount_minor > 0; currency CAD; request_id uuid UNIQUE NOT NULL; accepted_at server time; indexes (auction_id, accepted_at DESC) and (auction_id, amount_minor DESC).
 * - proxy_bids: created but unused in Slice 4a; any proxy path throws NOT_IMPLEMENTED_PENDING_DECISION (TODO docs/16 §3 #4).
 * - auction_events: state transition history (from_status/to_status nullable for creation events).
 * - outbox_events: written in Slice 4a (transactional with accepted bid), published in Slice 4b.
 *
 * TODOs: docs/16 §3 #1 (auction format), §3 #2 (bid input semantics -> placeholder: next bid amount), §3 #3 (increments -> placeholder default 100 minor units), §3 #5 (snipe window disabled), §3 #7 (reserve disabled), §3 #9 (cancel after bids policy).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType("auction_status", ["scheduled", "active", "closed_sold", "closed_unsold", "cancelled"]);
  pgm.createType("bid_type", ["manual"]);

  pgm.createTable("auctions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    listing_id: { type: "uuid", notNull: true, unique: true, references: "listings" },
    status: { type: "auction_status", notNull: true, default: "scheduled" },
    currency: { type: "char(3)", notNull: true, default: "CAD" },
    starting_price_minor: { type: "bigint", notNull: true },
    reserve_price_minor: { type: "bigint" },
    current_price_minor: { type: "bigint", notNull: true, default: 0 },
    starts_at: { type: "timestamptz", notNull: true },
    ends_at: { type: "timestamptz", notNull: true },
    winning_bid_id: { type: "uuid" },
    closed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: {
      check: [
        "starting_price_minor > 0",
        "currency = 'CAD'",
        "current_price_minor >= 0",
        "ends_at > starts_at",
      ],
    },
  });

  pgm.createIndex("auctions", ["status", { name: "ends_at", sort: "DESC" }], { name: "auctions_status_ends_idx" });

  pgm.createTable("bids", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    auction_id: { type: "uuid", notNull: true, references: "auctions", onDelete: "cascade" },
    bidder_user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    amount_minor: { type: "bigint", notNull: true },
    currency: { type: "char(3)", notNull: true, default: "CAD" },
    bid_type: { type: "bid_type", notNull: true, default: "manual" },
    request_id: { type: "uuid", notNull: true, unique: true },
    accepted_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: {
      check: ["amount_minor > 0", "currency = 'CAD'"],
    },
  });

  pgm.createIndex("bids", ["auction_id", { name: "accepted_at", sort: "DESC" }], { name: "bids_auction_accepted_idx" });
  pgm.createIndex("bids", ["auction_id", { name: "amount_minor", sort: "DESC" }], { name: "bids_auction_amount_idx" });

  pgm.createTable("proxy_bids", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    auction_id: { type: "uuid", notNull: true, references: "auctions", onDelete: "cascade" },
    bidder_user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    max_amount_minor: { type: "bigint", notNull: true },
    is_active: { type: "boolean", notNull: true, default: true },
  });
  pgm.createIndex("proxy_bids", ["auction_id", "bidder_user_id"], { name: "proxy_bids_auction_bidder_uq", unique: true });

  pgm.createTable("auction_events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    auction_id: { type: "uuid", notNull: true, references: "auctions", onDelete: "cascade" },
    from_status: { type: "text" },
    to_status: { type: "text", notNull: true },
    actor_user_id: { type: "uuid", references: "users", onDelete: "set null" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("outbox_events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    aggregate_type: { type: "text", notNull: true },
    aggregate_id: { type: "text", notNull: true },
    event_type: { type: "text", notNull: true },
    payload: { type: "jsonb", notNull: true, default: "{}" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    published_at: { type: "timestamptz" },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("outbox_events");
  pgm.dropTable("auction_events");
  pgm.dropIndex("proxy_bids", ["auction_id", "bidder_user_id"], { name: "proxy_bids_auction_bidder_uq", unique: true });
  pgm.dropTable("proxy_bids");
  pgm.dropIndex("bids", ["auction_id", { name: "amount_minor", sort: "DESC" }], { name: "bids_auction_amount_idx" });
  pgm.dropIndex("bids", ["auction_id", { name: "accepted_at", sort: "DESC" }], { name: "bids_auction_accepted_idx" });
  pgm.dropTable("bids");
  pgm.dropIndex("auctions", ["status", { name: "ends_at", sort: "DESC" }], { name: "auctions_status_ends_idx" });
  pgm.dropTable("auctions");
  pgm.dropType("bid_type");
  pgm.dropType("auction_status");
};
