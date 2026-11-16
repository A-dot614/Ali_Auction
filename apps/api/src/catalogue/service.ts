import type pg from "pg";
import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../db.js";
import { recordAudit } from "../audit.js";
import { assertTransition, type ListingStatus } from "./listingStateMachine.js";

export type ListingCondition = "new" | "like_new" | "used" | "for_parts" | "unspecified";
export type ListingFulfilment = "shipping" | "local_pickup" | "both";

export type Category = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  isPlaceholder: boolean;
};

export type Listing = {
  id: string;
  sellerProfileId: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  condition: ListingCondition;
  fulfilmentOption: ListingFulfilment;
  currency: string;
  startingPriceMinor: string; // bigint as string
  requestedStartsAt: Date | null;
  requestedEndsAt: Date | null;
  status: ListingStatus;
  rejectionReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListingInput = {
  categoryId: string;
  title: string;
  description: string;
  condition: string;
  fulfilmentOption: string;
  currency: string;
  startingPriceMinor: unknown;
  requestedStartsAt?: string | null;
  requestedEndsAt?: string | null;
};

const CONDITIONS: ListingCondition[] = ["new", "like_new", "used", "for_parts", "unspecified"];
const FULFILMENT: ListingFulfilment[] = ["shipping", "local_pickup", "both"];

// Placeholder limits; mark TODO docs/16 §8.
const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESC_MAX = 5000;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "listing";
}

function parsePriceMinor(value: unknown): string {
  // Must be a positive integer. No floats anywhere.
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error("VALIDATION_ERROR: starting_price_minor must be a positive integer.");
    if (value <= 0) throw new Error("VALIDATION_ERROR: starting_price_minor must be a positive integer.");
    return String(value);
  }
  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) throw new Error("VALIDATION_ERROR: starting_price_minor must be a positive integer.");
    if (value === "0" || /^0+$/.test(value)) throw new Error("VALIDATION_ERROR: starting_price_minor must be a positive integer.");
    return value.replace(/^0+/, "") || "0";
  }
  throw new Error("VALIDATION_ERROR: starting_price_minor must be a positive integer.");
}

function parseDate(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("VALIDATION_ERROR: Invalid datetime.");
  return d;
}

function validateInput(input: ListingInput): {
  categoryId: string;
  title: string;
  description: string;
  condition: ListingCondition;
  fulfilmentOption: ListingFulfilment;
  currency: string;
  startingPriceMinor: string;
  requestedStartsAt: Date | null;
  requestedEndsAt: Date | null;
} {
  const title = (input.title || "").trim();
  // TODO(docs/16 §8): title length limits placeholder.
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    throw new Error("VALIDATION_ERROR: title must be between 3 and 120 characters.");
  }
  const description = (input.description || "").trim();
  // TODO(docs/16 §8): description length limit placeholder.
  if (description.length < 1 || description.length > DESC_MAX) {
    throw new Error("VALIDATION_ERROR: description must be between 1 and 5000 characters.");
  }
  if (!CONDITIONS.includes(input.condition as ListingCondition)) {
    throw new Error("VALIDATION_ERROR: Invalid condition.");
  }
  if (!FULFILMENT.includes(input.fulfilmentOption as ListingFulfilment)) {
    throw new Error("VALIDATION_ERROR: Invalid fulfilment_option.");
  }
  const currency = (input.currency || "").trim().toUpperCase();
  if (currency !== "CAD") {
    throw new Error("VALIDATION_ERROR: Only CAD currency is supported in this slice.");
  }
  const startingPriceMinor = parsePriceMinor(input.startingPriceMinor);
  const requestedStartsAt = parseDate(input.requestedStartsAt);
  const requestedEndsAt = parseDate(input.requestedEndsAt);
  if (requestedStartsAt && requestedEndsAt && requestedEndsAt <= requestedStartsAt) {
    throw new Error("VALIDATION_ERROR: requested_ends_at must be after requested_starts_at.");
  }
  // TODO(Slice 4, docs/16 §3): do NOT check requested_starts_at is in the future in this slice (server-time logic later).
  return {
    categoryId: input.categoryId,
    title,
    description,
    condition: input.condition as ListingCondition,
    fulfilmentOption: input.fulfilmentOption as ListingFulfilment,
    currency,
    startingPriceMinor,
    requestedStartsAt,
    requestedEndsAt,
  };
}

