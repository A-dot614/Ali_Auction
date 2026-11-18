import type pg from "pg";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { assertTransition, type OrderStatus } from "./orderStateMachine.js";
import { calculateFeeMinor } from "./fee.js";

/**
 * Orders, order creation from auction.closed outbox events (docs/07 §8), queries and
 * manual fulfilment (docs/16 §6 OPEN). Status changes go through orderStateMachine and
 * write an order_events row. All timestamps come from the injected clock.
 */

export type ServiceOptions = {
  now?: () => Date;
};

export type ConsumeResult = { created: number; skipped: number };

export type OrderRow = {
  id: string;
  auction_id: string;
  listing_id: string;
  buyer_user_id: string;
  seller_profile_id: string;
  status: OrderStatus;
  currency: string;
  hammer_price_minor: string;
  fee_total_minor: string;
  total_minor: string;
  shipping_address_snapshot: unknown | null;
  created_at: Date;
  updated_at: Date;
};

export type OrderView = {
  id: string;
  status: OrderStatus;
  currency: string;
  hammerPriceMinor: string;
  feeTotalMinor: string;
  totalMinor: string;
  createdAt: string;
  updatedAt: string;
  shippingAddressSnapshot?: unknown | null;
  shipments: Array<{ method: string; carrier: string | null; trackingNumber: string | null }>;
  // A1 (FR-051): display-only placeholder estimate; never added to totalMinor.
  estimatedShippingMinor: string;
  estimateBasis: "PLACEHOLDER_FLAT";
};

type Viewer = { id: string; roles: string[] };

export type OrderPage = { items: OrderView[]; endCursor: string | null };

