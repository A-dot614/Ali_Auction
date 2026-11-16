import type pg from "pg";
import { withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";
import { assertCanPerform } from "../reports/permissions.js";
import { assertTransition, type AccountStatus } from "./accountStateMachine.js";
import type { AppUser } from "../auth/service.js";

export type AccountOpOptions = { clock?: () => Date };
export type AccountOutcome = { userId: string; before: AccountStatus; after: AccountStatus };

function requireReason(reason: string | null | undefined): string {
  const trimmed = (reason || "").trim();
  if (!trimmed) throw new Error("VALIDATION_ERROR: Reason is required and must not be empty.");
  return trimmed;
}

/**
 * Apply suspension inside an existing transaction. Used by suspendUser and by
 * resolveReport(action=suspend_user) so the target action and the report
 * resolution commit together. Every status change goes through the account
 * state machine; sessions are revoked in the same transaction.
 */
export async function applySuspension(
  client: pg.PoolClient,
  userId: string,
  actor: AppUser,
  reason: string,
  at: Date
): Promise<AccountOutcome> {
  const res = await client.query(`SELECT status FROM users WHERE id = $1 FOR UPDATE`, [userId]);
  if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: User not found.");
  const before = res.rows[0].status as AccountStatus;
  // Throws INVALID_ACCOUNT_TRANSITION for already-suspended, pending or closed accounts (writes nothing).
  assertTransition(before, "suspended");
  await client.query(`UPDATE users SET status = 'suspended', updated_at = $2 WHERE id = $1`, [userId, at]);
  await client.query(
    `UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, at]
  );
  await recordAudit(
    {
      actorUserId: actor.id,
      action: "user.suspended",
      targetType: "user",
      targetId: userId,
      reason,
      metadata: { before, after: "suspended" },
      createdAt: at,
    },
    client
  );
  // Slice 8 (D2): neutral account-status notice via the outbox; no staff reason in the payload.
  await client.query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
     VALUES ('user', $1, 'account.suspended', $2::jsonb, $3)`,
    [userId, JSON.stringify({ userId }), at]
  );
  return { userId, before, after: "suspended" };
}

/** Reinstatement inside an existing transaction. Sessions are NOT restored. */
export async function applyReinstatement(
  client: pg.PoolClient,
  userId: string,
  actor: AppUser,
  reason: string,
  at: Date
): Promise<AccountOutcome> {
  const res = await client.query(`SELECT status FROM users WHERE id = $1 FOR UPDATE`, [userId]);
  if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: User not found.");
  const before = res.rows[0].status as AccountStatus;
  assertTransition(before, "active");
  await client.query(`UPDATE users SET status = 'active', updated_at = $2 WHERE id = $1`, [userId, at]);
  // sessions are intentionally left revoked; the user must log in again.
  await recordAudit(
    {
      actorUserId: actor.id,
      action: "user.reinstated",
      targetType: "user",
      targetId: userId,
      reason,
      metadata: { before, after: "active" },
      createdAt: at,
    },
    client
  );
  return { userId, before, after: "active" };
}

/** D8: active -> suspended, all sessions revoked in one transaction, one audit row. */
export async function suspendUser(
  userId: string,
  actor: AppUser,
  reason: string | null | undefined,
  opts?: AccountOpOptions
): Promise<AccountOutcome> {
  assertCanPerform(actor, "suspendUser");
  const trimmed = requireReason(reason);
  const clock = opts?.clock ?? (() => new Date());
  const at = clock();
  return withTransaction((client) => applySuspension(client, userId, actor, trimmed, at));
}

/** D9: suspended -> active, sessions not restored, one audit row. */
export async function reinstateUser(
  userId: string,
  actor: AppUser,
  reason: string | null | undefined,
  opts?: AccountOpOptions
): Promise<AccountOutcome> {
  assertCanPerform(actor, "reinstateUser");
  const trimmed = requireReason(reason);
  const clock = opts?.clock ?? (() => new Date());
  const at = clock();
  return withTransaction((client) => applyReinstatement(client, userId, actor, trimmed, at));
}
