import type pg from "pg";
import { query, withTransaction } from "../db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateToken, hashToken } from "./tokens.js";
import { recordAudit } from "../audit.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../email/index.js";
import { config } from "../config.js";

export type AppUser = {
  id: string;
  email: string;
  status: "pending_verification" | "active" | "suspended" | "closed";
  email_verified_at: Date | null;
  roles: string[];
};

const SESSION_TTL_MS = config.session.ttlDays * 24 * 60 * 60 * 1000;
const ROTATE_AFTER_MS = config.session.rotateAfterMinutes * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

async function getUserRoles(userId: string, client?: pg.PoolClient): Promise<string[]> {
  const runner: any = client || { query };
  const res = await runner.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.name`,
    [userId]
  );
  return res.rows.map((r: any) => r.name);
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const res = await query(
    `SELECT id, email, status, email_verified_at FROM users WHERE id = $1`,
    [id]
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const u = res.rows[0];
  const roles = await getUserRoles(u.id);
  return { ...u, roles };
}

export async function register(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ userId: string; verificationToken: string }> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new Error("VALIDATION_ERROR: Invalid email.");
  const pwErr = validatePasswordPolicy(input.password);
  if (pwErr) throw new Error(`VALIDATION_ERROR: ${pwErr}`);

  const passwordHash = await hashPassword(input.password);
  const verificationToken = generateToken(32);
  const tokenHash = hashToken(verificationToken);

  const userId = await withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [email]);
    if ((existing.rowCount ?? 0) > 0) {
      throw new Error("VALIDATION_ERROR: Unable to register with provided details.");
    }
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, status)
       VALUES ($1, $2, 'pending_verification') RETURNING id`,
      [email, passwordHash]
    );
    const uid = userRes.rows[0].id as string;
    const roleRes = await client.query(`SELECT id FROM roles WHERE name IN ('buyer','seller')`);
    for (const row of roleRes.rows) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [uid, row.id]);
    }
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)`,
      [uid, tokenHash, String(VERIFY_TTL_MS)]
    );
    await recordAudit(
      {
        actorUserId: uid,
        action: "user.registered",
        targetType: "user",
        targetId: uid,
        metadata: { ip: input.ip || null },
      },
      client
    );
    return uid;
  });

  await sendVerificationEmail(email, verificationToken);
  return { userId, verificationToken };
}

export async function verifyEmail(input: {
  token: string;
  ip?: string | null;
}): Promise<{ userId: string }> {
  const tokenHash = hashToken(input.token);
  return withTransaction(async (client) => {
    const res = await client.query(
      `SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at, u.email_verified_at
       FROM email_verification_tokens evt
       JOIN users u ON u.id = evt.user_id
       WHERE evt.token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );
    if ((res.rowCount ?? 0) === 0) throw new Error("VALIDATION_ERROR: Invalid or expired verification token.");
    const row = res.rows[0];
    if (row.used_at || row.email_verified_at) {
      return { userId: row.user_id };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("VALIDATION_ERROR: Invalid or expired verification token.");
    }
    await client.query(`UPDATE email_verification_tokens SET used_at = now() WHERE id = $1`, [row.id]);
    await client.query(
      `UPDATE users SET email_verified_at = now(), status = CASE WHEN status='pending_verification' THEN 'active'::account_status ELSE status END, updated_at = now()
       WHERE id = $1`,
      [row.user_id]
    );
    await recordAudit(
      {
        actorUserId: row.user_id,
        action: "user.email_verified",
        targetType: "user",
        targetId: row.user_id,
        metadata: { ip: input.ip || null },
      },
      client
    );
    return { userId: row.user_id };
  });
}

async function createSession(
  client: pg.PoolClient,
  userId: string,
  opts: { ip?: string | null; userAgent?: string | null; rotatedFrom?: string | null }
): Promise<{ sessionId: string; sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateToken(32);
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const res = await client.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, rotated_from_session_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, tokenHash, expiresAt, opts.rotatedFrom || null, opts.ip || null, opts.userAgent || null]
  );
  return { sessionId: res.rows[0].id as string, sessionToken, expiresAt };
}

