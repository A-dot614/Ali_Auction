/**
 * Slice 7 (workstream 9): user reports, staff moderation queue, user suspension.
 *
 * Report categories are a NOT FOR PRODUCTION placeholder (TODO docs/16 §7 #5).
 * Moderation stays manual (docs/16 §8 #3). Appeal workflow (docs/16 §7 #6) and
 * suspension-while-bidding (docs/16 §3 #14) remain OPEN placeholders.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType("report_target_type", ["listing", "user"]);
  // NOT FOR PRODUCTION placeholder categories. TODO(docs/16 §7 #5): approved prohibited/restricted item policy.
  pgm.createType("report_category", [
    "prohibited_item",
    "counterfeit",
    "misleading_listing",
    "harassment",
    "spam",
    "other",
  ]);
  pgm.createType("report_status", ["open", "actioned", "dismissed"]);

  pgm.createTable("reports", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    reporter_user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    target_type: { type: "report_target_type", notNull: true },
    target_id: { type: "uuid", notNull: true },
    category: { type: "report_category", notNull: true },
    details: { type: "text" },
    status: { type: "report_status", notNull: true, default: "open" },
    resolved_by_user_id: { type: "uuid", references: "users", onDelete: "set null" },
    resolution_reason: { type: "text" },
    resolved_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: {
      check: ["details IS NULL OR length(details) <= 2000"],
    },
  });

  // D4: at most one OPEN report per (reporter, target).
  pgm.createIndex("reports", ["reporter_user_id", "target_type", "target_id"], {
    name: "reports_open_dedup_uq",
    unique: true,
    where: "status = 'open'",
  });
  // D5: staff queue ordered by created_at, id.
  pgm.createIndex("reports", ["status", "created_at", "id"], {
    name: "reports_queue_idx",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("reports", ["status", "created_at", "id"], { name: "reports_queue_idx" });
  pgm.dropIndex("reports", ["reporter_user_id", "target_type", "target_id"], {
    name: "reports_open_dedup_uq",
  });
  pgm.dropTable("reports");
  pgm.dropType("report_status");
  pgm.dropType("report_category");
  pgm.dropType("report_target_type");
};
