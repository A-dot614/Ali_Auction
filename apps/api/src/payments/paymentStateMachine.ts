/**
 * Payment state machine (Slice 6, fake/sandbox provider only).
 * Proposed placeholder states (docs/16 §5 OPEN).
 */

export type PaymentStatus = "created" | "captured" | "failed" | "refunded_partial" | "refunded";

export const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  "created",
  "captured",
  "failed",
  "refunded_partial",
  "refunded",
];

export class InvalidPaymentTransitionError extends Error {
  code = "INVALID_PAYMENT_TRANSITION" as const;
  constructor(from: PaymentStatus, to: PaymentStatus) {
    super(`INVALID_PAYMENT_TRANSITION: Cannot transition payment from ${from} to ${to}.`);
    this.name = "InvalidPaymentTransitionError";
  }
}

const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  created: ["captured", "failed"],
  captured: ["refunded_partial", "refunded"],
  failed: [],
  refunded_partial: ["refunded"],
  refunded: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) throw new InvalidPaymentTransitionError(from, to);
}

export function getAllowedTransitions(from: PaymentStatus): PaymentStatus[] {
  return [...ALLOWED[from]];
}
