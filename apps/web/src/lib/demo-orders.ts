/**
 * In-memory demo orders and provider-neutral payment event records. Event kinds
 * mirror the API's fake-adapter records; no fee, payout or refund rule is implied.
 */

export type DemoEventKind =
  | "refund_recorded"
  | "payment_failed_recorded"
  | "dispute_opened"
  | "dispute_closed";

export type DemoPaymentEvent = {
  id: string;
  kind: DemoEventKind;
  atIso: string;
  note: string;
};

export type DemoOrder = {
  id: string;
  listingTitle: string;
  status: string;
  totalMinor: number;
  currency: "CAD";
  events: DemoPaymentEvent[];
};

export const DEMO_ORDERS: DemoOrder[] = [
  {
    id: "demo-order-1",
    listingTitle: "Vintage desk lamp",
    status: "awaiting fulfilment (demo state)",
    totalMinor: 4100,
    currency: "CAD",
    events: [
      { id: "demo-event-0", kind: "payment_failed_recorded", atIso: "2026-11-15T10:00:00.000Z", note: "Demo failed payment recorded; no charge attempted." },
      { id: "demo-event-1", kind: "dispute_opened", atIso: "2026-11-18T10:00:00.000Z", note: "Demo dispute opened; no policy applied." },
      { id: "demo-event-2", kind: "dispute_closed", atIso: "2026-11-19T10:00:00.000Z", note: "Demo dispute closed; no outcome decided." },
      { id: "demo-event-5", kind: "refund_recorded", atIso: "2026-11-20T10:00:00.000Z", note: "Demo refund recorded; no money moved." },
    ],
  },
  {
    id: "demo-order-2",
    listingTitle: "Ceramic mug set",
    status: "demo failure state",
    totalMinor: 1200,
    currency: "CAD",
    events: [
      { id: "demo-event-3", kind: "payment_failed_recorded", atIso: "2026-11-17T09:00:00.000Z", note: "Demo failed payment recorded; no charge attempted." },
    ],
  },
  {
    id: "demo-order-3",
    listingTitle: "Commuter bicycle",
    status: "demo refunded state",
    totalMinor: 22500,
    currency: "CAD",
    events: [
      { id: "demo-event-4", kind: "refund_recorded", atIso: "2026-11-16T09:00:00.000Z", note: "Demo refund recorded; no money moved." },
    ],
  },
];

export function findDemoOrder(id: string): DemoOrder | undefined {
  return DEMO_ORDERS.find((order) => order.id === id);
}
