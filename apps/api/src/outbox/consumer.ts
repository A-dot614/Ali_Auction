import type pg from "pg";
import { query, withTransaction } from "../db.js";
import type { OutboxMessage } from "./publisher.js";

/**
 * D1 (Slice 8): generic, idempotent outbox consumer framework.
 * Reads rows not yet processed by this consumer in created_at, id order. The
 * processed_events marker and the handler's writes commit in the same transaction.
 * A handler failure leaves the row unprocessed and stops the batch. Replays are no-ops.
 * Reuses the processed_events table introduced in Slice 6.
 */

export type OutboxConsumerOptions = { now?: () => Date; batchSize?: number };
export type ConsumerResult = { processed: number; skipped: number };
export type EventHandler = (message: OutboxMessage, client: pg.PoolClient, at: Date) => Promise<void>;

export async function consumeOutbox(
  consumerName: string,
  handler: EventHandler,
  opts?: OutboxConsumerOptions
): Promise<ConsumerResult> {
  const at = (opts?.now ?? (() => new Date()))();
  const batchSize = Math.min(Math.max(opts?.batchSize ?? 100, 1), 100);
  const rows = await query(
    `SELECT e.id, e.aggregate_type, e.aggregate_id, e.event_type, e.payload, e.created_at
     FROM outbox_events e
     LEFT JOIN processed_events p ON p.consumer = $1 AND p.event_id = e.id
     WHERE p.id IS NULL
     ORDER BY e.created_at ASC, e.id ASC LIMIT $2`,
    [consumerName, batchSize]
  );
  const result: ConsumerResult = { processed: 0, skipped: 0 };
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
      await withTransaction(async (client) => {
        const recorded = await client.query(
          `INSERT INTO processed_events (consumer, event_id, processed_at)
           VALUES ($1, $2, $3) ON CONFLICT (consumer, event_id) DO NOTHING`,
          [consumerName, message.id, at]
        );
        if ((recorded.rowCount ?? 0) === 0) {
          result.skipped += 1;
          return;
        }
        await handler(message, client, at);
      });
      result.processed += 1;
    } catch {
      // Rolled back with the processed_events insert: the row remains available for retry.
      // Later rows in this batch are left for a subsequent run.
      break;
    }
  }
  return result;
}
