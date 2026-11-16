import { createHash } from "node:crypto";
import { query } from "../db.js";
import { config } from "../config.js";
import type { ListingCondition, ListingFulfilment } from "./service.js";

/**
 * Slice 5 (workstream 6): public catalogue search over published listings using PostgreSQL FTS.
 * PostgreSQL is the source of truth; the GIN index is a derived projection (docs/03 §1, §7).
 * No Elasticsearch; PostgreSQL FTS for MVP (docs/11 §5).
 *
 * Placeholders, NOT FOR PRODUCTION (TODO docs/16 §8): to_tsvector('simple', ...) makes no
 * language/stemmer assumption, the search field set is title (A) + description (B), and the
 * query length limit is config-driven (SEARCH_MAX_QUERY_LENGTH). No "expired" status exists in
 * the schema, so no expiry filter is implemented (docs/16 §8 open).
 */

export type SearchSort = "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RELEVANCE";
export const SEARCH_SORTS: SearchSort[] = ["NEWEST", "PRICE_ASC", "PRICE_DESC", "RELEVANCE"];
export type NoResultsReason = "NONE" | "NO_MATCHES" | "CATEGORY_EMPTY";

const CONDITIONS: ListingCondition[] = ["new", "like_new", "used", "for_parts", "unspecified"];
const FULFILMENT: ListingFulfilment[] = ["shipping", "local_pickup", "both"];

export type SearchListingsInput = {
  query?: string | null;
  categorySlug?: string | null;
  condition?: ListingCondition | null;
  fulfilmentOption?: ListingFulfilment | null;
  sort?: SearchSort | null;
  first?: number | null;
  after?: string | null;
};

export type CursorKey = {
  id: string;
  publishedAt?: string;
  priceMinor?: string;
  rank?: number;
};

export type PublicSearchCategory = {
  id: string;
  name: string;
  slug: string;
  isPlaceholder: boolean;
};

export type PublicSearchListing = {
  slug: string;
  title: string;
  description: string;
  condition: ListingCondition;
  fulfilmentOption: ListingFulfilment;
  currency: string;
  startingPriceMinor: string;
  publishedAt: string | null;
  category: PublicSearchCategory;
  media: { altText: string | null; sortOrder: number }[];
};

export type SearchResult = {
  items: PublicSearchListing[];
  endCursor: string | null;
  hasMore: boolean;
  noResultsReason: NoResultsReason;
};

type CursorPayload = { v: 1; s: SearchSort; k: CursorKey; c: string };

function checksum(sort: SearchSort, key: CursorKey): string {
  return createHash("sha256").update(`${sort}|${JSON.stringify(key)}`).digest("hex").slice(0, 16);
}

