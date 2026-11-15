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
  return { userId: userId as string, cookie: getSetCookie(login), email: email.toLowerCase(), password };
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

const PROFILE_INPUT = {
  sellerType: "individual",
  displayName: "Test Seller",
  publicStoreName: "Test Store",
  legalName: "Restricted Legal Name",
  provinceCode: "ON",
};

describe("seller profile and verification (Slice 2)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("unverified email blocks createSellerProfile with EMAIL_NOT_VERIFIED", async () => {
    const u = await registerLoginUnverified(`unv-${Date.now()}@example.com`);
    const res = await gql({
      query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`,
      variables: { input: PROFILE_INPUT },
      cookie: u.cookie,
    });
    expect(res.body.errors?.[0]?.message || "").toContain("EMAIL_NOT_VERIFIED");
    expect(res.body.data?.createSellerProfile ?? null).toBeNull();
  });

  it("creates profile/verification, enforces ownership boundaries (IDOR), and writes audit rows", async () => {
    const a = await registerVerifyLogin(`a-${Date.now()}@example.com`);
    const b = await registerVerifyLogin(`b-${Date.now()}@example.com`);

    const created = await gql({
      query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id userId sellerType displayName publicStoreName provinceCode } }`,
      variables: { input: PROFILE_INPUT },
      cookie: a.cookie,
    });
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createSellerProfile.userId).toBe(a.userId);
    expect(created.body.data.createSellerProfile.displayName).toBe("Test Seller");
    // legal_name must never be exposed
    expect(JSON.stringify(created.body.data)).not.toContain("Restricted Legal Name");

    const myA = await gql({ query: `query{ mySellerProfile { id userId displayName } mySellerVerification { status } }`, cookie: a.cookie });
    expect(myA.body.data.mySellerProfile.userId).toBe(a.userId);
    expect(myA.body.data.mySellerVerification.status).toBe("not_submitted");

    // Non-owner cannot read or update another user's seller profile (own-scoped APIs reveal nothing of A)
    const myB = await gql({ query: `query{ mySellerProfile { id userId } mySellerVerification { id } }`, cookie: b.cookie });
    expect(myB.body.data.mySellerProfile).toBeNull();
    expect(myB.body.data.mySellerVerification).toBeNull();

    const updateByB = await gql({
      query: `mutation($input: SellerProfileInput!){ updateSellerProfile(input:$input){ id } }`,
      variables: { input: { ...PROFILE_INPUT, displayName: "Hacker" } },
      cookie: b.cookie,
    });
    expect(updateByB.body.errors?.[0]?.message || "").toMatch(/NOT_FOUND/);
    const myAAfter = await gql({ query: `query{ mySellerProfile { displayName } }`, cookie: a.cookie });
    expect(myAAfter.body.data.mySellerProfile.displayName).toBe("Test Seller");

    const audit = await query(
      `SELECT action FROM audit_logs WHERE actor_user_id=$1 AND action IN ('seller.profile_created','seller.verification_status_changed')`,
      [a.userId]
    );
    expect((audit.rowCount ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it("submit re-run rejected; transitions, review rules, and audit rows enforced", async () => {
    const seller = await registerVerifyLogin(`seller-${Date.now()}@example.com`);
    await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: PROFILE_INPUT }, cookie: seller.cookie });

    const sub1 = await gql({ query: `mutation{ submitSellerVerification { status } }`, cookie: seller.cookie });
    expect(sub1.body.data.submitSellerVerification.status).toBe("submitted");
    const sub2 = await gql({ query: `mutation{ submitSellerVerification { status } }`, cookie: seller.cookie });
    expect(sub2.body.errors?.[0]?.message || "").toMatch(/VALIDATION_ERROR|already submitted/i);

    const staff = await registerVerifyLogin(`staff-${Date.now()}@example.com`);
    await grantRole(staff.userId, "moderator", staff.userId);

    const pending = await gql({ query: `query{ pendingSellerVerifications { items { id status } endCursor } }`, cookie: staff.cookie });
    expect(pending.body.errors).toBeUndefined();
    const verificationId = pending.body.data.pendingSellerVerifications.items[0].id;
    expect(verificationId).toBeTruthy();

    const toReview = await gql({
      query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
      variables: { input: { verificationId, decision: "under_review", reason: "Starting review" } },
      cookie: staff.cookie,
    });
    expect(toReview.body.data.reviewSellerVerification.status).toBe("under_review");

    // rejection without reason rejected with VALIDATION_ERROR
    const noReason = await gql({
      query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
      variables: { input: { verificationId, decision: "rejected" } },
      cookie: staff.cookie,
    });
    expect(noReason.body.errors?.[0]?.message || "").toContain("VALIDATION_ERROR");

    const rejected = await gql({
      query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status decisionReason } }`,
      variables: { input: { verificationId, decision: "rejected", reason: "Insufficient info (placeholder)" } },
      cookie: staff.cookie,
    });
    expect(rejected.body.data.reviewSellerVerification.status).toBe("rejected");
    expect(rejected.body.data.reviewSellerVerification.decisionReason).toBeTruthy();

    const audit = await query(
      `SELECT action, metadata FROM audit_logs WHERE target_id=$1 AND action IN ('seller.verification_submitted','seller.verification_reviewed') ORDER BY created_at`,
      [verificationId]
    );
    expect((audit.rowCount ?? 0)).toBeGreaterThanOrEqual(3);
    expect(audit.rows.some((r: any) => r.action === "seller.verification_reviewed")).toBe(true);
  });

  it("enforces reviewer permissions and self-review prohibition", async () => {
    const seller = await registerVerifyLogin(`self-${Date.now()}@example.com`);
    await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: PROFILE_INPUT }, cookie: seller.cookie });
    await gql({ query: `mutation{ submitSellerVerification { id status } }`, cookie: seller.cookie });

    // Make seller a moderator too, but they must not review own verification.
    await grantRole(seller.userId, "moderator", seller.userId);
    const pendingAsSeller = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: seller.cookie });
    const verificationId = pendingAsSeller.body.data.pendingSellerVerifications.items[0].id;

    const selfReview = await gql({
      query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
      variables: { input: { verificationId, decision: "under_review", reason: "self" } },
      cookie: seller.cookie,
    });
    expect(selfReview.body.errors?.[0]?.message || "").toMatch(/FORBIDDEN|own verification/i);

    // Buyer (no staff role) cannot review
    const buyer = await registerVerifyLogin(`buyer-${Date.now()}@example.com`);
    const buyerReview = await gql({
      query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
      variables: { input: { verificationId, decision: "under_review", reason: "x" } },
      cookie: buyer.cookie,
    });
    expect(buyerReview.body.errors?.[0]?.message || "").toMatch(/FORBIDDEN|Insufficient/i);

    const buyerPending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: buyer.cookie });
    expect(buyerPending.body.errors?.[0]?.message || "").toMatch(/FORBIDDEN|Insufficient/i);
  });

  it("sellerActionPing returns SELLER_NOT_APPROVED for all non-approved statuses and succeeds when approved", async () => {
    const seller = await registerVerifyLogin(`gate-${Date.now()}@example.com`);
    const staff = await registerVerifyLogin(`staff2-${Date.now()}@example.com`);
    await grantRole(staff.userId, "moderator", staff.userId);

    await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: PROFILE_INPUT }, cookie: seller.cookie });

    const expectNotApproved = async () => {
      const r = await gql({ query: `mutation{ sellerActionPing { ok } }`, cookie: seller.cookie });
      expect(r.body.errors?.[0]?.message || "").toContain("SELLER_NOT_APPROVED");
    };

    await expectNotApproved(); // not_submitted
    await gql({ query: `mutation{ submitSellerVerification { id status } }`, cookie: seller.cookie });
    await expectNotApproved(); // submitted
    const pending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
    const vid = pending.body.data.pendingSellerVerifications.items[0].id;
    await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "under_review" } }, cookie: staff.cookie });
    await expectNotApproved(); // under_review
    await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid, decision: "more_info_requested", reason: "Need info" } }, cookie: staff.cookie });
    await expectNotApproved(); // more_info_requested

    // resubmit -> reject
    await gql({ query: `mutation{ submitSellerVerification { id status } }`, cookie: seller.cookie });
    const pending2 = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
    const vid2 = pending2.body.data.pendingSellerVerifications.items[0].id;
    await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid2, decision: "under_review" } }, cookie: staff.cookie });
    await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid2, decision: "rejected", reason: "No" } }, cookie: staff.cookie });
    await expectNotApproved(); // rejected

    // New fresh seller for approved path (reapply is OFF by default/config flag)
    const seller2 = await registerVerifyLogin(`gate2-${Date.now()}@example.com`);
    await gql({ query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`, variables: { input: PROFILE_INPUT }, cookie: seller2.cookie });
    await gql({ query: `mutation{ submitSellerVerification { id status } }`, cookie: seller2.cookie });
    const pending3 = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
    const vid3 = pending3.body.data.pendingSellerVerifications.items.find((i: any) => i.id !== vid && i.id !== vid2)?.id || pending3.body.data.pendingSellerVerifications.items[0].id;
    await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid3, decision: "under_review" } }, cookie: staff.cookie });
    const approved = await gql({ query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`, variables: { input: { verificationId: vid3, decision: "approved" } }, cookie: staff.cookie });
    expect(approved.body.data.reviewSellerVerification.status).toBe("approved");

    const ok = await gql({ query: `mutation{ sellerActionPing { ok message } }`, cookie: seller2.cookie });
    expect(ok.body.errors).toBeUndefined();
    expect(ok.body.data.sellerActionPing.ok).toBe(true);
  });
});
