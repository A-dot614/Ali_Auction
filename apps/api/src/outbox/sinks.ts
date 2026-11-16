import type { OutboxMessage, OutboxSink } from "./publisher.js";

/**
 * In-memory sink for tests. Records delivered messages in order and can be configured to fail
 * on a given delivered index (0-based) to exercise publisher retry semantics.
 */
export class InMemoryOutboxSink implements OutboxSink {
  readonly delivered: OutboxMessage[] = [];
  private readonly failAtIndex: number | null;

  constructor(failAtIndex: number | null = null) {
    this.failAtIndex = failAtIndex;
  }

  async deliver(message: OutboxMessage): Promise<void> {
    if (this.failAtIndex !== null && this.delivered.length === this.failAtIndex) {
      throw new Error(`InMemoryOutboxSink forced failure at index ${this.failAtIndex}.`);
    }
    this.delivered.push(message);
  }
}

/** Dev-only console sink; no external broker or Socket.io in Slice 4b. */
export const consoleSink: OutboxSink = {
  deliver(message: OutboxMessage): void {
    console.log(`[outbox] ${message.eventType} ${message.aggregateType}:${message.aggregateId}`);
  },
};
