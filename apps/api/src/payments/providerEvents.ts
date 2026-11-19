import { config } from "../config.js";

/**
 * Provider-neutral records for refunds, failed payments and provider disputes
 * (decision-independent structure for FR-044). No fee, payout, tax or accounting
 * rule is hard-coded: the treatment is a required configuration input with no
 * default. Provider event reconciliation remains blocked by decision-log FR-044.
 */

export type ProviderEventKind =
  | "refund_recorded"
  | "payment_failed_recorded"
  | "dispute_opened"
  | "dispute_closed";

export type ProviderEventState =
  | "observed"
  | "refunded"
  | "failed"
  | "dispute_opened"
  | "dispute_closed";

export type ProviderEvent = {
  eventId: string;
  kind: ProviderEventKind;
  paymentId: string;
  amountMinor?: number;
  reason?: string;
  at: Date;
};

export type ProviderEventRecord = ProviderEvent & {
  state: ProviderEventState;
  outcome: "recorded" | "duplicate";
};

const STATE_FOR_KIND: Record<ProviderEventKind, ProviderEventState> = {
  refund_recorded: "refunded",
  payment_failed_recorded: "failed",
  dispute_opened: "dispute_opened",
  dispute_closed: "dispute_closed",
};

const ALLOWED: Record<ProviderEventState, ProviderEventState[]> = {
  observed: ["refunded", "failed", "dispute_opened", "dispute_closed"],
  refunded: ["dispute_opened", "dispute_closed"],
  failed: ["dispute_opened", "dispute_closed"],
  dispute_opened: ["dispute_closed"],
  dispute_closed: [],
};

export function stateForEventKind(kind: ProviderEventKind): ProviderEventState {
  return STATE_FOR_KIND[kind];
}

export function canApplyEvent(from: ProviderEventState, kind: ProviderEventKind): boolean {
  return (ALLOWED[from] ?? []).includes(STATE_FOR_KIND[kind]);
}

/** Decision-dependent accounting treatment: no default value exists. */
export function requireChargebackTreatment(): string {
  const treatment = config.payments.chargebackTreatment.trim();
  if (!treatment) {
    throw new Error("NOT_CONFIGURED: PAYMENTS_CHARGEBACK_TREATMENT has no default; a finance decision is required.");
  }
  return treatment;
}

/** In-memory, process-local record store; no persistence and no money movement. */
export class InMemoryProviderEventStore {
  private readonly records = new Map<string, ProviderEventRecord>();
  private readonly states = new Map<string, ProviderEventState>();

  record(event: ProviderEvent): ProviderEventRecord {
    const prior = this.records.get(event.eventId);
    if (prior) return { ...prior, outcome: "duplicate" };
    const to = STATE_FOR_KIND[event.kind];
    const from = this.states.get(event.paymentId) ?? "observed";
    if (!canApplyEvent(from, event.kind)) {
      throw new Error(`INVALID_PROVIDER_EVENT: Cannot apply ${event.kind} after ${from}.`);
    }
    const record: ProviderEventRecord = { ...event, state: to, outcome: "recorded" };
    this.records.set(event.eventId, record);
    this.states.set(event.paymentId, to);
    return record;
  }

  stateOf(paymentId: string): ProviderEventState | null {
    return this.states.get(paymentId) ?? null;
  }

  list(): ProviderEventRecord[] {
    return [...this.records.values()];
  }
}
