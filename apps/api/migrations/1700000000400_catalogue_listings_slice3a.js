/**
 * Slice 3a: categories, listings, listing_media (reviewed migration).
 * - Categories seeded as PLACEHOLDER - NOT APPROVED (docs/16 §8 #1 open).
 * - No auctions/bids/scheduling enforcement (Slice 4). requested_* times are draft intent only, non-binding.
 * - No media files stored; listing_media is metadata only (storage provider TODO docs/13, docs/16).
 * - TODO(docs/16 §8): max media count limit open (not enforced).
 * - TODO(docs/16 §8): title/description length limits are placeholder policy values.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType("listing_condition", ["new", "like_new", "used", "for_parts", "unspecified"]);
  pgm.createType("listing_fulfilment_option", ["shipping", "local_pickup", "both"]);
  pgm.createType("listing_status", ["draft", "pending_review", "published", "rejected", "paused", "removed"]);
  pgm.createType("listing_media_type", ["image"]);

  pgm.createTable("categories", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    parent_id: { type: "uuid", references: "categories", onDelete: "set null" },
    name: { type: "text", notNull: true },
    slug: { type: "text", notNull: true, unique: true },
    is_active: { type: "boolean", notNull: true, default: true },
    sort_order: { type: "integer", notNull: true, default: 0 },
    is_placeholder: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("listings", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    seller_profile_id: {
      type: "uuid",
      notNull: true,
      references: "seller_profiles",
      onDelete: "cascade",
    },
    category_id: { type: "uuid", notNull: true, references: "categories" },
    title: { type: "text", notNull: true },
    // Global slug uniqueness chosen for public URL stability/simplicity (documented in status/docs).
    slug: { type: "text", notNull: true, unique: true },
    description: { type: "text", notNull: true },
    condition: { type: "listing_condition", notNull: true },
    fulfilment_option: { type: "listing_fulfilment_option", notNull: true },
    currency: { type: "char(3)", notNull: true, default: "CAD" },
    starting_price_minor: { type: "bigint", notNull: true },
    // Draft intent only, non-binding until Slice 4 validates/schedules auctions. TODO(docs/16 §3 #1,#2).
    requested_starts_at: { type: "timestamptz" },
    requested_ends_at: { type: "timestamptz" },
    status: { type: "listing_status", notNull: true, default: "draft" },
    rejection_reason: { type: "text" },
    published_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("listings", "listings_starting_price_positive", {
    check: "starting_price_minor > 0",
  });
  pgm.addConstraint("listings", "listings_requested_times_order", {
    check:
      "(requested_starts_at IS NULL OR requested_ends_at IS NULL OR requested_ends_at > requested_starts_at)",
  });

  pgm.createIndex("listings", ["category_id", "status", { name: "published_at", sort: "DESC" }], {
    name: "listings_category_status_published_idx",
  });
  pgm.createIndex("listings", ["seller_profile_id", "status", { name: "created_at", sort: "DESC" }], {
    name: "listings_seller_status_created_idx",
  });

  pgm.createTable("listing_media", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    listing_id: { type: "uuid", notNull: true, references: "listings", onDelete: "cascade" },
    // Placeholder key only; no files stored. TODO(docs/13, docs/16): storage provider, upload flow, access control.
    storage_key: { type: "text", notNull: true },
    media_type: { type: "listing_media_type", notNull: true, default: "image" },
    alt_text: { type: "text" },
    sort_order: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("listing_media", ["listing_id", "sort_order"], { name: "listing_media_listing_sort_idx" });

  // Placeholder seeded categories (NOT APPROVED). TODO(docs/16 §8 #1): replace with approved taxonomy.
  pgm.sql(`
    INSERT INTO categories (name, slug, is_active, sort_order, is_placeholder) VALUES
      ('PLACEHOLDER - NOT APPROVED: General', 'placeholder-general', true, 10, true),
      ('PLACEHOLDER - NOT APPROVED: Collectibles', 'placeholder-collectibles', true, 20, true),
      ('PLACEHOLDER - NOT APPROVED: Electronics', 'placeholder-electronics', true, 30, true),
      ('PLACEHOLDER - NOT APPROVED: Home & Garden', 'placeholder-home-garden', true, 40, true),
      ('PLACEHOLDER - NOT APPROVED: Vehicles & Parts', 'placeholder-vehicles-parts', true, 50, true)
    ON CONFLICT (slug) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.dropIndex("listing_media", ["listing_id", "sort_order"], { name: "listing_media_listing_sort_idx" });
  pgm.dropTable("listing_media");
  pgm.dropIndex("listings", ["seller_profile_id", "status", { name: "created_at", sort: "DESC" }], {
    name: "listings_seller_status_created_idx",
  });
  pgm.dropIndex("listings", ["category_id", "status", { name: "published_at", sort: "DESC" }], {
    name: "listings_category_status_published_idx",
  });
  pgm.dropTable("listings");
  pgm.dropTable("categories");
  pgm.dropType("listing_media_type");
  pgm.dropType("listing_status");
  pgm.dropType("listing_fulfilment_option");
  pgm.dropType("listing_condition");
};
