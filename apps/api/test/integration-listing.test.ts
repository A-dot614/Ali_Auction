import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { grantRole } from "../src/auth/service.js";

const app = createApp();

async function gql(opts: { query: string; variables?: any; cookie?: string }) {
  const r = request(app).post("/graphql").set("content-type", "application/json");
  if (opts.cookie) r.set("Cookie", opts.cookie);
  return r.send({ query: opts.query, variables: opts.variables });
}

async function resetDb() {
  // Keep seeded categories (placeholder taxonomy) intact.
  await query(
    `TRUNCATE TABLE audit_logs, password_reset_tokens, email_verification_tokens, sessions, user_roles, user_profiles,
     listing_media, listings, seller_verifications, seller_profiles, users RESTART IDENTITY CASCADE`
  );
}

function getSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

async function registerVerifyLogin(email: string, password = "Str0ngPass!1") {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
    variables: { input: { email, password } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const { userId, verificationToken } = reg.body.data.register;
  const ver = await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: verificationToken } });
  if (ver.body.errors) throw new Error(JSON.stringify(ver.body.errors));
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId: userId as string, cookie: getSetCookie(login) };
}

async function registerLoginUnverified(email: string, password = "Str0ngPass!1") {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId } }`,
    variables: { input: { email, password } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId: reg.body.data.register.userId as string, cookie: getSetCookie(login) };
}

const SELLER_PROFILE = {
  sellerType: "individual",
  displayName: "Listing Seller",
  publicStoreName: "Store",
  legalName: "Legal",
  provinceCode: "ON",
};

async function makeApprovedSeller(email: string) {
  const seller = await registerVerifyLogin(email);
  await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: SELLER_PROFILE }, cookie: seller.cookie });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const staff = await registerVerifyLogin(`staff-${Date.now()}-${Math.random()}@example.com`);
  await grantRole(staff.userId, "moderator", staff.userId);
  const pending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "under_review" } }, cookie: staff.cookie });
  const approved = await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "approved" } }, cookie: staff.cookie });
  if (approved.body.errors) throw new Error(JSON.stringify(approved.body.errors));
  return seller;
}

async function getPlaceholderCategoryId() {
  const res = await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`);
  return res.rows[0].id as string;
}

function baseListingInput(categoryId: string) {
  return {
    categoryId,
    title: "  Vintage Maple Chair  ",
    description: "Solid wood chair in good condition.",
    condition: "used",
    fulfilmentOption: "both",
    currency: "CAD",
    startingPriceMinor: "2500",
    requestedStartsAt: null,
    requestedEndsAt: null,
  };
}

