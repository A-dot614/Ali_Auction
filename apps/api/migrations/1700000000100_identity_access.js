/**
 * Identity & access baseline (Phase 1, Step 3).
 *
 * Draft-informed by docs/05-postgresql-starter-schema.sql.md but intentionally
 * reviewed/minimal for auth slice. Further entities (profiles, seller_profiles,
 * listings, auctions, payments, etc.) require separate reviewed migrations.
 *
 * Open decisions referenced (do not invent): verification/identity policies,
 * retention periods, MFA enforcement details - see docs/16-assumptions-decisions-and-open-questions.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createType("account_status", [
    "pending_verification",
    "active",
    "suspended",
    "closed",
  ]);

  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    email: { type: "text", notNull: true },
    password_hash: { type: "text", notNull: true },
    status: { type: "account_status", notNull: true, default: "pending_verification" },
    email_verified_at: { type: "timestamptz" },
    mfa_enabled: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.sql('CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));');

  pgm.createTable("roles", {
    id: { type: "serial", primaryKey: true },
    name: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.sql("INSERT INTO roles (name) VALUES ('buyer'), ('seller'), ('admin');");

  pgm.createTable("user_roles", {
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "cascade",
    },
    role_id: {
      type: "integer",
      notNull: true,
      references: "roles",
      onDelete: "cascade",
    },
    granted_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("user_roles", "user_roles_pkey", {
    primaryKey: ["user_id", "role_id"],
  });

  pgm.createTable("sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "cascade",
    },
    token_hash: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    revoked_at: { type: "timestamptz" },
    rotated_from_session_id: { type: "uuid", references: "sessions", onDelete: "set null" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    last_seen_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    ip_address: { type: "text" },
    user_agent: { type: "text" },
  });
  pgm.createIndex("sessions", ["user_id", "expires_at"]);

  pgm.createTable("email_verification_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "cascade",
    },
    token_hash: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    used_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("email_verification_tokens", ["user_id", "expires_at"]);

  pgm.createTable("password_reset_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "cascade",
    },
    token_hash: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    used_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("password_reset_tokens", ["user_id", "expires_at"]);

  pgm.createTable("audit_logs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    actor_user_id: { type: "uuid", references: "users", onDelete: "set null" },
    action: { type: "text", notNull: true },
    target_type: { type: "text", notNull: true },
    target_id: { type: "uuid" },
    reason: { type: "text" },
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("audit_logs", ["target_type", "target_id", { name: "created_at", sort: "DESC" }], {
    name: "audit_logs_target_idx",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("audit_logs");
  pgm.dropTable("password_reset_tokens");
  pgm.dropTable("email_verification_tokens");
  pgm.dropTable("sessions");
  pgm.dropTable("user_roles");
  pgm.dropTable("roles");
  pgm.dropTable("users");
  pgm.dropType("account_status");
};
