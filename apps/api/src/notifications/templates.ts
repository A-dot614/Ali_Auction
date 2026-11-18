import { createHash } from "node:crypto";
import type { OutboxMessage } from "../outbox/publisher.js";

/**
 * Notification templates and event mapping (Slice 8).
 * Categories, copy and recipients are NOT FOR PRODUCTION placeholders pending copy review
 * (docs/16 §7 #3, §8 #6). Templates are neutral: no reporter identity, no internal IDs
 * beyond the recipient's own resource, no provider IDs, no payment details, no staff
 * moderation reasons. No real provider is involved (docs/11 §6).
 */

export const NOTIFICATION_CATEGORIES = [
  "verification",
  "password_reset",
  "auction_outbid",
  "auction_result",
  "order_update",
  "payment_update",
  "fulfilment_update",
  "listing_moderation",
  "account_status",
  "report_result",
  "marketing",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

// D3: transactional categories are always delivered and cannot be disabled.
// Placeholder list pending docs/16 §7 #3 review.
export const TRANSACTIONAL_CATEGORIES: ReadonlySet<NotificationCategory> = new Set(
  NOTIFICATION_CATEGORIES.filter((c) => c !== "marketing")
);

export const NOTIFICATION_CHANNELS = ["in_app", "email_console"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type RecipientRole =
  | "seller"
  | "previous_high_bidder"
  | "winner"
  | "buyer"
  | "affected_user"
  | "reporter"
  | "reported_party";

export type NotificationSpec = {
  recipient: RecipientRole;
  category: NotificationCategory;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
};

// Mirrors the auction module's opaque bidder label; never exposes a raw user id.
function opaqueLabel(userId: string): string {
  return `bidder-${createHash("sha256").update(userId).digest("hex").slice(0, 16)}`;
}

type Payload = Record<string, any>;

/**
 * D2 mapping: every supported event to its category, recipients and neutral copy.
 * Recipient *roles* are resolved to user ids by the consumer; no raw id is rendered here.
 */
export function mapEventToNotifications(message: OutboxMessage): NotificationSpec[] {
  const p: Payload = (message.payload && typeof message.payload === "object" ? message.payload : {}) as Payload;
  const eventType = message.eventType;
  const auctionId = String(p.auctionId ?? message.aggregateId ?? "");
  const orderId = String(p.orderId ?? message.aggregateId ?? "");
  const listingId = String(p.listingId ?? message.aggregateId ?? "");
  const reportId = String(p.reportId ?? message.aggregateId ?? "");
  const userId = String(p.userId ?? message.aggregateId ?? "");

  switch (eventType) {
    case "auction.bid.accepted": {
      const bidder = String(p.bidderUserId ?? "");
      const label = bidder ? opaqueLabel(bidder) : "another bidder";
      return [
        {
          recipient: "seller",
          category: "auction_result",
          title: "New bid on your auction",
          body: `A new bid was placed on your auction by ${label}.`,
          resourceType: "auction",
          resourceId: auctionId,
        },
        {
          recipient: "previous_high_bidder",
          category: "auction_outbid",
          title: "You were outbid",
          body: `You were outbid on an auction by ${label}.`,
          resourceType: "auction",
          resourceId: auctionId,
        },
      ];
    }
    case "auction.closed": {
      if (p.status === "closed_sold") {
        return [
          {
            recipient: "winner",
            category: "auction_result",
            title: "You won an auction",
            body: "You won an auction. Check your orders for details.",
            resourceType: "auction",
            resourceId: auctionId,
          },
          {
            recipient: "seller",
            category: "auction_result",
            title: "Your auction closed",
            body: "Your auction closed with a winning bid.",
            resourceType: "auction",
            resourceId: auctionId,
          },
        ];
      }
      if (p.status === "closed_unsold") {
        return [
          {
            recipient: "seller",
            category: "auction_result",
            title: "Your auction closed",
            body: "Your auction closed without a sale.",
            resourceType: "auction",
            resourceId: auctionId,
          },
        ];
      }
      return [];
    }
    case "order.created":
      return [
        {
          recipient: "buyer",
          category: "order_update",
          title: "Order created",
          body: "Your order was created.",
          resourceType: "order",
          resourceId: orderId,
        },
      ];
    case "order.paid":
      return [
        {
          recipient: "seller",
          category: "payment_update",
          title: "Order paid",
          body: "An order has been paid.",
          resourceType: "order",
          resourceId: orderId,
        },
      ];
    case "order.shipped":
      return [
        {
          recipient: "buyer",
          category: "fulfilment_update",
          title: "Order shipped",
          body: "Your order has shipped.",
          resourceType: "order",
          resourceId: orderId,
        },
      ];
    case "order.ready_for_pickup":
      return [
        {
          recipient: "buyer",
          category: "fulfilment_update",
          title: "Order ready for pickup",
          body: "Your order is ready for pickup.",
          resourceType: "order",
          resourceId: orderId,
        },
      ];
    case "listing.rejected":
    case "listing.paused":
    case "listing.removed":
      return [
        {
          recipient: "seller",
          category: "listing_moderation",
          title: "Listing update",
          body: "The status of your listing changed. Sign in for details.",
          resourceType: "listing",
          resourceId: listingId,
        },
      ];
    case "account.suspended":
      return [
        {
          recipient: "affected_user",
          category: "account_status",
          title: "Account update",
          body: "Your account status changed. Sign in for details.",
          resourceType: "account",
          resourceId: userId,
        },
      ];
    // Slice 12 (D10): dispute notices. Copy is a NOT FOR PRODUCTION placeholder
    // pending review (docs/16 §8 #6); payloads carry no description or message body.
    case "dispute.opened":
      return [
        {
          recipient: "affected_user",
          category: "order_update",
          title: "Dispute opened",
          body: "A dispute was opened on your order.",
          resourceType: "order",
          resourceId: orderId,
        },
      ];
    case "dispute.message_posted":
      return [
        {
          recipient: "affected_user",
          category: "order_update",
          title: "Dispute message",
          body: "A new message was posted on your dispute.",
          resourceType: "order",
          resourceId: orderId,
        },
      ];
    case "dispute.resolved": {
      const outcome = typeof p.outcome === "string" ? p.outcome : "reviewed";
      return [
        {
          recipient: "buyer",
          category: "order_update",
          title: "Dispute resolved",
          body: `Your dispute outcome: ${outcome}.`,
          resourceType: "order",
          resourceId: orderId,
        },
        {
          recipient: "seller",
          category: "order_update",
          title: "Dispute resolved",
          body: `Your dispute outcome: ${outcome}.`,
          resourceType: "order",
          resourceId: orderId,
        },
      ];
    }
    case "report.resolved": {
      const decision = p.decision === "actioned" || p.decision === "dismissed" ? p.decision : "reviewed";
      const specs: NotificationSpec[] = [
        {
          recipient: "reporter",
          category: "report_result",
          title: "Report outcome",
          body: `Your report outcome: ${decision}.`,
          resourceType: "report",
          resourceId: reportId,
        },
      ];
      if (p.action && p.action !== "none") {
        specs.push({
          recipient: "reported_party",
          category: "report_result",
          title: "Report resolved",
          body: "A report concerning your item was resolved.",
          resourceType: p.targetType === "listing" ? "listing" : "account",
          resourceId: String(p.targetId ?? ""),
        });
      }
      return specs;
    }
    default:
      return [];
  }
}

// D5: only a relative path; resolved by the authenticated GraphQL recipient query.
const LINK_PATHS: Record<string, string> = {
  auction: "/auctions/",
  order: "/orders/",
  listing: "/listings/",
  report: "/reports/",
  account: "/account",
};

export function relativeLink(resourceType: string | null, resourceId: string | null): string | null {
  if (!resourceType) return null;
  const base = LINK_PATHS[resourceType];
  if (!base) return null;
  return resourceType === "account" ? base : `${base}${resourceId ?? ""}`;
}
