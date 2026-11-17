import type pg from "pg";
import { query, withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";

/**
 * D7 (Slice 10): request-only account deletion stub. No data is deleted,
 * anonymised, or revoked. Fulfilment/retention OPEN (docs/16 §7 #7).
 */

export type DeletionRequestResult = {
  requestId: string | null;
  created: boolean;
  reason: "created" | "duplicate" | "closed";
};

export type DeletionOptions = { clock?: () => Date };

export async function requestAccountDeletion(
  userId: string,
  reason?: string | null,
  opts?: DeletionOptions
): Promise<DeletionRequestResult> {
  const at = (opts?.clock ?? (() => new Date()))();
  // A closed account records nothing. Suspended accounts may still request.
  const user = await query(`SELECT status FROM users WHERE id=$1`, [userId]);
  if ((user.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: User not found.");
  if (user.rows[0].status === "closed") return { requestId: null, created: false, reason: "closed" };

  return withTransaction(async (client: pg.PoolClient) => {
    const inserted = await client.query(
      `INSERT INTO account_deletion_requests (user_id, status, reason, requested_at)
       VALUES ($1,'requested',$2,$3)
       ON CONFLICT (user_id) WHERE status = 'requested' DO NOTHING
       RETURNING id`,
      [userId, reason ?? null, at]
    );
    if (inserted.rowCount === 0) {
      const existing = await client.query(
        `SELECT id FROM account_deletion_requests WHERE user_id=$1 AND status='requested'`,
        [userId]
      );
      return { requestId: existing.rows[0].id as string, created: false, reason: "duplicate" as const };
    }
    const requestId = inserted.rows[0].id as string;
    await recordAudit(
      {
        actorUserId: userId,
        action: "account_deletion_requested",
        targetType: "user",
        targetId: userId,
        reason: reason ?? null,
        metadata: { requestId },
        createdAt: at,
      },
      client
    );
    return { requestId, created: true, reason: "created" as const };
  });
}
