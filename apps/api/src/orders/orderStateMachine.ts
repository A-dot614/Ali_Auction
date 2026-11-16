/**
 * Order state machine (Slice 6). Single source of truth: no resolver/consumer writes status directly.
 * Statuses and transitions are proposed placeholders (docs/16 §4, §6 OPEN).
 */

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "ready_for_pickup",
  "completed",
  "cancelled",
];

export class InvalidOrderTransitionError extends Error {
  code = "INVALID_ORDER_TRANSITION" as const;
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`INVALID_ORDER_TRANSITION: Cannot transition order from ${from} to ${to}.`);
    this.name = "InvalidOrderTransitionError";
  }
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["paid", "cancelled"],
  paid: ["processing", "ready_for_pickup"],
  processing: ["shipped"],
  shipped: ["completed"],
  ready_for_pickup: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidOrderTransitionError(from, to);
}

export function getAllowedTransitions(from: OrderStatus): OrderStatus[] {
  return [...ALLOWED[from]];
}
