import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { graphql } from "graphql";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { grantRole } from "../src/auth/service.js";
import { schema } from "../src/graphql/schema.js";
import {
  searchListings,
  listPublishedByCategory,
  type SearchSort,
} from "../src/catalogue/search.js";

const app = createApp();

async function gql(opts: { query: string; variables?: any; cookie?: string }) {
  const r = request(app).post("/graphql").set("content-type", "application/json");
  if (opts.cookie) r.set("Cookie", opts.cookie);
  return r.send({ query: opts.query, variables: opts.variables });
}

function getSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

async function resetDb() {
  // Keep the seeded placeholder categories intact.
  await query(
    `TRUNCATE TABLE audit_logs, password_reset_tokens, email_verification_tokens, sessions, user_roles, user_profiles,
     listing_media, listings, seller_verifications, seller_profiles, users RESTART IDENTITY CASCADE`
  );
  // Remove categories created by tests (seeded ones have placeholder-general etc.).
  await query(`DELETE FROM categories WHERE slug NOT LIKE 'placeholder-%'`);
}

async function registerVerifyLogin(email: string) {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const { userId, verificationToken } = reg.body.data.register;
  await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: verificationToken } });
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId: userId as string, cookie: getSetCookie(login) };
}

const SELLER_PROFILE = {
  sellerType: "individual",
  displayName: "Search Seller",
  publicStoreName: "Search Store",
  legalName: "Restricted Legal Name For Search Test",
  provinceCode: "ON",
};

async function makeStaff() {
  const staff = await registerVerifyLogin(`staff-${randomUUID()}@example.com`);
  await grantRole(staff.userId, "moderator", staff.userId);
  return staff;
}

async function makeApprovedSeller() {
  const seller = await registerVerifyLogin(`seller-${randomUUID()}@example.com`);
  await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: SELLER_PROFILE }, cookie: seller.cookie });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const staff = await makeStaff();
  const pending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "under_review" } }, cookie: staff.cookie });
  await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "approved" } }, cookie: staff.cookie });
  return seller;
}

async function placeholderCategory() {
  const res = await query(`SELECT id, slug FROM categories WHERE is_placeholder = true ORDER BY sort_order LIMIT 1`);
  return { id: res.rows[0].id as string, slug: res.rows[0].slug as string };
}

async function createDraft(seller: { cookie: string }, categoryId: string, opts: {
  title: string;
  description?: string;
  price?: string;
  condition?: string;
  fulfilmentOption?: string;
}) {
  const created = await gql({
    query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id slug } }`,
    variables: {
      input: {
        categoryId,
        title: opts.title,
        description: opts.description ?? "A search test listing.",
        condition: opts.condition ?? "used",
        fulfilmentOption: opts.fulfilmentOption ?? "both",
        currency: "CAD",
        startingPriceMinor: opts.price ?? "2500",
        requestedStartsAt: null,
        requestedEndsAt: null,
      },
    },
    cookie: seller.cookie,
  });
  if (created.body.errors) throw new Error(JSON.stringify(created.body.errors));
  return created.body.data.createListingDraft as { id: string; slug: string };
}

async function publishListing(seller: { cookie: string }, staff: { cookie: string }, categoryId: string, opts: {
  title: string;
  description?: string;
  price?: string;
  condition?: string;
  fulfilmentOption?: string;
  publishedAt?: Date;
}) {
  const draft = await createDraft(seller, categoryId, opts);
  const sub = await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id } }`, variables: { id: draft.id }, cookie: seller.cookie });
  if (sub.body.errors) throw new Error(JSON.stringify(sub.body.errors));
  const approval = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: draft.id }, cookie: staff.cookie });
  if (approval.body.errors) throw new Error(JSON.stringify(approval.body.errors));
  if (opts.publishedAt) {
    await query(`UPDATE listings SET published_at=$2 WHERE id=$1`, [draft.id, opts.publishedAt]);
  }
  return draft;
}

