/**
 * Slice 1: profile support for identity/accounts.
 * Adds user_profiles for display name, bio, province (no email change here).
 * Reviewed minimal addition; further profile/verification fields require separate migrations.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("user_profiles", {
    user_id: {
      type: "uuid",
      primaryKey: true,
      references: "users",
      onDelete: "cascade",
    },
    display_name: { type: "text" },
    bio: { type: "text" },
    province_code: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("user_profiles");
};
