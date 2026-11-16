import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { GraphQLObjectType } from "graphql";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { schema } from "../src/graphql/schema.js";
import { authenticateSession } from "../src/auth/service.js";
import { requireVerified, type GraphQLContext } from "../src/auth/authz.js";
import { catalogueResolvers } from "../src/graphql/resolvers/catalogue.js";
import { auctionResolvers } from "../src/graphql/resolvers/auction.js";
import { ordersResolvers } from "../src/graphql/resolvers/orders.js";
import { approveListing, pauseListing, rejectListing, removeListing, resumeListing } from "../src/catalogue/service.js";
import { suspendUser, reinstateUser } from "../src/accounts/service.js";
import { reportListing as reportListingService, reportUser as reportUserService, resolveReport as resolveReportService } from "../src/reports/service.js";

const app = createApp();
const FIXED_NOW = new Date("2026-11-16T12:00:00.000Z");
const clock = () => FIXED_NOW;

type User = { userId: string; cookie: string; roles: string[]; email: string };

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
  await query(
    `TRUNCATE TABLE audit_logs, reports, password_reset_tokens, email_verification_tokens, sessions,
     user_roles, user_profiles, listing_media, listings, seller_verifications, seller_profiles, users,
     auctions, bids, proxy_bids, auction_events, outbox_events,
     shipments, refunds, webhook_events, payment_transactions, processed_events, order_events,
     order_fee_lines, orders, fee_rules RESTART IDENTITY CASCADE`
  );
}

async function registerVerifyLogin(email: string): Promise<User> {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const { userId, verificationToken } = reg.body.data.register;
  const verified = await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: verificationToken } });
  if (verified.body.errors) throw new Error(JSON.stringify(verified.body.errors));
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId, cookie: getSetCookie(login), roles: ["buyer", "seller"], email };
}

