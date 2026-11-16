/**
 * Slice 6 (workstreams 7 & 8): orders, fee snapshots, sandbox payments, manual fulfilment.
 *
 * All money is integer minor units, CAD only. Feature flag FEATURE_REAL_MONEY_PAYMENTS_ENABLED
 * defaults OFF and is asserted OFF at production startup. Only the fake provider is implemented.
 * Fees (8% buyer fee), capture timing, shipping and refunds are OPEN decisions (docs/16 §4, §5, §6);
 * values here are NOT FOR PRODUCTION placeholders with TODOs in code/docs.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType("order_status", ["awaiting_payment", "paid", "processing", "shipped", "ready_for_pickup", "completed", "cancelled"]);
  pgm.createType("payment_status", ["created", "captured", "failed", "refunded_partial", "refunded"]);
  pgm.createType("shipment_method", ["shipping", "local_pickup"]);

  pgm.createTable("fee_rules", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    fee_code: { type: "text", notNull: true, unique: true },
    description: { type: "text" },
    rate_bps: { type: "integer", notNull: true },
    effective_from: { type: "timestamptz", notNull: true },
    effective_to: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { check: ["rate_bps >= 0", "rate_bps <= 10000"] },
  });

  pgm.createTable("orders", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    auction_id: { type: "uuid", notNull: true, unique: true, references: "auctions" },
    listing_id: { type: "uuid", notNull: true, references: "listings" },
    buyer_user_id: { type: "uuid", notNull: true, references: "users" },
    seller_profile_id: { type: "uuid", notNull: true, references: "seller_profiles" },
    status: { type: "order_status", notNull: true, default: "awaiting_payment" },
    currency: { type: "char(3)", notNull: true, default: "CAD" },
    hammer_price_minor: { type: "bigint", notNull: true },
    fee_total_minor: { type: "bigint", notNull: true, default: 0 },
    total_minor: { type: "bigint", notNull: true },
    shipping_address_snapshot: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: {
      check: ["currency = 'CAD'", "hammer_price_minor > 0", "fee_total_minor >= 0", "total_minor > 0"],
    },
  });

  pgm.createIndex("orders", ["buyer_user_id", { name: "created_at", sort: "DESC" }], { name: "orders_buyer_created_idx" });
  pgm.createIndex("orders", ["seller_profile_id", { name: "created_at", sort: "DESC" }], { name: "orders_seller_created_idx" });

  pgm.createTable("order_fee_lines", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders", onDelete: "cascade" },
    fee_code: { type: "text", notNull: true },
    description: { type: "text" },
    amount_minor: { type: "bigint", notNull: true },
    currency: { type: "char(3)", notNull: true, default: "CAD" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { check: ["amount_minor >= 0", "currency = 'CAD'"] },
  });

  pgm.createTable("order_events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders", onDelete: "cascade" },
    from_status: { type: "text" },
    to_status: { type: "text", notNull: true },
    actor_user_id: { type: "uuid", references: "users", onDelete: "set null" },
    reason: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("processed_events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    consumer: { type: "text", notNull: true },
    event_id: { type: "uuid", notNull: true },
    processed_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { unique: ["consumer", "event_id"] },
  });

  pgm.createTable("payment_transactions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders" },
    provider: { type: "text", notNull: true },
    provider_payment_id: { type: "text" },
    idempotency_key: { type: "text", notNull: true, unique: true },
    status: { type: "payment_status", notNull: true, default: "created" },
    amount_minor: { type: "bigint", notNull: true },
    currency: { type: "char(3)", notNull: true, default: "CAD" },
    captured_amount_minor: { type: "bigint", notNull: true, default: 0 },
    refunded_amount_minor: { type: "bigint", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: {
      check: [
        "amount_minor > 0",
        "currency = 'CAD'",
        "captured_amount_minor >= 0",
        "refunded_amount_minor >= 0",
      ],
    },
  });
  // Partial unique index: a provider payment id, when present, is unique per provider.
  pgm.createIndex("payment_transactions", ["provider", "provider_payment_id"], {
    name: "payment_transactions_provider_payment_uq",
    unique: true,
    where: "provider_payment_id IS NOT NULL",
  });

  pgm.createTable("webhook_events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    provider: { type: "text", notNull: true },
    provider_event_id: { type: "text", notNull: true },
    event_type: { type: "text", notNull: true },
    payload: { type: "jsonb", notNull: true, default: "{}" },
    received_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    processed_at: { type: "timestamptz" },
  }, {
    constraints: { unique: ["provider", "provider_event_id"] },
  });

  pgm.createTable("refunds", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    payment_transaction_id: { type: "uuid", notNull: true, references: "payment_transactions" },
    amount_minor: { type: "bigint", notNull: true },
    currency: { type: "char(3)", notNull: true, default: "CAD" },
    reason: { type: "text", notNull: true },
    created_by_user_id: { type: "uuid", notNull: true, references: "users" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { check: ["amount_minor > 0", "currency = 'CAD'"] },
  });

  pgm.createTable("shipments", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders" },
    method: { type: "shipment_method", notNull: true },
    carrier: { type: "text" },
    tracking_number: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  // NOT FOR PRODUCTION placeholder fee rule (docs/16 §4 #1-#4 OPEN).
  pgm.sql(`
    INSERT INTO fee_rules (fee_code, description, rate_bps, effective_from)
    VALUES ('buyer_fee_placeholder',
            'Source plan value: 8% buyer fee placeholder - NOT APPROVED (docs/16 §4)',
            800, '1970-01-01T00:00:00Z')
    ON CONFLICT (fee_code) DO NOTHING
  `);
};

exports.down = (pgm) => {
  pgm.dropTable("shipments");
  pgm.dropTable("refunds");
  pgm.dropTable("webhook_events");
  pgm.dropIndex("payment_transactions", ["provider", "provider_payment_id"], {
    name: "payment_transactions_provider_payment_uq",
  });
  pgm.dropTable("payment_transactions");
  pgm.dropTable("processed_events");
  pgm.dropTable("order_events");
  pgm.dropTable("order_fee_lines");
  pgm.dropIndex("orders", ["seller_profile_id", { name: "created_at", sort: "DESC" }], { name: "orders_seller_created_idx" });
  pgm.dropIndex("orders", ["buyer_user_id", { name: "created_at", sort: "DESC" }], { name: "orders_buyer_created_idx" });
  pgm.dropTable("orders");
  pgm.dropTable("fee_rules");
  pgm.dropType("shipment_method");
  pgm.dropType("payment_status");
  pgm.dropType("order_status");
};