export async function login(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ sessionToken: string; expiresAt: Date; user: AppUser }> {
  const email = normalizeEmail(input.email);
  const res = await query(
    `SELECT id, email, password_hash, status, email_verified_at FROM users WHERE lower(email)=lower($1)`,
    [email]
  );
  // Avoid account enumeration: same error path.
  const invalid = () => new Error("UNAUTHENTICATED: Invalid email or password.");
  if ((res.rowCount ?? 0) === 0) throw invalid();
  const row = res.rows[0];
  const ok = await verifyPassword(input.password, row.password_hash);
  if (!ok) {
    await recordAudit({
      actorUserId: row.id,
      action: "user.login_failed",
      targetType: "user",
      targetId: row.id,
      metadata: { ip: input.ip || null },
    }).catch(() => {});
    throw invalid();
  }
  if (row.status === "suspended" || row.status === "closed") {
    throw new Error("FORBIDDEN: Account is not active.");
  }
  // TODO(docs/16 #3 buyer verification / policies): require verified email for protected functions per product decision.
  // For MVP baseline we allow login but keep status/verification separate (FR-005) and expose state to callers.

  const session = await withTransaction(async (client) => {
    const s = await createSession(client, row.id, { ip: input.ip, userAgent: input.userAgent });
    await recordAudit(
      {
        actorUserId: row.id,
        action: "user.login",
        targetType: "user",
        targetId: row.id,
        metadata: { ip: input.ip || null },
      },
      client
    );
    return s;
  });
  const roles = await getUserRoles(row.id);
  return {
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
    user: {
      id: row.id,
      email: row.email,
      status: row.status,
      email_verified_at: row.email_verified_at,
      roles,
    },
  };
}

export async function authenticateSession(
  token: string
): Promise<{ user: AppUser; sessionId: string; rotatedToken?: string; rotatedExpiresAt?: Date } | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const res = await query(
    `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, s.created_at, s.last_seen_at,
            u.email, u.status, u.email_verified_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [tokenHash]
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const row = res.rows[0];
  if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  // Slice 7 (D8): keep suspended accounts authenticated so requireVerified can return
  // the stable ACCOUNT_SUSPENDED code on protected mutations. Suspension revokes all
  // sessions in the same transaction, so this path is reachable only via a still-valid
  // session (e.g. a state change outside the suspension mutation).
  if (row.status === "closed") return null;

  const roles = await getUserRoles(row.user_id);
  const user: AppUser = {
    id: row.user_id,
    email: row.email,
    status: row.status,
    email_verified_at: row.email_verified_at,
    roles,
  };

  // Rotation: if session older than threshold, rotate token.
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > ROTATE_AFTER_MS) {
    const rotated = await withTransaction(async (client) => {
      await client.query(`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [row.id]);
      const s = await createSession(client, row.user_id, { rotatedFrom: row.id });
      return s;
    });
    return {
      user,
      sessionId: rotated.sessionId,
      rotatedToken: rotated.sessionToken,
      rotatedExpiresAt: rotated.expiresAt,
    };
  }

  await query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [row.id]).catch(() => {});
  return { user, sessionId: row.id };
}

export async function revokeAllUserSessions(
  userId: string,
  opts?: { actorUserId?: string | null; reason?: string; action?: string }
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    await recordAudit(
      {
        actorUserId: opts?.actorUserId || userId,
        action: opts?.action || "user.sessions_revoked",
        targetType: "user",
        targetId: userId,
        reason: opts?.reason || null,
        metadata: { scope: "all" },
      },
      client
    );
  });
}

export async function suspendUser(userId: string, actorUserId?: string | null, reason?: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET status = 'suspended', updated_at = now() WHERE id = $1`,
      [userId]
    );
    await client.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    await recordAudit(
      {
        actorUserId: actorUserId || null,
        action: "user.suspended",
        targetType: "user",
        targetId: userId,
        reason: reason || null,
      },
      client
    );
  });
}

export async function logout(token: string | null | undefined, actorUserId?: string | null): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  const res = await query(
    `UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL RETURNING user_id, id`,
    [tokenHash]
  );
  if ((res.rowCount ?? 0) > 0) {
    await recordAudit({
      actorUserId: actorUserId || res.rows[0].user_id,
      action: "user.logout",
      targetType: "session",
      targetId: res.rows[0].id,
    }).catch(() => {});
  }
}

export async function requestPasswordReset(input: {
  email: string;
  ip?: string | null;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const res = await query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [email]);
  // Always succeed to avoid enumeration.
  if ((res.rowCount ?? 0) === 0) return;
  const userId = res.rows[0].id as string;
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)`,
      [userId, tokenHash, String(RESET_TTL_MS)]
    );
    await recordAudit(
      {
        actorUserId: userId,
        action: "user.password_reset_requested",
        targetType: "user",
        targetId: userId,
        metadata: { ip: input.ip || null },
      },
      client
    );
  });
  await sendPasswordResetEmail(email, token);
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
  ip?: string | null;
}): Promise<void> {
  const pwErr = validatePasswordPolicy(input.newPassword);
  if (pwErr) throw new Error(`VALIDATION_ERROR: ${pwErr}`);
  const tokenHash = hashToken(input.token);
  const passwordHash = await hashPassword(input.newPassword);
  await withTransaction(async (client) => {
    const res = await client.query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens
       WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );
    if ((res.rowCount ?? 0) === 0) throw new Error("VALIDATION_ERROR: Invalid or expired reset token.");
    const row = res.rows[0];
    if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("VALIDATION_ERROR: Invalid or expired reset token.");
    }
    await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [row.id]);
    await client.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
      passwordHash,
      row.user_id,
    ]);
    // Revoke all sessions on password reset.
    await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
      row.user_id,
    ]);
    await recordAudit(
      {
        actorUserId: row.user_id,
        action: "user.password_reset",
        targetType: "user",
        targetId: row.user_id,
        metadata: { ip: input.ip || null },
      },
      client
    );
  });
}

