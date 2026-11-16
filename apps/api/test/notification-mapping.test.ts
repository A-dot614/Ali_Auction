import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { OutboxMessage } from "../src/outbox/publisher.js";
import {
  mapEventToNotifications,
  NOTIFICATION_CATEGORIES,
  TRANSACTIONAL_CATEGORIES,
  relativeLink,
  type RecipientRole,
} from "../src/notifications/templates.js";

function msg(eventType: string, payload: Record<string, any>): OutboxMessage {
  return {
    id: randomUUID(),
    aggregateType: "test",
    aggregateId: randomUUID(),
    eventType,
    payload,
    createdAt: new Date("2026-11-16T12:00:00.000Z"),
  };
}

const EXPECTED: Record<string, { recipients: RecipientRole[]; categories: string[] }> = {
  "auction.bid.accepted": { recipients: ["seller", "previous_high_bidder"], categories: ["auction_result", "auction_outbid"] },
  "auction.closed:sold": { recipients: ["winner", "seller"], categories: ["auction_result", "auction_result"] },
  "auction.closed:unsold": { recipients: ["seller"], categories: ["auction_result"] },
  "order.created": { recipients: ["buyer"], categories: ["order_update"] },
  "order.paid": { recipients: ["seller"], categories: ["payment_update"] },
  "order.shipped": { recipients: ["buyer"], categories: ["fulfilment_update"] },
  "order.ready_for_pickup": { recipients: ["buyer"], categories: ["fulfilment_update"] },
  "listing.rejected": { recipients: ["seller"], categories: ["listing_moderation"] },
  "listing.paused": { recipients: ["seller"], categories: ["listing_moderation"] },
  "listing.removed": { recipients: ["seller"], categories: ["listing_moderation"] },
  "account.suspended": { recipients: ["affected_user"], categories: ["account_status"] },
  "report.resolved:none": { recipients: ["reporter"], categories: ["report_result"] },
  "report.resolved:actioned": { recipients: ["reporter", "reported_party"], categories: ["report_result", "report_result"] },
};

function eventFor(key: string): OutboxMessage {
  switch (key) {
    case "auction.bid.accepted":
      return msg(key, { auctionId: randomUUID(), bidId: randomUUID(), bidderUserId: randomUUID(), amountMinor: 3000 });
    case "auction.closed:sold":
      return msg("auction.closed", { auctionId: randomUUID(), status: "closed_sold", winningBidId: randomUUID() });
    case "auction.closed:unsold":
      return msg("auction.closed", { auctionId: randomUUID(), status: "closed_unsold" });
    case "order.created":
      return msg(key, { orderId: randomUUID(), buyerUserId: randomUUID() });
    case "order.paid":
      return msg(key, { orderId: randomUUID() });
    case "order.shipped":
    case "order.ready_for_pickup":
      return msg(key, { orderId: randomUUID(), buyerUserId: randomUUID() });
    case "listing.rejected":
    case "listing.paused":
    case "listing.removed":
      return msg(key, { listingId: randomUUID(), sellerUserId: randomUUID() });
    case "account.suspended":
      return msg(key, { userId: randomUUID() });
    case "report.resolved:none":
      return msg("report.resolved", { reportId: randomUUID(), reporterUserId: randomUUID(), targetType: "listing", targetId: randomUUID(), decision: "dismissed", action: "none" });
    case "report.resolved:actioned":
      return msg("report.resolved", { reportId: randomUUID(), reporterUserId: randomUUID(), targetType: "listing", targetId: randomUUID(), decision: "actioned", action: "hide_listing" });
    default:
      throw new Error(`unknown key ${key}`);
  }
}

describe("notification category mapping (Slice 8)", () => {
  for (const [key, expected] of Object.entries(EXPECTED)) {
    it(`maps ${key} to the expected category and recipients`, () => {
      const specs = mapEventToNotifications(eventFor(key));
      expect(specs.map((s) => s.recipient).sort()).toEqual([...expected.recipients].sort());
      expect(specs.map((s) => s.category).sort()).toEqual([...expected.categories].sort());
    });
  }

  it("does not map any event to a recipient outside its specification", () => {
    const allowed = new Set(Object.values(EXPECTED).flatMap((e) => e.recipients));
    for (const key of Object.keys(EXPECTED)) {
      for (const spec of mapEventToNotifications(eventFor(key))) {
        expect(allowed.has(spec.recipient)).toBe(true);
      }
    }
  });

  it("ignores unknown or non-notification event types", () => {
    expect(mapEventToNotifications(msg("auction.created", {}))).toEqual([]);
    expect(mapEventToNotifications(msg("unknown.event", {}))).toEqual([]);
  });

  it("marks only marketing as opt-in; every other category is transactional", () => {
    expect([...TRANSACTIONAL_CATEGORIES].sort()).toEqual(NOTIFICATION_CATEGORIES.filter((c) => c !== "marketing").sort());
    expect(TRANSACTIONAL_CATEGORIES.has("marketing")).toBe(false);
  });

  it("emits relative authentication-required links only", () => {
    expect(relativeLink("auction", "abc")).toBe("/auctions/abc");
    expect(relativeLink("order", "xyz")).toBe("/orders/xyz");
    expect(relativeLink("account", "u")).toBe("/account");
    expect(relativeLink("unknown", "abc")).toBeNull();
    expect(relativeLink(null, null)).toBeNull();
  });
});

describe("template rendering is free of sensitive data (Slice 8)", () => {
  const SENTINELS = [
    "SENTINEL-REPORTER-ID",
    "SENTINEL-PROVIDER-ID",
    "999999",
    "SENTINEL-RAW-MODERATION-REASON",
    "SENTINEL-PRIVATE-DETAILS",
  ];

  function sensitiveEvent(key: string): OutboxMessage {
    const base = eventFor(key);
    return {
      ...base,
      payload: {
        ...(base.payload as Record<string, any>),
        reporterUserId: "SENTINEL-REPORTER-ID",
        providerPaymentId: "SENTINEL-PROVIDER-ID",
        amountMinor: 999999,
        resolutionReason: "SENTINEL-RAW-MODERATION-REASON",
        details: "SENTINEL-PRIVATE-DETAILS",
      },
    };
  }

  it("renders no reporter id, provider id, payment detail, or raw moderation reason", () => {
    for (const key of Object.keys(EXPECTED)) {
      for (const spec of mapEventToNotifications(sensitiveEvent(key))) {
        const rendered = `${spec.title}\n${spec.body}`;
        for (const sentinel of SENTINELS) {
          expect(rendered.includes(sentinel), `${key} rendered a forbidden value: ${sentinel}`).toBe(false);
        }
        expect(rendered).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      }
    }
  });

  it("source grep: templates never reference sensitive payload fields", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.resolve(here, "../src/notifications/templates.ts"), "utf8");
    for (const forbidden of ["providerPaymentId", "resolutionReason", "reporterUserId", "amountMinor", "p.details"]) {
      expect(src.includes(forbidden), `templates.ts must not reference ${forbidden}`).toBe(false);
    }
  });
});
