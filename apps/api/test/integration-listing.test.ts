import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { grantRole } from "../src/auth/service.js";
import { schema } from "../src/graphql/schema.js";

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

describe("catalogue/listings (Slice 3b) — moderation", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  async function setupPendingListing(sellerEmail: string) {
    const seller = await makeApprovedSeller(sellerEmail);
    const categoryId = await getPlaceholderCategoryId();
    const created = await gql({
      query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id slug status } }`,
      variables: { input: baseListingInput(categoryId) },
      cookie: seller.cookie,
    });
    const listingId = created.body.data.createListingDraft.id;
    await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
    const staff = await registerVerifyLogin(`mod-${Date.now()}-${Math.random()}@example.com`);
    await grantRole(staff.userId, "moderator", staff.userId);
    return { seller, staff, listingId, slug: created.body.data.createListingDraft.slug };
  }

  it("moderator approves pending_review listing; one audit row written", async () => {
    const { staff, listingId } = await setupPendingListing(`ap-${Date.now()}-${Math.random()}@example.com`);
    const res = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status publishedAt } }`, variables: { id: listingId }, cookie: staff.cookie });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.approveListing.status).toBe("published");
    expect(res.body.data.approveListing.publishedAt).toBeTruthy();
    const auditRes = await query(`SELECT action FROM audit_logs WHERE target_type='listing' AND target_id=$1 AND action='listing.approved'`, [listingId]);
    expect(auditRes.rowCount ?? 0).toBe(1);
  });

  it("reject without reason -> VALIDATION_ERROR", async () => {
    const { staff, listingId } = await setupPendingListing(`rj-${Date.now()}-${Math.random()}@example.com`);
    const res = await gql({ query: `mutation($id:ID!, $reason:String){ rejectListing(id:$id, reason:$reason){ id status } }`, variables: { id: listingId, reason: null }, cookie: staff.cookie });
    expect(res.body.errors?.[0]?.message || "").toContain("VALIDATION_ERROR");
  });

  it("reject with whitespace-only reason -> VALIDATION_ERROR", async () => {
    const { staff, listingId } = await setupPendingListing(`rjw-${Date.now()}-${Math.random()}@example.com`);
    const res = await gql({ query: `mutation($id:ID!, $reason:String){ rejectListing(id:$id, reason:$reason){ id status } }`, variables: { id: listingId, reason: "   " }, cookie: staff.cookie });
    expect(res.body.errors?.[0]?.message || "").toContain("VALIDATION_ERROR");
  });

  it("pause requires reason; resume returns to published", async () => {
    const { staff, listingId } = await setupPendingListing(`pp-${Date.now()}-${Math.random()}@example.com`);
    const approve = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
    expect(approve.body.data.approveListing.status).toBe("published");
    const pauseNoReason = await gql({ query: `mutation($id:ID!, $reason:String){ pauseListing(id:$id, reason:$reason){ id status } }`, variables: { id: listingId, reason: "" }, cookie: staff.cookie });
    expect(pauseNoReason.body.errors?.[0]?.message || "").toContain("VALIDATION_ERROR");
    const pause = await gql({ query: `mutation($id:ID!, $reason:String){ pauseListing(id:$id, reason:$reason){ id status } }`, variables: { id: listingId, reason: "weather" }, cookie: staff.cookie });
    expect(pause.body.data.pauseListing.status).toBe("paused");
    const resume = await gql({ query: `mutation($id:ID!){ resumeListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
    expect(resume.body.data.resumeListing.status).toBe("published");
  });

  it("remove works from published and from paused", async () => {
    const { staff, listingId } = await setupPendingListing(`rm-${Date.now()}-${Math.random()}@example.com`);
    const approve = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
    expect(approve.body.data.approveListing.status).toBe("published");
    const remPublished = await gql({ query: `mutation($id:ID!, $reason:String){ removeListing(id:$id, reason:$reason){ id status } }`, variables: { id: listingId, reason: "sold" }, cookie: staff.cookie });
    expect(remPublished.body.data.removeListing.status).toBe("removed");

    const second = await setupPendingListing(`rm2-${Date.now()}-${Math.random()}@example.com`);
    const approve2 = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: second.listingId }, cookie: second.staff.cookie });
    expect(approve2.body.data.approveListing.status).toBe("published");
    const pause2 = await gql({ query: `mutation($id:ID!, $reason:String){ pauseListing(id:$id, reason:$reason){ id status } }`, variables: { id: second.listingId, reason: "hold" }, cookie: second.staff.cookie });
    expect(pause2.body.data.pauseListing.status).toBe("paused");
    const remPaused = await gql({ query: `mutation($id:ID!, $reason:String){ removeListing(id:$id, reason:$reason){ id status } }`, variables: { id: second.listingId, reason: "held too long" }, cookie: second.staff.cookie });
    expect(remPaused.body.data.removeListing.status).toBe("removed");
  });

  it("seller cannot call any moderation mutation (FORBIDDEN)", async () => {
    const { seller, listingId } = await setupPendingListing(`sf-${Date.now()}-${Math.random()}@example.com`);
    const approve = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
    expect(approve.body.errors?.[0]?.message || "").toContain("FORBIDDEN");
    const rej = await gql({ query: `mutation($id:ID!, $reason:String){ rejectListing(id:$id, reason:$reason){ id status } }`, variables: { id: listingId, reason: "no" }, cookie: seller.cookie });
    expect(rej.body.errors?.[0]?.message || "").toContain("FORBIDDEN");
    const list = await gql({ query: `query{ pendingListingReviews { items { id } } }`, cookie: seller.cookie });
    expect(list.body.errors?.[0]?.message || "").toContain("FORBIDDEN");
  });

  it("buyer cannot call any moderation mutation (FORBIDDEN)", async () => {
    const buyer = await registerVerifyLogin(`bdy-${Date.now()}-${Math.random()}@example.com`);
    const { listingId } = await setupPendingListing(`bdy2-${Date.now()}-${Math.random()}@example.com`);
    const approve = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: buyer.cookie });
    expect(approve.body.errors?.[0]?.message || "").toContain("FORBIDDEN");
  });

  it("moderator cannot moderate own seller listing (FORBIDDEN)", async () => {
    const seller = await makeApprovedSeller(`own-${Date.now()}-${Math.random()}@example.com`);
    await grantRole(seller.userId, "moderator", seller.userId);
    const categoryId = await getPlaceholderCategoryId();
    const created = await gql({ query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id slug status } }`, variables: { input: baseListingInput(categoryId) }, cookie: seller.cookie });
    const listingId = created.body.data.createListingDraft.id;
    await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
    const res = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
    expect(res.body.errors?.[0]?.message || "").toContain("FORBIDDEN");
  });

  it("concurrent approve of same listing: one success, one INVALID_LISTING_TRANSITION", async () => {
    const { staff, listingId } = await setupPendingListing(`cc-${Date.now()}-${Math.random()}@example.com`);
    const p1 = gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
    const p2 = gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
    const [r1, r2] = await Promise.all([p1, p2]);
    const okResults = [r1, r2].filter((r) => !r.body.errors);
    expect(okResults.length).toBe(1);
    const failed = [r1, r2].find((r) => r.body.errors);
    expect(failed?.body.errors?.[0]?.message || "").toContain("INVALID_LISTING_TRANSITION");
  });

  it("approve already published listing -> INVALID_LISTING_TRANSITION, no duplicate audit row", async () => {
    const { staff, listingId } = await setupPendingListing(`ap2-${Date.now()}-${Math.random()}@example.com`);
    const approve1 = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
    expect(approve1.body.data.approveListing.status).toBe("published");
    const approve2 = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: listingId }, cookie: staff.cookie });
    expect(approve2.body.errors?.[0]?.message || "").toContain("INVALID_LISTING_TRANSITION");
    const auditRes = await query(`SELECT action FROM audit_logs WHERE target_type='listing' AND target_id=$1 AND action='listing.approved'`, [listingId]);
    expect(auditRes.rowCount ?? 0).toBe(1);
  });

  it("listing(slug) returns NOT_FOUND for draft, pending_review, rejected, paused, removed; returns data for published", async () => {
    const seller = await makeApprovedSeller(`vis-${Date.now()}-${Math.random()}@example.com`);
    const staff = await registerVerifyLogin(`vismod-${Date.now()}-${Math.random()}@example.com`);
    await grantRole(staff.userId, "moderator", staff.userId);
    const categoryId = await getPlaceholderCategoryId();
    const sellerCookie = seller.cookie;
    const staffCookie = staff.cookie;

    const create = async (title: string) => {
      const created = await gql({ query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id slug status } }`, variables: { input: { ...baseListingInput(categoryId), title } }, cookie: sellerCookie });
      return { id: created.body.data.createListingDraft.id, slug: created.body.data.createListingDraft.slug };
    };
    const submit = async (id: string) => (await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id }, cookie: sellerCookie })).body.data.submitListingForReview;
    const approve = async (id: string) => (await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id }, cookie: staffCookie })).body.data.approveListing;
    const reject = async (id: string, reason: string) => (await gql({ query: `mutation($id:ID!, $reason:String){ rejectListing(id:$id, reason:$reason){ id status } }`, variables: { id, reason }, cookie: staffCookie })).body.data.rejectListing;
    const pause = async (id: string, reason: string) => (await gql({ query: `mutation($id:ID!, $reason:String){ pauseListing(id:$id, reason:$reason){ id status } }`, variables: { id, reason }, cookie: staffCookie })).body.data.pauseListing;
    const remove = async (id: string, reason: string) => (await gql({ query: `mutation($id:ID!, $reason:String){ removeListing(id:$id, reason:$reason){ id status } }`, variables: { id, reason }, cookie: staffCookie })).body.data.removeListing;
    const pub = async (slug: string) => gql({ query: `query($s:String!){ listing(slug:$s){ slug title } }`, variables: { s: slug } });

    const draft = await create("Draft Visibility Item");
    expect((await pub(draft.slug)).body.errors?.[0]?.message || "").toContain("NOT_FOUND");

    const pend = await create("Pending Visibility Item");
    await submit(pend.id);
    expect((await pub(pend.slug)).body.errors?.[0]?.message || "").toContain("NOT_FOUND");
    const rej = await create("Rejected Visibility Item");
    await submit(rej.id);
    await reject(rej.id, "not good");
    expect((await pub(rej.slug)).body.errors?.[0]?.message || "").toContain("NOT_FOUND");

    const pau = await create("Paused Visibility Item");
    await submit(pau.id);
    await approve(pau.id);
    await pause(pau.id, "hold");
    expect((await pub(pau.slug)).body.errors?.[0]?.message || "").toContain("NOT_FOUND");

    const rem = await create("Removed Visibility Item");
    await submit(rem.id);
    await approve(rem.id);
    await remove(rem.id, "sold");
    expect((await pub(rem.slug)).body.errors?.[0]?.message || "").toContain("NOT_FOUND");

    const pubOk = await create("Published Visibility Item");
    await submit(pubOk.id);
    await approve(pubOk.id);
    const pubRes = await pub(pubOk.slug);
    expect(pubRes.body.errors).toBeUndefined();
    expect(pubRes.body.data.listing.slug).toBe(pubOk.slug);
  });

  it("ListingPublic schema contains no private fields", async () => {
    const pubType: any = (schema as any).getType("PublicListing");
    const fields = Object.keys(pubType.getFields());
    expect(fields).not.toContain("storageKey");
    expect(fields).not.toContain("rejectionReason");
    expect(fields).not.toContain("legalName");
    expect(fields).not.toContain("reviewedBy");
    expect(fields).not.toContain("sellerId");
    expect(fields).toContain("slug");
    expect(fields).toContain("title");
  });

  it("pendingListingReviews is staff-only; two pages have no duplicate IDs", async () => {
    const staff = await registerVerifyLogin(`modq-${Date.now()}-${Math.random()}@example.com`);
    await grantRole(staff.userId, "moderator", staff.userId);
    const seller = await makeApprovedSeller(`pq-${Date.now()}-${Math.random()}@example.com`);
    const categoryId = await getPlaceholderCategoryId();
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const created = await gql({
        query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id slug status } }`,
        variables: { input: { ...baseListingInput(categoryId), title: `Pending Queue Item ${i} ${Date.now()}` } },
        cookie: seller.cookie,
      });
      const listingId = created.body.data.createListingDraft.id;
      await gql({ query: `mutation($id:ID!){ submitListingForReview(id:$id){ id status } }`, variables: { id: listingId }, cookie: seller.cookie });
      ids.push(listingId);
    }
    const page1 = await gql({ query: `query($first:Int){ pendingListingReviews(first:$first){ items { id } endCursor } }`, variables: { first: 2 }, cookie: staff.cookie });
    expect(page1.body.errors).toBeUndefined();
    expect(page1.body.data.pendingListingReviews.items.length).toBe(2);
    const page2 = await gql({ query: `query($first:Int, $after:String){ pendingListingReviews(first:$first, after:$after){ items { id } endCursor } }`, variables: { first: 2, after: page1.body.data.pendingListingReviews.endCursor }, cookie: staff.cookie });
    expect(page2.body.errors).toBeUndefined();
    const page2Ids = (page2.body.data.pendingListingReviews.items || []).map((i: any) => i.id);
    expect(page2Ids).not.toContain(page1.body.data.pendingListingReviews.items[0].id);
    expect(page2Ids).not.toContain(page1.body.data.pendingListingReviews.items[1].id);

    const buyer = await registerVerifyLogin(`pqb-${Date.now()}-${Math.random()}@example.com`);
    const forbiddenQ = await gql({ query: `query{ pendingListingReviews { items { id } } }`, cookie: buyer.cookie });
    expect(forbiddenQ.body.errors?.[0]?.message || "").toContain("FORBIDDEN");
  });

  it("every moderation resolver writes an audit row on success (enumerate the resolvers in the test, do not sample)", async () => {
    const cases: Array<{ name: string; action: string; run: () => Promise<any> }> = [
      { name: "approveListing", action: "listing.approved", run: async () => {
        const setup = await setupPendingListing(`ea-${Date.now()}-${Math.random()}@example.com`);
        const res = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: setup.listingId }, cookie: setup.staff.cookie });
        expect(res.body.errors).toBeUndefined();
        return setup.listingId;
      } },
      { name: "rejectListing", action: "listing.rejected", run: async () => {
        const setup = await setupPendingListing(`eb-${Date.now()}-${Math.random()}@example.com`);
        const res = await gql({ query: `mutation($id:ID!, $reason:String){ rejectListing(id:$id, reason:$reason){ id status } }`, variables: { id: setup.listingId, reason: "quality" }, cookie: setup.staff.cookie });
        expect(res.body.errors).toBeUndefined();
        return setup.listingId;
      } },
      { name: "pauseListing", action: "listing.paused", run: async () => {
        const setup = await setupPendingListing(`ec-${Date.now()}-${Math.random()}@example.com`);
        const approve = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: setup.listingId }, cookie: setup.staff.cookie });
        const res = await gql({ query: `mutation($id:ID!, $reason:String){ pauseListing(id:$id, reason:$reason){ id status } }`, variables: { id: setup.listingId, reason: "hold" }, cookie: setup.staff.cookie });
        expect(approve.body.data.approveListing.status).toBe("published");
        expect(res.body.data.pauseListing.status).toBe("paused");
        return setup.listingId;
      } },
      { name: "resumeListing", action: "listing.resumed", run: async () => {
        const setup = await setupPendingListing(`ed-${Date.now()}-${Math.random()}@example.com`);
        const approve = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: setup.listingId }, cookie: setup.staff.cookie });
        const pause = await gql({ query: `mutation($id:ID!, $reason:String){ pauseListing(id:$id, reason:$reason){ id status } }`, variables: { id: setup.listingId, reason: "hold" }, cookie: setup.staff.cookie });
        const res = await gql({ query: `mutation($id:ID!){ resumeListing(id:$id){ id status } }`, variables: { id: setup.listingId }, cookie: setup.staff.cookie });
        expect(approve.body.data.approveListing.status).toBe("published");
        expect(pause.body.data.pauseListing.status).toBe("paused");
        expect(res.body.data.resumeListing.status).toBe("published");
        return setup.listingId;
      } },
      { name: "removeListing", action: "listing.removed", run: async () => {
        const setup = await setupPendingListing(`ee-${Date.now()}-${Math.random()}@example.com`);
        const approve = await gql({ query: `mutation($id:ID!){ approveListing(id:$id){ id status } }`, variables: { id: setup.listingId }, cookie: setup.staff.cookie });
        const res = await gql({ query: `mutation($id:ID!, $reason:String){ removeListing(id:$id, reason:$reason){ id status } }`, variables: { id: setup.listingId, reason: "sold" }, cookie: setup.staff.cookie });
        expect(approve.body.data.approveListing.status).toBe("published");
        expect(res.body.data.removeListing.status).toBe("removed");
        return setup.listingId;
      } },
    ];
    for (const c of cases) {
      const listingId = await c.run();
      const auditRes = await query(`SELECT action FROM audit_logs WHERE target_type='listing' AND target_id=$1 AND action=$2`, [listingId, c.action]);
      expect(auditRes.rowCount ?? 0).toBe(1);
    }
  }, 120000);
});