/** Opaque cursor: base64url(JSON payload with a checksum). Sort is bound into the cursor. */
export function encodeCursor(sort: SearchSort, key: CursorKey): string {
  const payload: CursorPayload = { v: 1, s: sort, k: key, c: checksum(sort, key) };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Decode + strictly validate a cursor. Any malformed/tampered/wrong-sort value throws VALIDATION_ERROR. */
export function decodeCursor(sort: SearchSort, cursor: string): CursorKey {
  const fail = (): never => {
    throw new Error("VALIDATION_ERROR: Invalid cursor.");
  };
  try {
    if (typeof cursor !== "string" || cursor.length === 0) return fail();
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    if (!payload || typeof payload !== "object") return fail();
    if (payload.v !== 1) return fail();
    if (!SEARCH_SORTS.includes(payload.s) || payload.s !== sort) return fail();
    if (typeof payload.c !== "string" || payload.c !== checksum(payload.s, payload.k)) return fail();
    const k = payload.k;
    if (!k || typeof k !== "object" || typeof k.id !== "string" || k.id.length === 0) return fail();
    // Sort-specific key validation prevents a cursor from one sort being replayed with another.
    if (sort === "NEWEST" || sort === "RELEVANCE") {
      if (typeof k.publishedAt !== "string" || Number.isNaN(new Date(k.publishedAt).getTime())) return fail();
    }
    if (sort === "PRICE_ASC" || sort === "PRICE_DESC") {
      if (typeof k.priceMinor !== "string" || !/^\d+$/.test(k.priceMinor)) return fail();
    }
    if (sort === "RELEVANCE" && (typeof k.rank !== "number" || !Number.isFinite(k.rank))) return fail();
    return k;
  } catch {
    return fail();
  }
}

export function normalizeSearchInput(input: SearchListingsInput) {
  const rawQuery = typeof input.query === "string" ? input.query.trim() : "";
  if (rawQuery.length > config.search.maxQueryLength) {
    throw new Error(`VALIDATION_ERROR: query exceeds ${config.search.maxQueryLength} characters.`);
  }
  const sort = input.sort ?? "NEWEST";
  if (!SEARCH_SORTS.includes(sort)) throw new Error("VALIDATION_ERROR: Invalid sort.");
  if (input.condition != null && !CONDITIONS.includes(input.condition)) {
    throw new Error("VALIDATION_ERROR: Invalid condition filter.");
  }
  if (input.fulfilmentOption != null && !FULFILMENT.includes(input.fulfilmentOption)) {
    throw new Error("VALIDATION_ERROR: Invalid fulfilment_option filter.");
  }
  const first = input.first == null ? config.search.defaultPageSize : Number(input.first);
  if (!Number.isInteger(first) || first < 1 || first > config.search.maxPageSize) {
    throw new Error("VALIDATION_ERROR: first must be between 1 and 100.");
  }
  return {
    query: rawQuery || null,
    categorySlug: typeof input.categorySlug === "string" ? input.categorySlug.trim() || null : null,
    condition: input.condition ?? null,
    fulfilmentOption: input.fulfilmentOption ?? null,
    sort,
    first,
    after: input.after ?? null,
  };
}

function mapPublic(row: any): PublicSearchListing {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    condition: row.condition,
    fulfilmentOption: row.fulfilment_option,
    currency: row.currency,
    startingPriceMinor: String(row.starting_price_minor),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    category: {
      id: row.c_id,
      name: row.c_name,
      slug: row.c_slug,
      isPlaceholder: row.c_is_placeholder,
    },
    // No media files and no storage keys are exposed by search results.
    media: [],
  };
}

function cursorFor(sort: SearchSort, row: any): string {
  if (sort === "NEWEST") {
    return encodeCursor(sort, { id: row.id, publishedAt: new Date(row.published_at).toISOString() });
  }
  if (sort === "PRICE_ASC" || sort === "PRICE_DESC") {
    return encodeCursor(sort, { id: row.id, priceMinor: String(row.starting_price_minor) });
  }
  return encodeCursor(sort, {
    id: row.id,
    rank: Number(row.search_rank),
    publishedAt: new Date(row.published_at).toISOString(),
  });
}

async function categoryExists(categorySlug: string): Promise<string | null> {
  const res = await query(`SELECT id FROM categories WHERE slug = $1 AND is_active = true`, [categorySlug]);
  return (res.rowCount ?? 0) > 0 ? (res.rows[0].id as string) : null;
}