describe("catalogue/listings (Slice 3a)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("lists active categories with placeholder flag (seeded categories carry is_placeholder = true)", async () => {
    const res = await gql({ query: `query{ categories { id name slug isActive isPlaceholder } }` });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.categories.length).toBeGreaterThan(0);
    expect(res.body.data.categories.every((c: any) => c.isPlaceholder === true)).toBe(true);
    expect(res.body.data.categories.every((c: any) => /PLACEHOLDER - NOT APPROVED/.test(c.name))).toBe(true);
  });

  it("unverified email cannot create a draft (EMAIL_NOT_VERIFIED)", async () => {
    const u = await registerLoginUnverified(`unv-${Date.now()}@example.com`);
    const categoryId = await getPlaceholderCategoryId();
    const res = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: { input: baseListingInput(categoryId) },
      cookie: u.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("EMAIL_NOT_VERIFIED");
  });

  it("non-approved seller cannot create a listing draft (SELLER_NOT_APPROVED)", async () => {
    const seller = await registerVerifyLogin(`na-${Date.now()}@example.com`);
    await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: SELLER_PROFILE }, cookie: seller.cookie });
    // not submitted/approved yet
    const categoryId = await getPlaceholderCategoryId();
    const res = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: { input: baseListingInput(categoryId) },
      cookie: seller.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("SELLER_NOT_APPROVED");
  });

  it("creates/updates/submits draft, enforces ownership (NOT_FOUND), visibility, submit-twice, validations, and audit rows", async () => {
    const seller = await makeApprovedSeller(`ok-${Date.now()}@example.com`);
    const other = await makeApprovedSeller(`other-${Date.now()}@example.com`);
    const categoryId = await getPlaceholderCategoryId();

    const created = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id slug status title currency startingPriceMinor } }`,
      variables: { input: baseListingInput(categoryId) },
      cookie: seller.cookie,
    });
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createListingDraft.status).toBe("draft");
    expect(created.body.data.createListingDraft.title).toBe("Vintage Maple Chair"); // trimmed
    const listingId = created.body.data.createListingDraft.id;
    const slug = created.body.data.createListingDraft.slug;

    // Draft listing invisible to public listing(slug)
    const pubDraft = await gql({ query: `query($s:String!){ listing(slug:$s){ slug } }`, variables: { s: slug } });
    expect(pubDraft.body.errors?.[0]?.message || "").toContain("NOT_FOUND");

    // Non-owner cannot update another seller's draft; response is NOT_FOUND
    const updOther = await gql({
      query: `mutation($id:ID!, $input: ListingDraftInput!){ updateListingDraft(id:$id, input:$input){ id } }`,
      variables: { id: listingId, input: { ...baseListingInput(categoryId), title: "Hacked" } },
      cookie: other.cookie,
    });
    expect(updOther.body.errors?.[0]?.message || "").toContain("NOT_FOUND");

    // Owner update works
    const upd = await gql({
      query: `mutation($id:ID!, $input: ListingDraftInput!){ updateListingDraft(id:$id, input:$input){ id title status } }`,
      variables: { id: listingId, input: { ...baseListingInput(categoryId), title: "  Updated Title  " } },
      cookie: seller.cookie,
    });
    expect(upd.body.errors).toBeUndefined();
    expect(upd.body.data.updateListingDraft.title).toBe("Updated Title");

    // Submit twice: second call returns clean error, no duplicate row/state
    const sub1 = await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
    expect(sub1.body.data.submitListingForReview.status).toBe("pending_review");
    const sub2 = await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
    expect(sub2.body.errors?.[0]?.message || "").toMatch(/VALIDATION_ERROR|already pending/i);
    const countRes = await query(`SELECT count(*)::int as c FROM listings WHERE id=$1`, [listingId]);
    expect(countRes.rows[0].c).toBe(1);

    // Unpublished (pending_review) invisible to public
    const pubPending = await gql({ query: `query($s:String!){ listing(slug:$s){ slug } }`, variables: { s: slug } });
    expect(pubPending.body.errors?.[0]?.message || "").toContain("NOT_FOUND");

    // myListings visible to owner
    const mine = await gql({ query: `query{ myListings { items { id status } endCursor } }`, cookie: seller.cookie });
    expect(mine.body.errors).toBeUndefined();
    expect(mine.body.data.myListings.items.some((i: any) => i.id === listingId)).toBe(true);

    // Audit rows for create/update/submit
    const audit = await query(
      `SELECT action FROM audit_logs WHERE target_type='listing' AND target_id=$1 ORDER BY created_at`,
      [listingId]
    );
    const actions = audit.rows.map((r: any) => r.action);
    expect(actions).toContain("listing.created");
    expect(actions).toContain("listing.updated");
    expect(actions).toContain("listing.submitted_for_review");
  });

  it("validations: non-ASCII title trims/validates, non-CAD currency rejected, float price rejected, bad requested times rejected", async () => {
    const seller = await makeApprovedSeller(`val-${Date.now()}@example.com`);
    const categoryId = await getPlaceholderCategoryId();

    const okUnicode = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id title } }`,
      variables: { input: { ...baseListingInput(categoryId), title: "  Étagère Montréal – café  " } },
      cookie: seller.cookie,
    });
    expect(okUnicode.body.errors).toBeUndefined();
    expect(okUnicode.body.data.createListingDraft.title).toBe("Étagère Montréal – café");

    const nonCad = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: { input: { ...baseListingInput(categoryId), currency: "USD" } },
      cookie: seller.cookie,
    });
    expect(nonCad.body.errors?.[0]?.message || "").toMatch(/VALIDATION_ERROR|CAD/);

    const floatPrice = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: { input: { ...baseListingInput(categoryId), startingPriceMinor: "12.34" } },
      cookie: seller.cookie,
    });
    expect(floatPrice.body.errors?.[0]?.message || "").toMatch(/VALIDATION_ERROR|integer/);

    const badTimes = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: {
        input: {
          ...baseListingInput(categoryId),
          requestedStartsAt: "2026-10-10T10:00:00Z",
          requestedEndsAt: "2026-10-10T09:00:00Z",
        },
      },
      cookie: seller.cookie,
    });
    expect(badTimes.body.errors?.[0]?.message || "").toMatch(/VALIDATION_ERROR|requested_ends_at/);

    const equalTimes = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: {
        input: {
          ...baseListingInput(categoryId),
          requestedStartsAt: "2026-10-10T10:00:00Z",
          requestedEndsAt: "2026-10-10T10:00:00Z",
        },
      },
      cookie: seller.cookie,
    });
    expect(equalTimes.body.errors?.[0]?.message || "").toMatch(/VALIDATION_ERROR|requested_ends_at/);
  });
});