async function getApprovedSellerProfileIdForUser(userId: string): Promise<string> {
  const res = await query(
    `SELECT sp.id
     FROM seller_profiles sp
     JOIN seller_verifications sv ON sv.seller_profile_id = sp.id
     WHERE sp.user_id = $1
     ORDER BY sv.created_at DESC
     LIMIT 1`,
    [userId]
  );
  if ((res.rowCount ?? 0) === 0) {
    // No seller profile or verification record; treat as not approved for seller actions.
    throw new Error("SELLER_NOT_APPROVED: Seller verification approval is required for this action.");
  }
  const statusRes = await query(
    `SELECT sv.status FROM seller_verifications sv WHERE sv.seller_profile_id = $1 ORDER BY sv.created_at DESC LIMIT 1`,
    [res.rows[0].id]
  );
  if ((statusRes.rowCount ?? 0) === 0 || statusRes.rows[0].status !== "approved") {
    throw new Error("SELLER_NOT_APPROVED: Seller verification approval is required for this action.");
  }
  return res.rows[0].id as string;
}

async function assertActiveCategory(categoryId: string, client?: pg.PoolClient): Promise<void> {
  const runner: any = client || { query };
  const res = await runner.query(`SELECT id, is_active FROM categories WHERE id = $1`, [categoryId]);
  if ((res.rowCount ?? 0) === 0 || !res.rows[0].is_active) {
    throw new Error("VALIDATION_ERROR: Category must exist and be active.");
  }
}

function mapListing(row: any): Listing {
  return {
    id: row.id,
    sellerProfileId: row.seller_profile_id,
    categoryId: row.category_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    condition: row.condition,
    fulfilmentOption: row.fulfilment_option,
    currency: row.currency,
    startingPriceMinor: String(row.starting_price_minor),
    requestedStartsAt: row.requested_starts_at,
    requestedEndsAt: row.requested_ends_at,
    status: row.status,
    rejectionReason: row.rejection_reason,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function generateUniqueSlug(client: pg.PoolClient, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? `${base}-${randomUUID().slice(0, 8)}` : `${base}-${randomUUID().slice(0, 8)}-${i}`;
    const existing = await client.query(`SELECT 1 FROM listings WHERE slug = $1`, [candidate]);
    if ((existing.rowCount ?? 0) === 0) return candidate;
  }
  return `${base}-${randomUUID()}`;
}

export async function listActiveCategories(): Promise<Category[]> {
  const res = await query(
    `SELECT id, parent_id, name, slug, is_active, sort_order, is_placeholder
     FROM categories WHERE is_active = true ORDER BY sort_order ASC, name ASC`
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    slug: r.slug,
    isActive: r.is_active,
    sortOrder: r.sort_order,
    isPlaceholder: r.is_placeholder,
  }));
}

export async function createListingDraft(userId: string, input: ListingInput): Promise<Listing> {
  const sellerProfileId = await getApprovedSellerProfileIdForUser(userId);
  const v = validateInput(input);
  return withTransaction(async (client) => {
    await assertActiveCategory(v.categoryId, client);
    const slug = await generateUniqueSlug(client, v.title);
    const res = await client.query(
      `INSERT INTO listings
       (seller_profile_id, category_id, title, slug, description, condition, fulfilment_option, currency, starting_price_minor, requested_starts_at, requested_ends_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft')
       RETURNING *`,
      [
        sellerProfileId,
        v.categoryId,
        v.title,
        slug,
        v.description,
        v.condition,
        v.fulfilmentOption,
        v.currency,
        v.startingPriceMinor,
        v.requestedStartsAt,
        v.requestedEndsAt,
      ]
    );
    const listing = mapListing(res.rows[0]);
    await recordAudit(
      {
        actorUserId: userId,
        action: "listing.created",
        targetType: "listing",
        targetId: listing.id,
        metadata: { status: listing.status, categoryId: listing.categoryId },
      },
      client
    );
    return listing;
  });
}