async function categoryHasPublished(categoryId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM listings WHERE category_id = $1 AND status = 'published' AND published_at IS NOT NULL LIMIT 1`,
    [categoryId]
  );
  return (res.rowCount ?? 0) > 0;
}

/** Public search: only published listings, keyset pagination, parameter-bound SQL only. */
export async function searchListings(input: SearchListingsInput): Promise<SearchResult> {
  const v = normalizeSearchInput(input);
  let categoryId: string | null = null;
  if (v.categorySlug) {
    categoryId = await categoryExists(v.categorySlug);
    if (!categoryId) throw new Error("NOT_FOUND: Category not found.");
  }

  // $1 is always the plainto_tsquery text (empty when no query).
  const params: any[] = [v.query ?? ""];
  let where = `WHERE l.status = 'published' AND l.published_at IS NOT NULL`;
  if (v.query) where += ` AND l.search_vector @@ plainto_tsquery('simple', $1)`;
  if (categoryId) {
    params.push(categoryId);
    where += ` AND l.category_id = $${params.length}`;
  }
  if (v.condition) {
    params.push(v.condition);
    where += ` AND l.condition = $${params.length}`;
  }
  if (v.fulfilmentOption) {
    params.push(v.fulfilmentOption);
    where += ` AND l.fulfilment_option = $${params.length}`;
  }

  const inner = `
    SELECT l.*, c.id AS c_id, c.name AS c_name, c.slug AS c_slug, c.is_placeholder AS c_is_placeholder,
           ts_rank(l.search_vector, plainto_tsquery('simple', $1)) AS search_rank
    FROM listings l
    JOIN categories c ON c.id = l.category_id
    ${where}
  `;

  let order: string;
  let cursorWhere = "";
  if (v.after) {
    const k = decodeCursor(v.sort, v.after);
    if (v.sort === "NEWEST") {
      params.push(k.publishedAt, k.id);
      cursorWhere = `WHERE (t.published_at, t.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      order = `ORDER BY t.published_at DESC, t.id DESC`;
    } else if (v.sort === "PRICE_ASC") {
      params.push(k.priceMinor, k.id);
      cursorWhere = `WHERE (t.starting_price_minor, t.id) > ($${params.length - 1}::bigint, $${params.length}::uuid)`;
      order = `ORDER BY t.starting_price_minor ASC, t.id ASC`;
    } else if (v.sort === "PRICE_DESC") {
      params.push(k.priceMinor, k.id);
      cursorWhere = `WHERE (t.starting_price_minor, t.id) < ($${params.length - 1}::bigint, $${params.length}::uuid)`;
      order = `ORDER BY t.starting_price_minor DESC, t.id DESC`;
    } else {
      params.push(k.rank, k.publishedAt, k.id);
      cursorWhere = `WHERE (t.search_rank, t.published_at, t.id) < ($${params.length - 2}::real, $${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      order = `ORDER BY t.search_rank DESC, t.published_at DESC, t.id DESC`;
    }
  } else if (v.sort === "NEWEST") {
    order = `ORDER BY t.published_at DESC, t.id DESC`;
  } else if (v.sort === "PRICE_ASC") {
    order = `ORDER BY t.starting_price_minor ASC, t.id ASC`;
  } else if (v.sort === "PRICE_DESC") {
    order = `ORDER BY t.starting_price_minor DESC, t.id DESC`;
  } else {
    // Only RELEVANCE uses ts_rank; NEWEST and price sorts ignore rank.
    order = `ORDER BY t.search_rank DESC, t.published_at DESC, t.id DESC`;
  }

  params.push(v.first + 1);
  const sql = `SELECT t.* FROM (${inner}) t ${cursorWhere} ${order} LIMIT $${params.length}`;
  const res = await query(sql, params);
  const hasMore = res.rows.length > v.first;
  const rows = hasMore ? res.rows.slice(0, v.first) : res.rows;
  const items = rows.map(mapPublic);
  let noResultsReason: NoResultsReason = "NONE";
  if (items.length === 0) {
    if (categoryId && (await categoryHasPublished(categoryId))) noResultsReason = "NO_MATCHES";
    else if (categoryId) noResultsReason = "CATEGORY_EMPTY";
    else noResultsReason = "NO_MATCHES";
  }
  return {
    items,
    endCursor: rows.length ? cursorFor(v.sort, rows[rows.length - 1]) : null,
    hasMore,
    noResultsReason,
  };
}

/** Thin wrapper: category browse. Unknown or inactive category slug returns NOT_FOUND. */
export async function listPublishedByCategory(categorySlug: string, input: SearchListingsInput = {}): Promise<SearchResult> {
  const slug = (categorySlug || "").trim();
  if (!slug || !(await categoryExists(slug))) throw new Error("NOT_FOUND: Category not found.");
  return searchListings({ ...input, categorySlug: slug });
}
