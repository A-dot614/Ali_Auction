/**
 * Slice 12 (workstream 9): order disputes, staff assignment and resolution.
 *
 * Reason codes, the evidence window and resolution outcomes are NOT FOR PRODUCTION
 * placeholders. TODO(docs/16 §8 #4): approved dispute-resolution policy and evidence window.
 * TODO(docs/16 §5 #8): provider-level chargebacks/refunds and negative balances remain OPEN.
 * No evidence file uploads or object storage in this migration (TODO docs/13, docs/16 §8 #4).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // NOT FOR PRODUCTION placeholder codes. TODO(docs/16 §8 #4).
  pgm.createType("dispute_reason_code", [
    "item_not_as_described",
    "item_not_received",
    "damaged",
    "other",
  ]);
  pgm.createType("dispute_status", ["open", "resolved", "closed"]);
  // NOT FOR PRODUCTION placeholder outcomes. TODO(docs/16 §8 #4, §5 #8).
  pgm.createType("dispute_outcome", ["no_action", "refund_full", "refund_partial", "order_cancelled"]);
  pgm.createType("dispute_message_role", ["buyer", "seller", "staff"]);

  pgm.createTable("disputes", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders", onDelete: "cascade" },
    opened_by_user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    reason_code: { type: "dispute_reason_code", notNull: true },
    description: { type: "text", notNull: true },
    status: { type: "dispute_status", notNull: true, default: "open" },
    assigned_to_user_id: { type: "uuid", references: "users", onDelete: "set null" },
    outcome: { type: "dispute_outcome" },
    resolution_reason: { type: "text" },
    resolved_by_user_id: { type: "uuid", references: "users", onDelete: "set null" },
    resolved_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: {
      check: ["length(description) > 0", "length(description) <= 2000"],
    },
  });

  // D1: at most one OPEN dispute per order (partial unique index, atomic with insert).
  pgm.createIndex("disputes", ["order_id"], {
    name: "disputes_open_per_order_uq",
    unique: true,
    where: "status = 'open'",
  });
  // D6: staff queue ordered by created_at, id.
  pgm.createIndex("disputes", ["status", "created_at", "id"], { name: "disputes_queue_idx" });

  pgm.createTable("dispute_messages", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    dispute_id: { type: "uuid", notNull: true, references: "disputes", onDelete: "cascade" },
    author_user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    author_role: { type: "dispute_message_role", notNull: true },
    internal_only: { type: "boolean", notNull: true, default: false },
    body: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { check: ["length(body) > 0"] },
  });

  // D1: idempotent openDispute requests, unique per requester.
  pgm.createTable("dispute_requests", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    requester_user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    request_id: { type: "uuid", notNull: true },
    dispute_id: { type: "uuid", references: "disputes", onDelete: "set null" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { unique: ["requester_user_id", "request_id"] },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("dispute_requests");
  pgm.dropTable("dispute_messages");
  pgm.dropIndex("disputes", ["status", "created_at", "id"], { name: "disputes_queue_idx" });
  pgm.dropIndex("disputes", ["order_id"], { name: "disputes_open_per_order_uq" });
  pgm.dropTable("disputes");
  pgm.dropType("dispute_message_role");
  pgm.dropType("dispute_outcome");
  pgm.dropType("dispute_status");
  pgm.dropType("dispute_reason_code");
};