export async function updateListingDraft(userId: string, listingId: string, input: ListingInput): Promise<Listing> {
  const sellerProfileId = await getApprovedSellerProfileIdForUser(userId);
  const v = validateInput(input);
  return withTransaction(async (client) => {
    // Non-owner gets NOT_FOUND to avoid confirming existence.
    const res = await client.query(
      `SELECT * FROM listings WHERE id = $1 AND seller_profile_id = $2 FOR UPDATE`,
      [listingId, sellerProfileId]
    );
    if ((res.rowCount ?? 0) === 0) {
      throw new Error("NOT_FOUND: Listing not found.");
    }
    const current = res.rows[0];
    const status = current.status as ListingStatus;
    if (status !== "draft" && status !== "rejected") {
      throw new Error("LISTING_NOT_EDITABLE: Listing cannot be edited in its current state.");
    }
    await assertActiveCategory(v.categoryId, client);
    // If revising a rejected listing, transition to draft.
    if (status === "rejected") {
      assertTransition("rejected", "draft");
    }
    const updated = await client.query(
      `UPDATE listings SET
        category_id=$2, title=$3, description=$4, condition=$5, fulfilment_option=$6, currency=$7,
        starting_price_minor=$8, requested_starts_at=$9, requested_ends_at=$10,
        status='draft', rejection_reason=NULL, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [
        listingId,
        v.categoryId,
        v.title,
        v.description,
        v.condition,
        v.fulfilmentOption,
        v.currency,
        v.startingPriceMinor,
        v.requestedStartsAt,
        v.requestedEndsAt,
      ]
    );
    await recordAudit(
      {
        actorUserId: userId,
        action: "listing.updated",
        targetType: "listing",
        targetId: listingId,
        metadata: { before: status, after: "draft" },
      },
      client
    );
    return mapListing(updated.rows[0]);
  });
}

export async function submitListingForReview(userId: string, listingId: string): Promise<Listing> {
  const sellerProfileId = await getApprovedSellerProfileIdForUser(userId);
  return withTransaction(async (client) => {
    const res = await client.query(
      `SELECT * FROM listings WHERE id = $1 AND seller_profile_id = $2 FOR UPDATE`,
      [listingId, sellerProfileId]
    );
    if ((res.rowCount ?? 0) === 0) {
      throw new Error("NOT_FOUND: Listing not found.");
    }
    const current = res.rows[0];
    const status = current.status as ListingStatus;
    if (status === "pending_review") {
      throw new Error("VALIDATION_ERROR: Listing is already pending review.");
    }
    assertTransition(status, "pending_review");
    const updated = await client.query(
      `UPDATE listings SET status='pending_review', updated_at=now() WHERE id=$1 RETURNING *`,
      [listingId]
    );
    await recordAudit(
      {
        actorUserId: userId,
        action: "listing.submitted_for_review",
        targetType: "listing",
        targetId: listingId,
        metadata: { before: status, after: "pending_review" },
      },
      client
    );
    return mapListing(updated.rows[0]);
  });
}

export async function myListings(userId: string, opts: { status?: string | null; first?: number; after?: string | null }) {
  const sellerProfileId = await getApprovedSellerProfileIdForUser(userId);
  const limit = Math.min(Math.max(opts.first || 20, 1), 100);
  const params: any[] = [sellerProfileId];
  let where = "WHERE seller_profile_id = $1";
  if (opts.status) {
    params.push(opts.status);
    where += ` AND status = $${params.length}`;
  }
  // cursor by created_at (ISO) for simplicity
  if (opts.after) {
    params.push(opts.after);
    where += ` AND created_at < $${params.length}`;
  }
  params.push(limit);
  const res = await query(
    `SELECT * FROM listings ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  const items = res.rows.map(mapListing);
  const endCursor = items.length ? items[items.length - 1].createdAt.toISOString() : null;
  return { items, endCursor };
}

export async function getPublicListingBySlug(slug: string): Promise<{
  listing: Listing;
  category: Category;
  media: { altText: string | null; sortOrder: number }[];
} | null> {
  const res = await query(
    `SELECT l.*, c.id as c_id, c.parent_id as c_parent_id, c.name as c_name, c.slug as c_slug,
            c.is_active as c_is_active, c.sort_order as c_sort_order, c.is_placeholder as c_is_placeholder
     FROM listings l
     JOIN categories c ON c.id = l.category_id
     WHERE l.slug = $1 AND l.status = 'published'`,
    [slug]
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const r = res.rows[0];
  const listing = mapListing(r);
  const category: Category = {
    id: r.c_id,
    parentId: r.c_parent_id,
    name: r.c_name,
    slug: r.c_slug,
    isActive: r.c_is_active,
    sortOrder: r.c_sort_order,
    isPlaceholder: r.c_is_placeholder,
  };
  const mediaRes = await query(
    `SELECT alt_text, sort_order FROM listing_media WHERE listing_id = $1 ORDER BY sort_order ASC`,
    [listing.id]
  );
  const media = mediaRes.rows.map((m: any) => ({ altText: m.alt_text, sortOrder: m.sort_order }));
  return { listing, category, media };
}

type LockedListing = { listing: any; sellerUserId: string | null };

async function lockListingForModeration(client: pg.PoolClient, listingId: string): Promise<LockedListing> {
  const res = await client.query(`SELECT * FROM listings WHERE id = $1 FOR UPDATE`, [listingId]);
  if ((res.rowCount ?? 0) === 0) {
    throw new Error("NOT_FOUND: Listing not found.");
  }
  const listing = res.rows[0];
  let sellerUserId: string | null = null;
  if (listing.seller_profile_id) {
    const spRes = await client.query(`SELECT user_id FROM seller_profiles WHERE id = $1`, [listing.seller_profile_id]);
    if ((spRes.rowCount ?? 0) > 0) {
      sellerUserId = (spRes.rows[0].user_id as string) ?? null;
    }
  }
  return { listing, sellerUserId };
}

export async function pendingListingReviews(opts: {
  first?: number;
  after?: string | null;
}): Promise<{ items: Listing[]; endCursor: string | null }> {
  const limit = Math.min(Math.max(opts.first || 20, 1), 100);
  const params: any[] = [];
  let where = `WHERE l.status = 'pending_review'`;
  if (opts.after) {
    params.push(opts.after);
    where += ` AND l.created_at < $${params.length}`;
  }
  const res = await query(
    `SELECT l.*, c.id as c_id, c.parent_id as c_parent_id, c.name as c_name, c.slug as c_slug,
            c.is_active as c_is_active, c.sort_order as c_sort_order, c.is_placeholder as c_is_placeholder
     FROM listings l
     JOIN categories c ON c.id = l.category_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT ${limit}`,
    params
  );
  const items = res.rows.map((r: any) => mapListing(r));
  const endCursor = items.length ? items[items.length - 1].createdAt.toISOString() : null;
  return { items, endCursor };
}

export async function approveListing(listingId: string, reviewerUserId: string): Promise<Listing> {
  return withTransaction(async (client) => {
    const { listing, sellerUserId } = await lockListingForModeration(client, listingId);
    if (sellerUserId === reviewerUserId) {
      throw new Error("FORBIDDEN: A moderator cannot moderate a listing they own.");
    }
    const status = listing.status as ListingStatus;
    try {
      assertTransition(status, "published");
    } catch (err) {
      await recordAudit(
        {
          actorUserId: reviewerUserId,
          action: "listing.transition_rejected",
          targetType: "listing",
          targetId: listingId,
          metadata: { before: status, after: "published", attemptedAction: "approveListing" },
        },
        client
      );
      throw err;
    }
    const updated = await client.query(
      `UPDATE listings SET status='published', published_at=now(), updated_at=now() WHERE id=$1 RETURNING *`,
      [listingId]
    );
    await recordAudit(
      {
        actorUserId: reviewerUserId,
        action: "listing.approved",
        targetType: "listing",
        targetId: listingId,
        reason: null,
        metadata: { before: status, after: "published", listingId },
      },
      client
    );
    return mapListing(updated.rows[0]);
  });
}

export async function rejectListing(
  listingId: string,
  reviewerUserId: string,
  reason: string | null,
  opts?: { clock?: () => Date }
): Promise<Listing> {
  const trimmedReason = (reason || "").trim();
  if (!trimmedReason) {
    throw new Error("VALIDATION_ERROR: Reason is required for reject.");
  }
  const notificationAt = (opts?.clock ?? (() => new Date()))();
  return withTransaction(async (client) => {
    const { listing, sellerUserId } = await lockListingForModeration(client, listingId);
    if (sellerUserId === reviewerUserId) {
      throw new Error("FORBIDDEN: A moderator cannot moderate a listing they own.");
    }
    const status = listing.status as ListingStatus;
    try {
      assertTransition(status, "rejected");
    } catch (err) {
      await recordAudit(
        {
          actorUserId: reviewerUserId,
          action: "listing.transition_rejected",
          targetType: "listing",
          targetId: listingId,
          metadata: { before: status, after: "rejected", attemptedAction: "rejectListing" },
        },
        client
      );
      throw err;
    }
    const updated = await client.query(
      `UPDATE listings SET status='rejected', rejection_reason=$2, published_at=NULL, updated_at=now() WHERE id=$1 RETURNING *`,
      [listingId, trimmedReason]
    );
    await recordAudit(
      {
        actorUserId: reviewerUserId,
        action: "listing.rejected",
        targetType: "listing",
        targetId: listingId,
        reason: trimmedReason,
        metadata: { before: status, after: "rejected", listingId },
      },
      client
    );
    // Slice 8 (D2): seller notice via the outbox consumer; no inline email, no reason leaked.
    await client.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ('listing', $1, 'listing.rejected', $2::jsonb, $3)`,
      [listingId, JSON.stringify({ listingId, sellerUserId }), notificationAt]
    );
    return mapListing(updated.rows[0]);
  });
}

export async function pauseListing(
  listingId: string,
  reviewerUserId: string,
  reason: string | null,
  client?: pg.PoolClient,
  opts?: { clock?: () => Date }
): Promise<Listing> {
  const trimmedReason = (reason || "").trim();
  if (!trimmedReason) {
    throw new Error("VALIDATION_ERROR: Reason is required for pause.");
  }
  const notificationAt = (opts?.clock ?? (() => new Date()))();
  const run = async (tx: pg.PoolClient) => {
    const { listing, sellerUserId } = await lockListingForModeration(tx, listingId);
    if (sellerUserId === reviewerUserId) {
      throw new Error("FORBIDDEN: A moderator cannot moderate a listing they own.");
    }
    const status = listing.status as ListingStatus;
    try {
      assertTransition(status, "paused");
    } catch (err) {
      await recordAudit(
        {
          actorUserId: reviewerUserId,
          action: "listing.transition_rejected",
          targetType: "listing",
          targetId: listingId,
          metadata: { before: status, after: "paused", attemptedAction: "pauseListing" },
        },
        tx
      );
      throw err;
    }
    const updated = await tx.query(
      `UPDATE listings SET status='paused', updated_at=now() WHERE id=$1 RETURNING *`,
      [listingId]
    );
    await recordAudit(
      {
        actorUserId: reviewerUserId,
        action: "listing.paused",
        targetType: "listing",
        targetId: listingId,
        reason: trimmedReason,
        metadata: { before: status, after: "paused", listingId },
      },
      tx
    );
    // Slice 8 (D2): seller notice via the outbox consumer; no inline email, no reason leaked.
    await tx.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ('listing', $1, 'listing.paused', $2::jsonb, $3)`,
      [listingId, JSON.stringify({ listingId, sellerUserId }), notificationAt]
    );
    return mapListing(updated.rows[0]);
  };
  // Slice 7: resolveReport(action=hide_listing) reuses this path inside its own transaction.
  if (client) return run(client);
  return withTransaction(run);
}

export async function resumeListing(listingId: string, reviewerUserId: string): Promise<Listing> {
  return withTransaction(async (client) => {
    const { listing, sellerUserId } = await lockListingForModeration(client, listingId);
    if (sellerUserId === reviewerUserId) {
      throw new Error("FORBIDDEN: A moderator cannot moderate a listing they own.");
    }
    const status = listing.status as ListingStatus;
    try {
      assertTransition(status, "published");
    } catch (err) {
      await recordAudit(
        {
          actorUserId: reviewerUserId,
          action: "listing.transition_rejected",
          targetType: "listing",
          targetId: listingId,
          metadata: { before: status, after: "published", attemptedAction: "resumeListing" },
        },
        client
      );
      throw err;
    }
    const updated = await client.query(
      `UPDATE listings SET status='published', published_at=now(), updated_at=now() WHERE id=$1 RETURNING *`,
      [listingId]
    );
    await recordAudit(
      {
        actorUserId: reviewerUserId,
        action: "listing.resumed",
        targetType: "listing",
        targetId: listingId,
        metadata: { before: status, after: "published", listingId },
      },
      client
    );
    return mapListing(updated.rows[0]);
  });
}

export async function removeListing(
  listingId: string,
  reviewerUserId: string,
  reason: string | null,
  opts?: { clock?: () => Date }
): Promise<Listing> {
  const trimmedReason = (reason || "").trim();
  if (!trimmedReason) {
    throw new Error("VALIDATION_ERROR: Reason is required for remove.");
  }
  const notificationAt = (opts?.clock ?? (() => new Date()))();
  return withTransaction(async (client) => {
    const { listing, sellerUserId } = await lockListingForModeration(client, listingId);
    if (sellerUserId === reviewerUserId) {
      throw new Error("FORBIDDEN: A moderator cannot moderate a listing they own.");
    }
    const status = listing.status as ListingStatus;
    try {
      assertTransition(status, "removed");
    } catch (err) {
      await recordAudit(
        {
          actorUserId: reviewerUserId,
          action: "listing.transition_rejected",
          targetType: "listing",
          targetId: listingId,
          metadata: { before: status, after: "removed", attemptedAction: "removeListing" },
        },
        client
      );
      throw err;
    }
    const updated = await client.query(
      `UPDATE listings SET status='removed', updated_at=now() WHERE id=$1 RETURNING *`,
      [listingId]
    );
    await recordAudit(
      {
        actorUserId: reviewerUserId,
        action: "listing.removed",
        targetType: "listing",
        targetId: listingId,
        reason: trimmedReason,
        metadata: { before: status, after: "removed", listingId },
      },
      client
    );
    // Slice 8 (D2): seller notice via the outbox consumer; no inline email, no reason leaked.
    await client.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, created_at)
       VALUES ('listing', $1, 'listing.removed', $2::jsonb, $3)`,
      [listingId, JSON.stringify({ listingId, sellerUserId }), notificationAt]
    );
    return mapListing(updated.rows[0]);
  });
}
