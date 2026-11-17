/**
 * Slice 10 (D7): account deletion REQUEST stub. Records intent only; nothing is
 * deleted or anonymised. Retention/fulfilment OPEN (docs/16 §7 #7).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("account_deletion_requests", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    status: { type: "text", notNull: true, default: "requested" },
    reason: { type: "text" },
    requested_at: { type: "timestamptz", notNull: true },
  });
  pgm.createIndex("account_deletion_requests", ["user_id"], {
    name: "account_deletion_requests_open_uq",
    unique: true,
    where: "status = 'requested'",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("account_deletion_requests", ["user_id"], { name: "account_deletion_requests_open_uq" });
  pgm.dropTable("account_deletion_requests");
};
