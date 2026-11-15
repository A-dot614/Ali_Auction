/**
 * Slice 2: Seller profile and verification (reviewed migration).
 * - seller_profiles: one per user (separate from account status)
 * - seller_verifications: state-machine records with reviewer/audit-relevant fields
 * - No identity documents stored; document_storage_key is a nullable placeholder only.
 * TODO(docs/16 §7 #1,#2): verification thresholds, required documents, review SLAs, and
 * storage provider/policy are OPEN decisions.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType("seller_profile_type", ["individual", "business", "institutional"]);
  pgm.createType("seller_verification_status", [
    "not_submitted",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "more_info_requested",
  ]);

  pgm.createTable("seller_profiles", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "uuid",
      notNull: true,
      unique: true,
      references: "users",
      onDelete: "cascade",
    },
    seller_type: { type: "seller_profile_type", notNull: true },
    display_name: { type: "text", notNull: true },
    public_store_name: { type: "text" },
    legal_name: { type: "text" }, // restricted; never exposed publicly
    province_code: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("seller_verifications", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    seller_profile_id: {
      type: "uuid",
      notNull: true,
      references: "seller_profiles",
      onDelete: "cascade",
    },
    status: {
      type: "seller_verification_status",
      notNull: true,
      default: "not_submitted",
    },
    submitted_at: { type: "timestamptz" },
    reviewed_at: { type: "timestamptz" },
    reviewed_by: { type: "uuid", references: "users", onDelete: "set null" },
    decision_reason: { type: "text" },
    // Placeholder only - NO identity documents stored in this slice.
    // TODO(docs/16 §7 #1,#2): define required docs, storage provider, encryption, access controls, retention.
    document_storage_key: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("seller_verifications", ["seller_profile_id", { name: "created_at", sort: "DESC" }], {
    name: "seller_verifications_profile_created_idx",
  });

  // Add staff roles for verification review (docs/09 baseline roles).
  pgm.sql(`INSERT INTO roles (name) VALUES ('moderator'), ('support') ON CONFLICT (name) DO NOTHING;`);
};

exports.down = (pgm) => {
  pgm.dropIndex("seller_verifications", ["seller_profile_id", { name: "created_at", sort: "DESC" }], {
    name: "seller_verifications_profile_created_idx",
  });
  pgm.dropTable("seller_verifications");
  pgm.dropTable("seller_profiles");
  pgm.dropType("seller_verification_status");
  pgm.dropType("seller_profile_type");
  // Do not remove seeded roles on down (may be referenced); safe no-op.
};
