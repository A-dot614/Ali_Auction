import { query } from "../db.js";
import { config } from "../config.js";
import { relativeLink, type NotificationCategory } from "./templates.js";
import type { NotificationSink } from "./sinks.js";

/**
 * D4-D7 (Slice 8): delivery worker and authenticated notification reads.
 * All timestamps come from the injected clock; delivery errors are stored only
 * as fixed categories, never raw error text.
 */

export type ServiceOptions = { now?: () => Date; batchSize?: number; maxAttempts?: number };
export type DeliveryResult = { sent: number; failed: number };

export type NotificationRow = {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  sourceEventId: string;
  createdAt: Date;
  readAt: Date | null;
};

function mapNotification(row: any): NotificationRow {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    body: row.body,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    sourceEventId: row.source_event_id,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

function errorCategory(err: unknown): string {
  // Fixed allowlist: never persist raw error text from a sink.
  const code = String((err as any)?.code ?? "");
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT") return "sink_unavailable";
  return "sink_error";
}

/** D4: deliver pending/failed deliveries up to the attempts cap. */
export async function deliverPending(sinks: NotificationSink[], opts?: ServiceOptions): Promise<DeliveryResult> {
  const at = (opts?.now ?? (() => new Date()))();
  const maxAttempts = Math.min(Math.max(opts?.maxAttempts ?? config.notifications.maxDeliveryAttempts, 1), 100);
  const batchSize = Math.min(Math.max(opts?.batchSize ?? config.notifications.batchSize, 1), 100);
  const rows = await query(
    `SELECT d.id, d.channel, d.attempts,
            n.user_id, n.category, n.title, n.body, n.resource_type, n.resource_id, u.email
     FROM notification_deliveries d
     JOIN notifications n ON n.id = d.notification_id
     JOIN users u ON u.id = n.user_id
     WHERE d.status IN ('pending','failed') AND d.attempts < $1
     ORDER BY d.created_at ASC, d.id ASC LIMIT $2`,
    [maxAttempts, batchSize]
  );
  const result: DeliveryResult = { sent: 0, failed: 0 };
  for (const row of rows.rows) {
    const sink = sinks.find((s) => s.channel === row.channel);
    if (!sink) {
      await query(
        `UPDATE notification_deliveries SET attempts = attempts + 1, status = 'failed',
          last_error_category = 'no_sink', updated_at = $2 WHERE id = $1`,
        [row.id, at]
      );
      result.failed += 1;
      continue;
    }
    try {
      await sink.deliver({
        notificationId: row.id,
        recipientEmail: row.email,
        category: row.category,
        title: row.title,
        body: row.body,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
      });
      await query(
        `UPDATE notification_deliveries SET status='sent', sent_at=$2, updated_at=$2 WHERE id=$1`,
        [row.id, at]
      );
      result.sent += 1;
    } catch (err) {
      await query(
        `UPDATE notification_deliveries SET attempts=$2, status='failed',
          last_error_category=$3, updated_at=$4 WHERE id=$1`,
        [row.id, Number(row.attempts) + 1, errorCategory(err), at]
      );
      result.failed += 1;
    }
  }
  return result;
}

export function parseNotificationCursor(cursor: string): { createdAt: Date; id: string } {
  const sep = cursor.lastIndexOf("|");
  const ts = sep > 0 ? cursor.slice(0, sep) : "";
  const id = sep > 0 ? cursor.slice(sep + 1) : "";
  const createdAt = new Date(ts);
  if (!ts || !id || Number.isNaN(createdAt.getTime())) {
    throw new Error("VALIDATION_ERROR: Invalid notification cursor.");
  }
  return { createdAt, id };
}

/** D7: authenticated, cursor-paginated read of the caller's notifications only. */
export async function myNotifications(
  userId: string,
  opts: { first?: number | null; after?: string | null; unreadOnly?: boolean | null } = {}
): Promise<{ items: NotificationRow[]; endCursor: string | null }> {
  const limit = Math.min(Math.max(opts.first || 20, 1), 100);
  const params: any[] = [userId];
  let where = `WHERE user_id = $1`;
  if (opts.unreadOnly) where += ` AND read_at IS NULL`;
  if (opts.after) {
    const c = parseNotificationCursor(opts.after);
    params.push(c.createdAt, c.id);
    where += ` AND (created_at < $${params.length - 1} OR (created_at = $${params.length - 1} AND id < $${params.length}))`;
  }
  params.push(limit);
  const res = await query(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
    params
  );
  const items = res.rows.map(mapNotification);
  const endCursor = items.length ? `${items[items.length - 1].createdAt.toISOString()}|${items[items.length - 1].id}` : null;
  return { items, endCursor };
}

/** D7: unread count for the authenticated caller only. */
export async function unreadCount(userId: string): Promise<number> {
  const res = await query(`SELECT count(*)::int AS c FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [userId]);
  return res.rows[0].c;
}

/** D6: idempotent read marking, owner only; other users get NOT_FOUND. */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
  opts?: ServiceOptions
): Promise<NotificationRow> {
  const at = (opts?.now ?? (() => new Date()))();
  const existing = await query(`SELECT * FROM notifications WHERE id=$1 AND user_id=$2`, [notificationId, userId]);
  if ((existing.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Notification not found.");
  if (!existing.rows[0].read_at) {
    await query(
      `UPDATE notifications SET read_at=$2 WHERE id=$1 AND user_id=$3 AND read_at IS NULL`,
      [notificationId, at, userId]
    );
  }
  const updated = await query(`SELECT * FROM notifications WHERE id=$1`, [notificationId]);
  return mapNotification(updated.rows[0]);
}

/** D5: relative link for the authenticated owner only (no unauthenticated link exists). */
export function linkFor(n: NotificationRow): string | null {
  return relativeLink(n.resourceType, n.resourceId);
}
