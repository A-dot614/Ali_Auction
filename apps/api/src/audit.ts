import type pg from "pg";
import { query } from "./db.js";

export type AuditInput = {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(
  input: AuditInput,
  client?: pg.PoolClient | { query: typeof query }
): Promise<void> {
  const runner: any = client || { query };
  await runner.query(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.actorUserId || null,
      input.action,
      input.targetType,
      input.targetId || null,
      input.reason || null,
      JSON.stringify(input.metadata || {}),
    ]
  );
}
