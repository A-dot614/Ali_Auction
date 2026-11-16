import type pg from "pg";
import { consumeOutbox, type EventHandler } from "../outbox/consumer.js";
import type { OutboxMessage } from "../outbox/publisher.js";
import {
  mapEventToNotifications,
  NOTIFICATION_CHANNELS,
  TRANSACTIONAL_CATEGORIES,
  type NotificationCategory,
  type NotificationSpec,
  type RecipientRole,
} from "./templates.js";

/**
 * D2 (Slice 8): the 'notifications' outbox consumer. Maps committed events to
 * notification rows; one row per recipient/category/source event. No inline email,
 * no reporter identity, no provider/payment details, no staff moderation reasons.
 */

const CONSUMER_NAME = "notifications";

async function sellerForAuction(client: pg.PoolClient, auctionId: string): Promise<string | null> {
  const res = await client.query(
    `SELECT sp.user_id FROM auctions a
     JOIN listings l ON l.id = a.listing_id
     JOIN seller_profiles sp ON sp.id = l.seller_profile_id
     WHERE a.id = $1`,
    [auctionId]
  );
  return (res.rows[0]?.user_id as string) ?? null;
}

async function sellerForListing(client: pg.PoolClient, listingId: string): Promise<string | null> {
  const res = await client.query(
    `SELECT sp.user_id FROM listings l JOIN seller_profiles sp ON sp.id = l.seller_profile_id WHERE l.id = $1`,
    [listingId]
  );
  return (res.rows[0]?.user_id as string) ?? null;
}

async function sellerForOrder(client: pg.PoolClient, orderId: string): Promise<string | null> {
  const res = await client.query(
    `SELECT sp.user_id FROM orders o JOIN seller_profiles sp ON sp.id = o.seller_profile_id WHERE o.id = $1`,
    [orderId]
  );
  return (res.rows[0]?.user_id as string) ?? null;
}

async function resolveRecipient(
  client: pg.PoolClient,
  role: RecipientRole,
  message: OutboxMessage,
  p: Record<string, any>
): Promise<string | null> {
  const aggregateId = message.aggregateId;
  switch (role) {
    case "seller":
      if (p.sellerUserId) return String(p.sellerUserId);
      if (p.auctionId) return sellerForAuction(client, String(p.auctionId));
      if (p.listingId) return sellerForListing(client, String(p.listingId));
      if (p.orderId) return sellerForOrder(client, String(p.orderId));
      return null;
    case "previous_high_bidder": {
      const res = await client.query(
        `SELECT bidder_user_id FROM bids
         WHERE auction_id=$1 AND id <> $2
         ORDER BY amount_minor DESC, accepted_at DESC, id DESC LIMIT 1`,
        [String(p.auctionId ?? aggregateId), String(p.bidId ?? "")]
      );
      return (res.rows[0]?.bidder_user_id as string) ?? null;
    }
    case "winner": {
      if (p.winningBidId) {
        const res = await client.query(`SELECT bidder_user_id FROM bids WHERE id=$1`, [String(p.winningBidId)]);
        return (res.rows[0]?.bidder_user_id as string) ?? null;
      }
      return null;
    }
    case "buyer":
      if (p.buyerUserId) return String(p.buyerUserId);
      if (p.orderId) {
        const res = await client.query(`SELECT buyer_user_id FROM orders WHERE id=$1`, [String(p.orderId)]);
        return (res.rows[0]?.buyer_user_id as string) ?? null;
      }
      return null;
    case "affected_user":
      return p.userId ? String(p.userId) : null;
    case "reporter":
      return p.reporterUserId ? String(p.reporterUserId) : null;
    case "reported_party":
      if (p.targetType === "user") return p.targetId ? String(p.targetId) : null;
      if (p.targetType === "listing" && p.targetId) return sellerForListing(client, String(p.targetId));
      return null;
    default:
      return null;
  }
}

async function channelEnabled(
  client: pg.PoolClient,
  userId: string,
  category: NotificationCategory,
  channel: string
): Promise<boolean> {
  if (TRANSACTIONAL_CATEGORIES.has(category)) return true; // D3: cannot be disabled
  const res = await client.query(
    `SELECT enabled FROM notification_preferences WHERE user_id=$1 AND category=$2 AND channel=$3`,
    [userId, category, channel]
  );
  return res.rows[0]?.enabled === true;
}

export const handleNotificationEvent: EventHandler = async (message, client, at) => {
  const specs: NotificationSpec[] = mapEventToNotifications(message);
  if (specs.length === 0) return;
  const p: Record<string, any> = (message.payload && typeof message.payload === "object" ? message.payload : {}) as Record<string, any>;
  const bidder = p.bidderUserId ? String(p.bidderUserId) : null;
  const seller = await resolveRecipient(client, "seller", message, p);

  for (const spec of specs) {
    const userId = await resolveRecipient(client, spec.recipient, message, p);
    if (!userId) continue;
    // Never notify the same user twice for one event, and never leak the bidder back to itself.
    if (spec.recipient === "previous_high_bidder" && (userId === bidder || userId === seller)) continue;
    if (spec.recipient === "reported_party" && userId === (p.reporterUserId ? String(p.reporterUserId) : null)) continue;

    const inserted = await client.query(
      `INSERT INTO notifications (user_id, category, title, body, resource_type, resource_id, source_event_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, source_event_id, category) DO NOTHING
       RETURNING id`,
      [userId, spec.category, spec.title, spec.body, spec.resourceType, spec.resourceId || null, message.id, at]
    );
    if ((inserted.rowCount ?? 0) === 0) continue; // replay / duplicate: no new notification
    const notificationId = inserted.rows[0].id as string;
    for (const channel of NOTIFICATION_CHANNELS) {
      if (!(await channelEnabled(client, userId, spec.category, channel))) continue;
      await client.query(
        `INSERT INTO notification_deliveries (notification_id, channel, status, attempts, created_at, updated_at)
         VALUES ($1,$2,'pending',0,$3,$3)
         ON CONFLICT (notification_id, channel) DO NOTHING`,
        [notificationId, channel, at]
      );
    }
  }
};

/** Consume a batch of committed events for the notifications consumer. */
export function consumeNotifications(opts?: { now?: () => Date; batchSize?: number }) {
  return consumeOutbox(CONSUMER_NAME, handleNotificationEvent, opts);
}