async function createCategory(slug: string, isActive = true) {
  const res = await query(
    `INSERT INTO categories (name, slug, is_active, sort_order, is_placeholder) VALUES ($1,$2,$3,999,false) RETURNING id`,
    [`Test Category ${slug}`, slug, isActive]
  );
  return res.rows[0].id as string;
}

describe("catalogue search (Slice 5)", () => {
  let seller: Awaited<ReturnType<typeof makeApprovedSeller>>;
  let staff: Awaited<ReturnType<typeof makeStaff>>;
  let category: Awaited<ReturnType<typeof placeholderCategory>>;

  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
    seller = await makeApprovedSeller();
    staff = await makeStaff();
    category = await placeholderCategory();
  });

  it("draft, pending_review, rejected, paused, and removed listings are never returned by any search or category query", async () => {
    await createDraft(seller, category.id, { title: "Rare Draft Item" });
    const pending = await createDraft(seller, category.id, { title: "Rare Pending Item" });
    await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id } }`, variables: { id: pending.id }, cookie: seller.cookie });
    const rejected = await createDraft(seller, category.id, { title: "Rare Rejected Item" });
    await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id } }`, variables: { id: rejected.id }, cookie: seller.cookie });
    await gql({ query: `mutation($id:ID!, $r:String){ rejectListing(id:$id, reason:$r){ id } }`, variables: { id: rejected.id, r: "test" }, cookie: staff.cookie });
    const paused = await publishListing(seller, staff, category.id, { title: "Rare Paused Item" });
    const pauseRes = await gql({ query: `mutation($id:ID!, $r:String){ pauseListing(id:$id, reason:$r){ id } }`, variables: { id: paused.id, r: "test" }, cookie: staff.cookie });
    if (pauseRes.body.errors) throw new Error(`pause failed: ${JSON.stringify(pauseRes.body.errors)}`);
    const removed = await publishListing(seller, staff, category.id, { title: "Rare Removed Item" });
    await gql({ query: `mutation($id:ID!, $r:String){ removeListing(id:$id, reason:$r){ id } }`, variables: { id: removed.id, r: "test" }, cookie: staff.cookie });
    const visible = await publishListing(seller, staff, category.id, { title: "Rare Visible Item" });

    const search = await searchListings({ query: "Rare", sort: "NEWEST" });
    expect(search.items.map((i) => i.slug)).toEqual([visible.slug]);
    const browse = await listPublishedByCategory(category.slug, { query: "Rare" });
    expect(browse.items.map((i) => i.slug)).toEqual([visible.slug]);
  });

  it("a published listing matching the query is returned; a non-matching query returns NO_MATCHES", async () => {
    const listing = await publishListing(seller, staff, category.id, { title: "Unique Widget", description: "A useful tool." });
    const hit = await searchListings({ query: "Widget" });
    expect(hit.items.map((i) => i.slug)).toEqual([listing.slug]);
    expect(hit.noResultsReason).toBe("NONE");
    const miss = await searchListings({ query: "Zzzznotfound" });
    expect(miss.items).toEqual([]);
    expect(miss.noResultsReason).toBe("NO_MATCHES");
  });

  it("category slug with no published listings returns CATEGORY_EMPTY", async () => {
    const emptySlug = `empty-${randomUUID()}`;
    await createCategory(emptySlug);
    const result = await listPublishedByCategory(emptySlug);
    expect(result.items).toEqual([]);
    expect(result.noResultsReason).toBe("CATEGORY_EMPTY");
  });

  it("unknown or inactive category slug returns NOT_FOUND", async () => {
    await expect(listPublishedByCategory(`missing-${randomUUID()}`)).rejects.toThrow(/NOT_FOUND/);
    const inactiveSlug = `inactive-${randomUUID()}`;
    await createCategory(inactiveSlug, false);
    await expect(listPublishedByCategory(inactiveSlug)).rejects.toThrow(/NOT_FOUND/);
  });

  it("NEWEST orders by published_at then id; PRICE_ASC and PRICE_DESC order correctly, ties broken by id", async () => {
    const base = Date.parse("2026-11-16T12:00:00.000Z");
    const a = await publishListing(seller, staff, category.id, { title: "Order A", price: "3000", publishedAt: new Date(base) });
    const b = await publishListing(seller, staff, category.id, { title: "Order B", price: "2000", publishedAt: new Date(base + 1000) });
    const c = await publishListing(seller, staff, category.id, { title: "Order C", price: "2000", publishedAt: new Date(base + 2000) });

    const newest = await searchListings({ sort: "NEWEST" });
    expect(newest.items.map((i) => i.slug)).toEqual([c.slug, b.slug, a.slug]);
    const priceAsc = await searchListings({ sort: "PRICE_ASC" });
    // price 2000 tie broken by id ASC; b/c ids are UUIDs, so compare against DB order.
    const ascRows = await query(`SELECT slug FROM listings WHERE status='published' ORDER BY starting_price_minor ASC, id ASC`);
    expect(priceAsc.items.map((i) => i.slug)).toEqual(ascRows.rows.map((r: any) => r.slug));
    const priceDesc = await searchListings({ sort: "PRICE_DESC" });
    const descRows = await query(`SELECT slug FROM listings WHERE status='published' ORDER BY starting_price_minor DESC, id DESC`);
    expect(priceDesc.items.map((i) => i.slug)).toEqual(descRows.rows.map((r: any) => r.slug));
    expect(priceDesc.items[0].startingPriceMinor).toBe("3000");
  });

  it("RELEVANCE ranks a listing with the term in the title above one with it only in the description", async () => {
    const inDescription = await publishListing(seller, staff, category.id, { title: "Plain Object", description: "Special Gizmo inside." });
    const inTitle = await publishListing(seller, staff, category.id, { title: "Gizmo Deluxe", description: "Nothing special here." });
    const result = await searchListings({ query: "Gizmo", sort: "RELEVANCE" });
    expect(result.items.map((i) => i.slug)).toEqual([inTitle.slug, inDescription.slug]);
  });

  it("filters condition and fulfilmentOption narrow results and combine with query", async () => {
    await publishListing(seller, staff, category.id, { title: "Filter New", condition: "new", fulfilmentOption: "shipping" });
    await publishListing(seller, staff, category.id, { title: "Filter Used", condition: "used", fulfilmentOption: "local_pickup" });
    const byCondition = await searchListings({ query: "Filter", condition: "new" });
    expect(byCondition.items.map((i) => i.title)).toEqual(["Filter New"]);
    const byFulfilment = await searchListings({ query: "Filter", fulfilmentOption: "local_pickup" });
    expect(byFulfilment.items.map((i) => i.title)).toEqual(["Filter Used"]);
    const none = await searchListings({ query: "Filter", condition: "new", fulfilmentOption: "local_pickup" });
    expect(none.items).toEqual([]);
    expect(none.noResultsReason).toBe("NO_MATCHES");
  });

  it("keyset pagination: walking all pages returns each published listing exactly once, in order", async () => {
    const base = Date.parse("2026-11-16T12:00:00.000Z");
    const created = [];
    for (let i = 0; i < 5; i++) {
      created.push(await publishListing(seller, staff, category.id, { title: `Page Item ${i}`, publishedAt: new Date(base + i * 1000) }));
    }
    const seen: string[] = [];
    let after: string | null = null;
    for (let page = 0; page < 10; page++) {
      const result = await searchListings({ sort: "NEWEST", first: 2, after });
      seen.push(...result.items.map((i) => i.slug));
      after = result.endCursor;
      if (!result.hasMore) break;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(seen).toEqual(created.slice().reverse().map((i) => i.slug));
  });

  it("cursor stability: publishing a new listing between pages adds no duplicates and skips nothing", async () => {
    const base = Date.parse("2026-11-16T12:00:00.000Z");
    const created = [];
    for (let i = 0; i < 5; i++) {
      created.push(await publishListing(seller, staff, category.id, { title: `Stable ${i}`, publishedAt: new Date(base + i * 1000) }));
    }
    const firstPage = await searchListings({ sort: "NEWEST", first: 2 });
    await publishListing(seller, staff, category.id, { title: "Stable Late", publishedAt: new Date(base + 10_000) });
    const secondPage = await searchListings({ sort: "NEWEST", first: 2, after: firstPage.endCursor });
    const thirdPage = await searchListings({ sort: "NEWEST", first: 2, after: secondPage.endCursor });
    const seen = [...firstPage.items, ...secondPage.items, ...thirdPage.items].map((i) => i.slug);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(created.slice().reverse().map((i) => i.slug));
    expect(seen).not.toContain("stable-late");
  });

  it("a listing paused between pages does not appear on the next page", async () => {
    const base = Date.parse("2026-11-16T12:00:00.000Z");
    const first = await publishListing(seller, staff, category.id, { title: "Pause First", publishedAt: new Date(base) });
    const second = await publishListing(seller, staff, category.id, { title: "Pause Second", publishedAt: new Date(base + 1000) });
    const page1 = await searchListings({ sort: "NEWEST", first: 1 });
    expect(page1.items.map((i) => i.slug)).toEqual([second.slug]);
    const pauseRes = await gql({ query: `mutation($id:ID!, $r:String){ pauseListing(id:$id, reason:$r){ id } }`, variables: { id: first.id, r: "removed from sale" }, cookie: staff.cookie });
    if (pauseRes.body.errors) throw new Error(`pause failed: ${JSON.stringify(pauseRes.body.errors)}`);
    const page2 = await searchListings({ sort: "NEWEST", first: 1, after: page1.endCursor });
    expect(page2.items.map((i) => i.slug)).toEqual([]);
    expect(await query(`SELECT status FROM listings WHERE id=$1`, [first.id])).toMatchObject({ rows: [{ status: "paused" }] });
  });

  it("public result contains no private fields (schema introspection plus runtime field check)", async () => {
    await publishListing(seller, staff, category.id, { title: "Private Check Item" });
    const introspection = await graphql({
      schema,
      source: ` query { __type(name: "PublicListing") { fields { name } } }`,
    });
    const fields = (introspection.data as any).__type.fields.map((f: any) => f.name);
    for (const forbidden of ["storageKey", "rejectionReason", "legalName", "reviewedBy", "sellerId", "sellerProfileId", "verificationStatus"]) {
      expect(fields).not.toContain(forbidden);
    }
    const result = await searchListings({ query: "Private" });
    const serialized = JSON.stringify(result.items);
    for (const forbidden of ["Restricted Legal Name For Search Test", "rejectionReason", "storageKey", "sellerProfileId", "verifiedBy"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("no SQL now() or Date.now() in search source", () => {
    const source = readFileSync(fileURLToPath(new URL("../src/catalogue/search.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/Date\.now\(\)/);
    expect(source).not.toMatch(/\bnow\(\)/);
  });

  it("honours the configured query limit for search input", async () => {
    await expect(searchListings({ query: "x".repeat(201) })).rejects.toThrow(/VALIDATION_ERROR/);
  });

  it("sorts by each supported sort key through GraphQL searchListings", async () => {
    await publishListing(seller, staff, category.id, { title: "GraphQL Item" });
    const res = await gql({
      query: `query($input: SearchListingsInput!){ searchListings(input:$input){ items { slug title } endCursor hasMore noResultsReason } }`,
      variables: { input: { query: "GraphQL", sort: "NEWEST" as SearchSort } },
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.searchListings.items).toHaveLength(1);
    expect(res.body.data.searchListings.noResultsReason).toBe("NONE");
  });
});