export async function transitionOrder(
  client: pg.PoolClient,
  order: { id: string; status: string },
  to: OrderStatus,
  actorUserId: string | null,
  reason: string | null,
  at: Date
): Promise<void> {
  assertTransition(order.status as OrderStatus, to);
  await client.query(`UPDATE orders SET status=$2, updated_at=$3 WHERE id=$1`, [order.id, to, at]);
  await client.query(
    `INSERT INTO order_events (order_id, from_status, to_status, actor_user_id, reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [order.id, order.status, to, actorUserId, reason, at]
  );
}

async function feeRuleAt(at: Date, client: pg.PoolClient): Promise<{ fee_code: string; description: string | null; rate_bps: number }> {
  const res = await client.query(
    `SELECT fee_code, description, rate_bps FROM fee_rules
     WHERE effective_from <= $1 AND (effective_to IS NULL OR effective_to > $1)
     ORDER BY effective_from DESC, fee_code DESC LIMIT 1`,
    [at]
  );
  if ((res.rowCount ?? 0) === 0) throw new Error("VALIDATION_ERROR: No active fee rule.");
  return res.rows[0];
}

/** D2: consume auction.closed outbox events once per consumer, in created_at/id order. */
export async function consumeAuctionClosedEvents(opts?: ServiceOptions & { max?: number }): Promise<ConsumeResult> {
  const now = opts?.now ?? (() => new Date());
  const max = Math.min(Math.max(opts?.max ?? 100, 1), 100);
  const due = await query(
    `SELECT e.id, e.payload FROM outbox_events e
     LEFT JOIN processed_events p ON p.consumer = 'orders' AND p.event_id = e.id
     WHERE e.event_type = 'auction.closed' AND p.id IS NULL
     ORDER BY e.created_at ASC, e.id ASC LIMIT $1`,
    [max]
  );
  const result: ConsumeResult = { created: 0, skipped: 0 };
  for (const event of due.rows) {
    const eventId = event.id as string;
    const payload = event.payload as { status?: string; winningBidId?: string | null; winningAmountMinor?: string | null };
    const at = now();
    try {
      await withTransaction(async (client) => {
        const recorded = await client.query(
          `INSERT INTO processed_events (consumer, event_id, processed_at) VALUES ('orders', $1, $2)
           ON CONFLICT (consumer, event_id) DO NOTHING`,
          [eventId, at]
        );
        if ((recorded.rowCount ?? 0) === 0) {
          result.skipped += 1;
          return;
        }
        if (payload.status !== "closed_sold") {
          // closed_unsold creates no order.
          result.skipped += 1;
          return;
        }
        const bidRes = await client.query(`SELECT bidder_user_id FROM bids WHERE id = $1`, [payload.winningBidId]);
        if ((bidRes.rowCount ?? 0) === 0) {
          result.skipped += 1;
          return;
        }
        // The auction row links the listing; the listing holds the seller profile.
        const auctionId = (event.payload as any).auctionId as string | undefined;
        const auctionRes = auctionId
          ? await client.query(`SELECT listing_id FROM auctions WHERE id = $1`, [auctionId])
          : null;
        const listingId = auctionRes?.rows[0]?.listing_id as string | undefined;
        const listingRes = listingId
          ? await client.query(`SELECT seller_profile_id FROM listings WHERE id = $1`, [listingId])
          : null;
        const sellerProfileId = listingRes?.rows[0]?.seller_profile_id as string | undefined;
        if (!auctionId || !listingId || !sellerProfileId) {
          result.skipped += 1;
          return;
        }
        const hammer = Number(payload.winningAmountMinor);
        if (!Number.isInteger(hammer) || hammer <= 0) {
          result.skipped += 1;
          return;
        }
        const rule = await feeRuleAt(at, client);
        const fee = calculateFeeMinor(hammer, rule.rate_bps);
        const total = hammer + fee;
        const orderRes = await client.query(
          `INSERT INTO orders (auction_id, listing_id, buyer_user_id, seller_profile_id, status, currency,
                               hammer_price_minor, fee_total_minor, total_minor, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'awaiting_payment','CAD',$5,$6,$7,$8,$8)
           ON CONFLICT (auction_id) DO NOTHING RETURNING *`,
          [
            auctionId,
            listingId,
            bidRes.rows[0].bidder_user_id,
            sellerProfileId,
            hammer,
            fee,
            total,
            at,
          ]
        );
        if ((orderRes.rowCount ?? 0) === 0) {
          result.skipped += 1;
          return;
        }
        await client.query(
          `INSERT INTO order_fee_lines (order_id, fee_code, description, amount_minor, currency, created_at)
           VALUES ($1,$2,$3,$4,'CAD',$5)`,
          [orderRes.rows[0].id, rule.fee_code, rule.description ?? rule.fee_code, fee, at]
        );
        await client.query(
          `INSERT INTO order_events (order_id, from_status, to_status, actor_user_id, reason, created_at)
           VALUES ($1, NULL, 'awaiting_payment', NULL, NULL, $2)`,
          [orderRes.rows[0].id, at]
        );
        // Slice 8 (D2): order.created outbox event for the notifications consumer, committed here.
        await client.query(
          `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
           VALUES ('order', $1, 'order.created', $2::jsonb, $3)`,
          [
            orderRes.rows[0].id,
            JSON.stringify({ orderId: orderRes.rows[0].id, buyerUserId: bidRes.rows[0].bidder_user_id }),
            at,
          ]
        );
        result.created += 1;
      });
    } catch {
      // A failing event is left unprocessed (processed_events insert rolls back) so it can be retried.
      result.skipped += 1;
    }
  }
  return result;
}

async function viewerRelation(order: OrderRow, viewer: Viewer): Promise<"buyer" | "seller" | "staff" | "none"> {
  if (order.buyer_user_id === viewer.id) return "buyer";
  const sp = await query(`SELECT user_id FROM seller_profiles WHERE id = $1`, [order.seller_profile_id]);
  if ((sp.rowCount ?? 0) > 0 && sp.rows[0].user_id === viewer.id) return "seller";
  if (viewer.roles.some((r) => r === "admin" || r === "moderator" || r === "support")) return "staff";
  return "none";
}

async function mapOrderView(row: OrderRow, relation: "buyer" | "seller" | "staff" | "none"): Promise<OrderView> {
  const shipments = await query(
    `SELECT method, carrier, tracking_number FROM shipments WHERE order_id = $1 ORDER BY created_at ASC, id ASC`,
    [row.id]
  );
  const view: OrderView = {
    id: row.id,
    status: row.status,
    currency: row.currency,
    hammerPriceMinor: String(row.hammer_price_minor),
    feeTotalMinor: String(row.fee_total_minor),
    totalMinor: String(row.total_minor),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    shipments: shipments.rows.map((s: any) => ({ method: s.method, carrier: s.carrier, trackingNumber: s.tracking_number })),
    // NOT FOR PRODUCTION: flat placeholder, no address/carrier computation (docs/16 §6).
    estimatedShippingMinor: String(config.fulfilment.flatShippingEstimateMinor),
    estimateBasis: "PLACEHOLDER_FLAT",
  };
  // Address is only returned to buyer/seller (docs/10 §5); never in public/staff views.
  if (relation === "buyer" || relation === "seller") view.shippingAddressSnapshot = row.shipping_address_snapshot ?? null;
  return view;
}

function parseCursor(after: string | null | undefined): { createdAt: string; id: string } | null {
  if (!after) return null;
  try {
    const parsed = JSON.parse(Buffer.from(after, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") throw new Error("bad");
    return parsed;
  } catch {
    throw new Error("VALIDATION_ERROR: Invalid cursor.");
  }
}

function encodeCursor(row: OrderRow): string {
  return Buffer.from(JSON.stringify({ createdAt: new Date(row.created_at).toISOString(), id: row.id }), "utf8").toString("base64url");
}

async function listOrders(
  where: string,
  params: any[],
  viewer: Viewer,
  opts: { first?: number | null; after?: string | null }
): Promise<OrderPage> {
  const first = Math.min(Math.max(opts.first ?? 20, 1), 100);
  const cursor = parseCursor(opts.after);
  const args = [...params];
  let clause = where;
  if (cursor) {
    args.push(cursor.createdAt, cursor.id);
    clause += ` AND (created_at, id) < ($${args.length - 1}::timestamptz, $${args.length}::uuid)`;
  }
  args.push(first + 1);
  const res = await query(
    `SELECT * FROM orders ${clause} ORDER BY created_at DESC, id DESC LIMIT $${args.length}`,
    args
  );
  const hasMore = res.rows.length > first;
  const rows = (hasMore ? res.rows.slice(0, first) : res.rows) as OrderRow[];
  const items: OrderView[] = [];
  for (const row of rows) items.push(await mapOrderView(row, await viewerRelation(row, viewer)));
  return { items, endCursor: rows.length ? encodeCursor(rows[rows.length - 1]) : null };
}

export async function getMyOrders(viewer: Viewer, opts: { first?: number | null; after?: string | null }): Promise<OrderPage> {
  return listOrders(`WHERE buyer_user_id = $1`, [viewer.id], viewer, opts);
}

export async function sellerOrders(viewer: Viewer, opts: { first?: number | null; after?: string | null }): Promise<OrderPage> {
  const sp = await query(`SELECT id FROM seller_profiles WHERE user_id = $1`, [viewer.id]);
  if ((sp.rowCount ?? 0) === 0) return { items: [], endCursor: null };
  return listOrders(`WHERE seller_profile_id = $1`, [sp.rows[0].id], viewer, opts);
}

export async function ordersAll(viewer: Viewer, opts: { first?: number | null; after?: string | null }): Promise<OrderPage> {
  if (!viewer.roles.some((r) => r === "admin" || r === "moderator" || r === "support")) {
    throw new Error("FORBIDDEN: Insufficient permissions.");
  }
  return listOrders(`WHERE 1=1`, [], viewer, opts);
}

export async function getOrder(id: string, viewer: Viewer): Promise<OrderView> {
  const res = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
  if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Order not found.");
  const row = res.rows[0] as OrderRow;
  const relation = await viewerRelation(row, viewer);
  if (relation === "none") throw new Error("NOT_FOUND: Order not found.");
  return mapOrderView(row, relation);
}

export async function loadOrder(id: string): Promise<OrderRow | null> {
  const res = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) === 0 ? null : (res.rows[0] as OrderRow);
}

export type FulfilmentAction = "start_processing" | "mark_shipped" | "ready_for_pickup" | "complete";

/** D7: manual fulfilment only; seller records, buyer confirms completion. */
export async function recordFulfilment(
  orderId: string,
  actor: Viewer,
  action: FulfilmentAction,
  input: { carrier?: string; trackingNumber?: string },
  opts?: ServiceOptions
): Promise<OrderView> {
  const now = opts?.now ?? (() => new Date());
  return withTransaction(async (client) => {
    const res = await client.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [orderId]);
    if ((res.rowCount ?? 0) === 0) throw new Error("NOT_FOUND: Order not found.");
    const order = res.rows[0] as OrderRow;
    const sp = await client.query(`SELECT user_id FROM seller_profiles WHERE id=$1`, [order.seller_profile_id]);
    const sellerUserId = sp.rows[0]?.user_id;
    const isSeller = sellerUserId === actor.id;
    const isBuyer = order.buyer_user_id === actor.id;
    if (action !== "complete" && !isSeller) throw new Error("FORBIDDEN: Only the seller may record fulfilment.");
    if (action === "complete" && !isBuyer && !isSeller) throw new Error("FORBIDDEN: Not a participant.");
    const at = now();
    let to: OrderStatus;
    let reason: string | null = null;
    if (action === "start_processing") to = "processing";
    else if (action === "ready_for_pickup") to = "ready_for_pickup";
    else if (action === "complete") to = "completed";
    else {
      const carrier = (input.carrier || "").trim();
      const tracking = (input.trackingNumber || "").trim();
      if (!carrier || !tracking) throw new Error("VALIDATION_ERROR: carrier and trackingNumber are required.");
      to = "shipped";
      reason = `shipped via ${carrier} tracking ${tracking}`;
    }
    await transitionOrder(client, order, to, actor.id, reason, at);
    // Slice 8 (D2): notify the buyer of fulfilment transitions via the outbox.
    if (to === "shipped" || to === "ready_for_pickup") {
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
         VALUES ('order', $1, $2, $3::jsonb, $4)`,
        [
          orderId,
          `order.${to}`,
          JSON.stringify({ orderId, buyerUserId: order.buyer_user_id }),
          at,
        ]
      );
    }
    if (action === "mark_shipped" || action === "ready_for_pickup") {
      await client.query(
        `INSERT INTO shipments (order_id, method, carrier, tracking_number, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$5)`,
        [
          orderId,
          action === "mark_shipped" ? "shipping" : "local_pickup",
          action === "mark_shipped" ? (input.carrier || "").trim() : null,
          action === "mark_shipped" ? (input.trackingNumber || "").trim() : null,
          at,
        ]
      );
    }
    const updated = await client.query(`SELECT * FROM orders WHERE id=$1`, [orderId]);
    return mapOrderView(updated.rows[0] as OrderRow, isBuyer ? "buyer" : isSeller ? "seller" : "none");
  });
}