export async function resendVerification(input: { email: string; ip?: string | null }): Promise<void> {
  const email = normalizeEmail(input.email);
  const res = await query(
    `SELECT id, email_verified_at FROM users WHERE lower(email)=lower($1)`,
    [email]
  );
  // Enumeration-safe: always succeed.
  if ((res.rowCount ?? 0) === 0) return;
  const row = res.rows[0];
  if (row.email_verified_at) return;
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)`,
      [row.id, tokenHash, String(VERIFY_TTL_MS)]
    );
    await recordAudit(
      {
        actorUserId: row.id,
        action: "user.verification_resent",
        targetType: "user",
        targetId: row.id,
        metadata: { ip: input.ip || null },
      },
      client
    );
  });
  await sendVerificationEmail(email, token);
}

export type UserProfile = {
  userId: string;
  displayName: string | null;
  bio: string | null;
  provinceCode: string | null;
};

export async function getMyProfile(userId: string): Promise<UserProfile> {
  const res = await query(
    `SELECT user_id, display_name, bio, province_code FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  if ((res.rowCount ?? 0) === 0) {
    return { userId, displayName: null, bio: null, provinceCode: null };
  }
  const r = res.rows[0];
  return {
    userId: r.user_id,
    displayName: r.display_name,
    bio: r.bio,
    provinceCode: r.province_code,
  };
}

export async function updateMyProfile(input: {
  userId: string;
  displayName?: string | null;
  bio?: string | null;
  provinceCode?: string | null;
}): Promise<UserProfile> {
  // No email change without re-verification (email not accepted/updated here).
  const displayName = input.displayName?.trim() ?? null;
  const bio = input.bio?.trim() ?? null;
  const provinceCode = input.provinceCode?.trim().toUpperCase() || null;
  const res = await query(
    `INSERT INTO user_profiles (user_id, display_name, bio, province_code, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       bio = EXCLUDED.bio,
       province_code = EXCLUDED.province_code,
       updated_at = now()
     RETURNING user_id, display_name, bio, province_code`,
    [input.userId, displayName, bio, provinceCode]
  );
  await recordAudit({
    actorUserId: input.userId,
    action: "user.profile_updated",
    targetType: "user_profile",
    targetId: input.userId,
  }).catch(() => {});
  const r = res.rows[0];
  return {
    userId: r.user_id,
    displayName: r.display_name,
    bio: r.bio,
    provinceCode: r.province_code,
  };
}

export type SessionView = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

export async function listMySessions(userId: string, currentSessionId?: string | null): Promise<SessionView[]> {
  const res = await query(
    `SELECT id, created_at, last_seen_at, expires_at, revoked_at, ip_address, user_agent
     FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    isCurrent: currentSessionId ? r.id === currentSessionId : false,
  }));
}

export async function revokeMySession(input: {
  userId: string;
  sessionId: string;
  actorUserId: string;
}): Promise<void> {
  const res = await query(
    `UPDATE sessions SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [input.sessionId, input.userId]
  );
  if ((res.rowCount ?? 0) === 0) {
    throw new Error("NOT_FOUND: Session not found.");
  }
  await recordAudit({
    actorUserId: input.actorUserId,
    action: "user.session_revoked",
    targetType: "session",
    targetId: input.sessionId,
  });
}

// For tests/admin bootstrap - guarded use only.
export async function grantRole(userId: string, roleName: "buyer" | "seller" | "admin", actorUserId?: string) {
  await withTransaction(async (client) => {
    const role = await client.query(`SELECT id FROM roles WHERE name=$1`, [roleName]);
    if ((role.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: role");
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, role.rows[0].id]
    );
    await recordAudit(
      {
        actorUserId: actorUserId || null,
        action: "user.role_change",
        targetType: "user",
        targetId: userId,
        metadata: { role: roleName },
      },
      client
    );
  });
}
