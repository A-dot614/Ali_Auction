import { query } from "../db.js";

export type OutboxMessage = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
};

export interface OutboxSink {
  deliver(message: OutboxMessage): Promise<void> | void;
}

export type PublishOptions = {
  now?: () => Date;
  batchSize?: number;
};

export type PublishResult = {
  published: number;
  failed: number;
};

/**
 * Slice 4b outbox publisher. Reads unpublished rows in created_at, id order, delivers each to a
 * sink, and marks it published only after the sink succeeds. A sink failure leaves that row
 * unpublished and stops the batch. All published_at values come from the injected clock.
 * TODO(workstream 11, docs/03 §5): real Socket.io/external delivery is not implemented in 4b.
 */
export async function publishOutbox(sink: OutboxSink, opts?: PublishOptions): Promise<PublishResult> {
  const now = opts?.now ?? (() => new Date());
  const at = now();
  const batchSize = Math.min(Math.max(opts?.batchSize ?? 100, 1), 100);
  const rows = await query(
    `SELECT id, aggregate_type, aggregate_id, event_type, payload, created_at
     FROM outbox_events WHERE published_at IS NULL
     ORDER BY created_at ASC, id ASC LIMIT $1`,
    [batchSize]
  );
  const result: PublishResult = { published: 0, failed: 0 };
  for (const row of rows.rows) {
    const message: OutboxMessage = {
      id: row.id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      payload: row.payload,
      createdAt: row.created_at,
    };
    try {
      await sink.deliver(message);
    } catch {
      // The failed row and every later row stay unpublished; a retry re-reads them.
      result.failed += 1;
      break;
    }
    await query(
      `UPDATE outbox_events SET published_at=$2 WHERE id=$1 AND published_at IS NULL`,
      [row.id, at]
    );
    result.published += 1;
  }
  return result;
}