async function registerUnverified(email: string): Promise<User> {
  const reg = await gql({
    query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (reg.body.errors) throw new Error(JSON.stringify(reg.body.errors));
  const login = await gql({
    query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
    variables: { input: { email, password: "Str0ngPass!1" } },
  });
  if (login.body.errors) throw new Error(JSON.stringify(login.body.errors));
  return { userId: reg.body.data.register.userId, cookie: getSetCookie(login), roles: ["buyer"], email };
}

async function grantStaffRole(userId: string, role: "moderator" | "admin" | "support") {
  await query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name=$2
     ON CONFLICT DO NOTHING`,
    [userId, role]
  );
}

async function makeStaff(role: "moderator" | "admin" | "support"): Promise<User> {
  const staff = await registerVerifyLogin(`staff-${role}-${randomUUID()}@example.com`);
  await grantStaffRole(staff.userId, role);
  return { ...staff, roles: [...staff.roles, role] };
}

async function makeApprovedSeller(): Promise<User> {
  const seller = await registerVerifyLogin(`seller-${randomUUID()}@example.com`);
  await gql({
    query: `mutation($input: SellerProfileInput!){ createSellerProfile(input:$input){ id } }`,
    variables: {
      input: {
        sellerType: "individual",
        displayName: "Report Seller",
        publicStoreName: "Report Store",
        legalName: "Restricted Legal Name",
        provinceCode: "ON",
      },
    },
    cookie: seller.cookie,
  });
  await gql({ query: `mutation{ submitSellerVerification { id } }`, cookie: seller.cookie });
  const staff = await makeStaff("admin");
  const pending = await gql({ query: `query{ pendingSellerVerifications { items { id } } }`, cookie: staff.cookie });
  const vid = pending.body.data.pendingSellerVerifications.items[0].id;
  for (const decision of ["under_review", "approved"]) {
    await gql({
      query: `mutation($input: ReviewSellerVerificationInput!){ reviewSellerVerification(input:$input){ status } }`,
      variables: { input: { verificationId: vid, decision } },
      cookie: staff.cookie,
    });
  }
  return seller;
}

async function makeListing(seller: User, status: string): Promise<string> {
  const category = await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`);
  const created = await gql({
    query: `mutation($input: ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
    variables: {
      input: {
        categoryId: category.rows[0].id,
        title: "Report Test Listing",
        description: "Report test listing description.",
        condition: "used",
        fulfilmentOption: "both",
        currency: "CAD",
        startingPriceMinor: "2500",
      },
    },
    cookie: seller.cookie,
  });
  if (created.body.errors) throw new Error(JSON.stringify(created.body.errors));
  const id = created.body.data.createListingDraft.id as string;
  if (status !== "draft") {
    await query(`UPDATE listings SET status='pending_review' WHERE id=$1`, [id]);
  }
  if (status !== "draft" && status !== "pending_review") {
    await query(`UPDATE listings SET status=$2, published_at=$3 WHERE id=$1`, [id, status, FIXED_NOW]);
  }
  return id;
}

async function auditCount(action?: string): Promise<number> {
  const res = action
    ? await query(`SELECT count(*)::int AS c FROM audit_logs WHERE action=$1`, [action])
    : await query(`SELECT count(*)::int AS c FROM audit_logs`);
  return res.rows[0].c;
}

async function userFromDb(userId: string): Promise<any> {
  return (await query(`SELECT id, status, email FROM users WHERE id=$1`, [userId])).rows[0];
}

async function actor(userId: string): Promise<any> {
  const row = (await query(`SELECT id, email, status, email_verified_at FROM users WHERE id=$1`, [userId])).rows[0];
  const roles = (await query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id=$1`,
    [userId]
  )).rows.map((r: any) => r.name);
  return { ...row, roles };
}

async function reportListingViaGql(reporter: User, listingId: string) {
  const res = await gql({
    query: `mutation($id:ID!, $category:ReportCategory!){ reportListing(listingId:$id, category:$category){ id status } }`,
    variables: { id: listingId, category: "misleading_listing" },
    cookie: reporter.cookie,
  });
  if (res.body.errors) throw new Error(JSON.stringify(res.body.errors));
  return res.body.data.reportListing as { id: string; status: string };
}

async function reportUserViaGql(reporter: User, userId: string) {
  const res = await gql({
    query: `mutation($id:ID!, $category:ReportCategory!){ reportUser(userId:$id, category:$category){ id status } }`,
    variables: { id: userId, category: "spam" },
    cookie: reporter.cookie,
  });
  if (res.body.errors) throw new Error(JSON.stringify(res.body.errors));
  return res.body.data.reportUser as { id: string; status: string };
}

describe("reports & moderation (Slice 7)", () => {
  beforeAll(async () => {
    await query("SELECT 1");
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("unverified user cannot report (EMAIL_NOT_VERIFIED), writes nothing", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const unverified = await registerUnverified(`unverified-${randomUUID()}@example.com`);
    const beforeAudit = await auditCount();
    const res = await gql({
      query: `mutation($id:ID!){ reportListing(listingId:$id, category:spam){ id } }`,
      variables: { id: listingId },
      cookie: unverified.cookie,
    });
    expect(res.body.errors?.[0]?.message).toMatch(/EMAIL_NOT_VERIFIED/);
    expect((await query(`SELECT count(*)::int AS c FROM reports`)).rows[0].c).toBe(0);
    expect(await auditCount()).toBe(beforeAudit);
  });

  it("user cannot report their own listing or themselves (FORBIDDEN), writes nothing", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const beforeAudit = await auditCount();
    const own = await gql({
      query: `mutation($id:ID!){ reportListing(listingId:$id, category:spam){ id } }`,
      variables: { id: listingId },
      cookie: seller.cookie,
    });
    expect(own.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    const self = await gql({
      query: `mutation($id:ID!){ reportUser(userId:$id, category:spam){ id } }`,
      variables: { id: seller.userId },
      cookie: seller.cookie,
    });
    expect(self.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    expect((await query(`SELECT count(*)::int AS c FROM reports`)).rows[0].c).toBe(0);
    expect(await auditCount()).toBe(beforeAudit);
  });

  it("duplicate open report returns the existing report id and creates no second row", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    const beforeAudit = await auditCount();
    const first = await reportListingViaGql(reporter, listingId);
    const second = await reportListingViaGql(reporter, listingId);
    expect(second.id).toBe(first.id);
    expect((await query(`SELECT count(*)::int AS c FROM reports`)).rows[0].c).toBe(1);
    expect(await auditCount()).toBe(beforeAudit + 1);
  });

  it("reported party cannot read reporter identity via any query or type (schema test and runtime check)", async () => {
    const typeMap: any = (schema as any).getTypeMap();
    const reportingTypes = Object.entries(typeMap).filter(([, t]: any) => t instanceof GraphQLObjectType);
    for (const [name, t] of reportingTypes as any[]) {
      if (name === "ReportStaffType") continue;
      expect(t.getFields().reporterUserId, `type ${name} must not expose reporterUserId`).toBeUndefined();
    }
    expect(typeMap.ReportStaffType.getFields().reporterUserId).toBeDefined();
    expect(typeMap.ReportReceipt.getFields().reporterUserId).toBeUndefined();

    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    const receipt = await reportListingViaGql(reporter, listingId);
    // Selecting reporter identity on the reporter-facing type is a schema validation error.
    const leakQuery = await gql({
      query: `mutation($id:ID!){ reportListing(listingId:$id, category:spam){ id reporterUserId } }`,
      variables: { id: listingId },
      cookie: reporter.cookie,
    });
    expect(leakQuery.body.errors?.[0]?.message).toMatch(/Cannot query field/);
    const asSeller = await gql({ query: `query($id:ID!){ reportForStaff(id:$id){ id } }`, variables: { id: receipt.id }, cookie: seller.cookie });
    expect(asSeller.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
  });

  it("pendingReports is staff-only; support can read but cannot suspend or hide (FORBIDDEN, no audit row)", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    await reportListingViaGql(reporter, listingId);
    const buyer = await registerVerifyLogin(`buyer-${randomUUID()}@example.com`);
    const support = await makeStaff("support");

    const deniedBuyer = await gql({ query: `query{ pendingReports { items { id } } }`, cookie: buyer.cookie });
    expect(deniedBuyer.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    const supportRead = await gql({ query: `query{ pendingReports { items { id reporterUserId } } }`, cookie: support.cookie });
    expect(supportRead.body.errors).toBeUndefined();
    expect(supportRead.body.data.pendingReports.items.length).toBeGreaterThanOrEqual(1);

    const beforeAudit = await auditCount();
    const suspend = await gql({
      query: `mutation($id:ID!){ suspendUser(userId:$id, reason:"abuse"){ status } }`,
      variables: { id: buyer.userId },
      cookie: support.cookie,
    });
    expect(suspend.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    const resolve = await gql({
      query: `mutation($id:ID!){ resolveReport(reportId:$id, decision:actioned, reason:"hide", action:hide_listing){ id } }`,
      variables: { id: (await query(`SELECT id FROM reports LIMIT 1`)).rows[0].id },
      cookie: support.cookie,
    });
    expect(resolve.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    const pause = await gql({
      query: `mutation($id:ID!){ pauseListing(id:$id, reason:"hide"){ id } }`,
      variables: { id: listingId },
      cookie: support.cookie,
    });
    expect(pause.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    expect(await auditCount()).toBe(beforeAudit);
  });

  it("moderator hides a listing via a listing report: listing becomes paused, one listing audit row, one report audit row", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    const report = await reportListingViaGql(reporter, listingId);
    const moderator = await makeStaff("moderator");
    const beforePaused = await auditCount("listing.paused");
    const beforeResolved = await auditCount("report.actioned");
    const resolved = await gql({
      query: `mutation($id:ID!){ resolveReport(reportId:$id, decision:actioned, reason:"prohibited content", action:hide_listing){ id status } }`,
      variables: { id: report.id },
      cookie: moderator.cookie,
    });
    expect(resolved.body.errors).toBeUndefined();
    expect(resolved.body.data.resolveReport.status).toBe("actioned");
    expect((await query(`SELECT status FROM listings WHERE id=$1`, [listingId])).rows[0].status).toBe("paused");
    expect(await auditCount("listing.paused")).toBe(beforePaused + 1);
    expect(await auditCount("report.actioned")).toBe(beforeResolved + 1);
  });

  it("moderator suspends a user: status becomes suspended, all sessions revoked, one audit row", async () => {
    const target = await registerVerifyLogin(`target-${randomUUID()}@example.com`);
    // A second active session for the same user.
    const secondLogin = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
      variables: { input: { email: target.email, password: "Str0ngPass!1" } },
    });
    expect(getSetCookie(secondLogin)).not.toBe("");
    const moderator = await makeStaff("moderator");
    const beforeSuspended = await auditCount("user.suspended");
    const res = await gql({
      query: `mutation($id:ID!){ suspendUser(userId:$id, reason:"repeated abuse"){ userId status } }`,
      variables: { id: target.userId },
      cookie: moderator.cookie,
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.suspendUser.status).toBe("suspended");
    expect((await userFromDb(target.userId)).status).toBe("suspended");
    const activeSessions = await query(
      `SELECT count(*)::int AS c FROM sessions WHERE user_id=$1 AND revoked_at IS NULL`,
      [target.userId]
    );
    expect(activeSessions.rows[0].c).toBe(0);
    expect(await auditCount("user.suspended")).toBe(beforeSuspended + 1);
  });

  it("suspended user cannot log in-session actions: requireVerified rejects with ACCOUNT_SUSPENDED for createListingDraft, placeBid, and createCheckout", async () => {
    const target = await registerVerifyLogin(`suspended-${randomUUID()}@example.com`);
    // Simulate a suspension while a session is still live so the shared gate is exercised.
    await query(`UPDATE users SET status='suspended' WHERE id=$1`, [target.userId]);

    const drafts = await gql({
      query: `mutation($input:ListingDraftInput!){ createListingDraft(input:$input){ id } }`,
      variables: {
        input: {
          categoryId: (await query(`SELECT id FROM categories WHERE is_placeholder = true LIMIT 1`)).rows[0].id,
          title: "Valid Listing Title",
          description: "Valid description",
          condition: "used",
          fulfilmentOption: "both",
          currency: "CAD",
          startingPriceMinor: "2500",
        },
      },
      cookie: target.cookie,
    });
    expect(drafts.body.errors?.[0]?.message).toMatch(/ACCOUNT_SUSPENDED/);

    const bid = await gql({
      query: `mutation($input:PlaceBidInput!){ placeBid(input:$input){ accepted } }`,
      variables: { input: { auctionId: randomUUID(), amountMinor: 2600, requestId: randomUUID() } },
      cookie: target.cookie,
    });
    expect(bid.body.errors?.[0]?.message).toMatch(/ACCOUNT_SUSPENDED/);

    const checkout = await gql({
      query: `mutation($input:CheckoutInput!){ createCheckout(input:$input){ id } }`,
      variables: {
        input: { orderId: randomUUID(), acceptedTotalMinor: "1", fulfilmentChoice: "shipping", requestId: randomUUID() },
      },
      cookie: target.cookie,
    });
    expect(checkout.body.errors?.[0]?.message).toMatch(/ACCOUNT_SUSPENDED/);

    // Direct gate assertion on all three resolvers plus the shared guard.
    const suspendedUser = await actor(target.userId);
    const ctx = { user: suspendedUser, req: {}, res: {} } as GraphQLContext;
    expect(() => requireVerified(ctx)).toThrow(/ACCOUNT_SUSPENDED/);
    await expect(catalogueResolvers.Mutation.createListingDraft(null, { input: {} }, ctx)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(auctionResolvers.Mutation.placeBid(null, { input: {} }, ctx)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(ordersResolvers.Mutation.createCheckout(null, { input: {} }, ctx)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
  });

  it("suspending an already suspended user returns INVALID_ACCOUNT_TRANSITION and writes nothing", async () => {
    const target = await registerVerifyLogin(`target-${randomUUID()}@example.com`);
    const moderator = await makeStaff("moderator");
    await suspendUser(target.userId, await actor(moderator.userId), "first", { clock });
    const beforeAudit = await auditCount();
    await expect(suspendUser(target.userId, await actor(moderator.userId), "again", { clock })).rejects.toThrow(
      /INVALID_ACCOUNT_TRANSITION/
    );
    expect(await auditCount()).toBe(beforeAudit);
  });

  it("reinstateUser moves suspended to active, one audit row; the old session is not restored", async () => {
    const target = await registerVerifyLogin(`target-${randomUUID()}@example.com`);
    const moderator = await makeStaff("moderator");
    const modActor = await actor(moderator.userId);
    const oldToken = target.cookie.split("=")[1];
    await suspendUser(target.userId, modActor, "abuse", { clock });
    const beforeReinstated = await auditCount("user.reinstated");
    const res = await gql({
      query: `mutation($id:ID!){ reinstateUser(userId:$id, reason:"appeal allowed"){ userId status } }`,
      variables: { id: target.userId },
      cookie: moderator.cookie,
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.reinstateUser.status).toBe("active");
    expect((await userFromDb(target.userId)).status).toBe("active");
    expect(await auditCount("user.reinstated")).toBe(beforeReinstated + 1);
    expect(await authenticateSession(oldToken)).toBeNull();
    expect((await query(`SELECT count(*)::int AS c FROM sessions WHERE user_id=$1 AND revoked_at IS NULL`, [target.userId])).rows[0].c).toBe(0);
    const relogin = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
      variables: { input: { email: target.email, password: "Str0ngPass!1" } },
    });
    expect(relogin.body.errors).toBeUndefined();
  });

  it("resolveReport twice returns INVALID_REPORT_TRANSITION on the second call and writes nothing", async () => {
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    const report = await reportListingViaGql(reporter, listingId);
    const moderator = await makeStaff("moderator");
    const modActor = await actor(moderator.userId);
    await resolveReportService(report.id, modActor, "dismissed", "no evidence", "none", { clock });
    const beforeAudit = await auditCount();
    await expect(
      resolveReportService(report.id, modActor, "dismissed", "again", "none", { clock })
    ).rejects.toThrow(/INVALID_REPORT_TRANSITION/);
    expect(await auditCount()).toBe(beforeAudit);
    expect((await query(`SELECT status FROM reports WHERE id=$1`, [report.id])).rows[0].status).toBe("dismissed");
  });

  it("resolveReport with action hide_listing on a user report is rejected with VALIDATION_ERROR", async () => {
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    const target = await registerVerifyLogin(`target-${randomUUID()}@example.com`);
    const report = await reportUserViaGql(reporter, target.userId);
    const moderator = await makeStaff("moderator");
    const beforeAudit = await auditCount();
    const res = await gql({
      query: `mutation($id:ID!){ resolveReport(reportId:$id, decision:actioned, reason:"hide", action:hide_listing){ id } }`,
      variables: { id: report.id },
      cookie: moderator.cookie,
    });
    expect(res.body.errors?.[0]?.message).toMatch(/VALIDATION_ERROR/);
    expect((await query(`SELECT status FROM reports WHERE id=$1`, [report.id])).rows[0].status).toBe("open");
    expect(await auditCount()).toBe(beforeAudit);
  });

  it("denied privileged calls write no audit row (assert count unchanged)", async () => {
    const buyer = await registerVerifyLogin(`buyer-${randomUUID()}@example.com`);
    const seller = await makeApprovedSeller();
    const listingId = await makeListing(seller, "published");
    const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
    const report = await reportListingViaGql(reporter, listingId);
    const beforeAudit = await auditCount();
    const ops = [
      { q: `mutation($id:ID!){ suspendUser(userId:$id, reason:"x"){ status } }`, v: { id: buyer.userId } },
      { q: `mutation($id:ID!){ reinstateUser(userId:$id, reason:"x"){ status } }`, v: { id: buyer.userId } },
      { q: `mutation($id:ID!){ resolveReport(reportId:$id, decision:dismissed, reason:"x", action:none){ id } }`, v: { id: report.id } },
      { q: `mutation($id:ID!){ pauseListing(id:$id, reason:"x"){ id } }`, v: { id: listingId } },
      { q: `mutation($id:ID!){ removeListing(id:$id, reason:"x"){ id } }`, v: { id: listingId } },
    ];
    for (const op of ops) {
      const res = await gql({ query: op.q, variables: op.v, cookie: buyer.cookie });
      expect(res.body.errors?.[0]?.message).toMatch(/FORBIDDEN/);
    }
    expect(await auditCount()).toBe(beforeAudit);
  });

  // D11: every privileged mutation writes exactly one audit row on success.
  type PrivCtx = {
    seller: User;
    staff: User;
    reporter: User;
    listingId: string;
    reportId: string;
    extraListingId?: string;
    targetUserId?: string;
  };
  const privileged: Array<{ name: string; setup?: (ctx: PrivCtx) => Promise<void>; run: (ctx: PrivCtx) => Promise<void> }> = [
    {
      name: "reportListing",
      setup: async (c) => {
        const seller2 = await makeApprovedSeller();
        c.extraListingId = await makeListing(seller2, "published");
      },
      run: async (c) => {
        await reportListingService(await actor(c.reporter.userId), c.extraListingId!, "spam", null, { clock });
      },
    },
    {
      name: "reportUser",
      setup: async (c) => {
        const target = await registerVerifyLogin(`target-${randomUUID()}@example.com`);
        c.targetUserId = target.userId;
      },
      run: async (c) => {
        await reportUserService(await actor(c.reporter.userId), c.targetUserId!, "harassment", null, { clock });
      },
    },
    {
      name: "resolveReport",
      run: async (c) => {
        await resolveReportService(c.reportId, await actor(c.staff.userId), "dismissed", "no action needed", "none", { clock });
      },
    },
    {
      name: "suspendUser",
      run: async (c) => {
        await suspendUser(c.reporter.userId, await actor(c.staff.userId), "abuse", { clock });
      },
    },
    {
      name: "reinstateUser",
      setup: async (c) => {
        await suspendUser(c.reporter.userId, await actor(c.staff.userId), "abuse", { clock });
      },
      run: async (c) => {
        await reinstateUser(c.reporter.userId, await actor(c.staff.userId), "appeal", { clock });
      },
    },
    {
      name: "pauseListing",
      run: async (c) => {
        await query(`UPDATE listings SET status='published' WHERE id=$1`, [c.listingId]);
        await pauseListing(c.listingId, c.staff.userId, "hide", undefined);
      },
    },
    {
      name: "removeListing",
      run: async (c) => {
        await query(`UPDATE listings SET status='published' WHERE id=$1`, [c.listingId]);
        await removeListing(c.listingId, c.staff.userId, "remove");
      },
    },
    {
      name: "approveListing",
      run: async (c) => {
        await query(`UPDATE listings SET status='pending_review' WHERE id=$1`, [c.listingId]);
        await approveListing(c.listingId, c.staff.userId);
      },
    },
    {
      name: "rejectListing",
      run: async (c) => {
        await query(`UPDATE listings SET status='pending_review' WHERE id=$1`, [c.listingId]);
        await rejectListing(c.listingId, c.staff.userId, "reject");
      },
    },
    {
      name: "resumeListing",
      run: async (c) => {
        await query(`UPDATE listings SET status='paused' WHERE id=$1`, [c.listingId]);
        await resumeListing(c.listingId, c.staff.userId);
      },
    },
  ];

  for (const p of privileged) {
    it(`audit coverage: ${p.name} writes exactly one audit row on success`, async () => {
      const seller = await makeApprovedSeller();
      const listingId = await makeListing(seller, "published");
      const reporter = await registerVerifyLogin(`reporter-${randomUUID()}@example.com`);
      const staff = await makeStaff("moderator");
      const report = await reportListingViaGql(reporter, listingId);
      const ctx: PrivCtx = { seller, staff, reporter, listingId, reportId: report.id };
      if (p.setup) await p.setup(ctx);
      const before = await auditCount();
      await p.run(ctx);
      expect(await auditCount()).toBe(before + 1);
    });
  }
});
