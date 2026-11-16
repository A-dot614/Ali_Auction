import { describe, expect, it } from "vitest";
import {
  ALL_ORDER_STATUSES,
  InvalidOrderTransitionError,
  assertTransition as assertOrder,
  canTransition as canOrder,
  getAllowedTransitions as orderAllowed,
} from "../src/orders/orderStateMachine.js";
import {
  ALL_PAYMENT_STATUSES,
  InvalidPaymentTransitionError,
  assertTransition as assertPayment,
  canTransition as canPayment,
  getAllowedTransitions as paymentAllowed,
} from "../src/payments/paymentStateMachine.js";

describe("order state machine (Slice 6)", () => {
  const allowed: Array<[string, string]> = [
    ["awaiting_payment", "paid"],
    ["awaiting_payment", "cancelled"],
    ["paid", "processing"],
    ["paid", "ready_for_pickup"],
    ["processing", "shipped"],
    ["shipped", "completed"],
    ["ready_for_pickup", "completed"],
  ];
  const asPair = ([f, t]: [string, string]) => [f, t] as [any, any];

  it("allows every allowed pair", () => {
    for (const pair of allowed.map(asPair)) {
      expect(canOrder(pair[0], pair[1])).toBe(true);
      expect(() => assertOrder(pair[0], pair[1])).not.toThrow();
    }
  });

  it("disallows every disallowed pair", () => {
    const set = new Set(allowed.map(([f, t]) => `${f}->${t}`));
    for (const from of ALL_ORDER_STATUSES) {
      for (const to of ALL_ORDER_STATUSES) {
        if (set.has(`${from}->${to}`)) continue;
        expect(canOrder(from, to)).toBe(false);
        expect(() => assertOrder(from, to)).toThrow(InvalidOrderTransitionError);
      }
    }
  });

  it("exposes allowed transitions per state", () => {
    expect(orderAllowed("awaiting_payment")).toEqual(["paid", "cancelled"]);
    expect(orderAllowed("paid")).toEqual(["processing", "ready_for_pickup"]);
    expect(orderAllowed("completed")).toEqual([]);
  });
});

describe("payment state machine (Slice 6)", () => {
  const allowed: Array<[string, string]> = [
    ["created", "captured"],
    ["created", "failed"],
    ["captured", "refunded_partial"],
    ["captured", "refunded"],
    ["refunded_partial", "refunded"],
  ];
  const asPair = ([f, t]: [string, string]) => [f, t] as [any, any];

  it("allows every allowed pair", () => {
    for (const pair of allowed.map(asPair)) {
      expect(canPayment(pair[0], pair[1])).toBe(true);
      expect(() => assertPayment(pair[0], pair[1])).not.toThrow();
    }
  });

  it("disallows every disallowed pair", () => {
    const set = new Set(allowed.map(([f, t]) => `${f}->${t}`));
    for (const from of ALL_PAYMENT_STATUSES) {
      for (const to of ALL_PAYMENT_STATUSES) {
        if (set.has(`${from}->${to}`)) continue;
        expect(canPayment(from, to)).toBe(false);
        expect(() => assertPayment(from, to)).toThrow(InvalidPaymentTransitionError);
      }
    }
  });

  it("exposes allowed transitions per state", () => {
    expect(paymentAllowed("created")).toEqual(["captured", "failed"]);
    expect(paymentAllowed("captured")).toEqual(["refunded_partial", "refunded"]);
    expect(paymentAllowed("refunded")).toEqual([]);
  });
});
