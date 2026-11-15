import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.js";
import { query } from "../src/db.js";
import { grantRole } from "../src/auth/service.js";

const app = createApp();

async function gql(opts: { query: string; variables?: any; cookie?: string }) {
  const r = request(app)
    .post("/graphql")
    .set("content-type", "application/json");
  if (opts.cookie) r.set("Cookie", opts.cookie);
  return r.send({ query: opts.query, variables: opts.variables });
}

async function resetDb() {
  await query(
    `TRUNCATE TABLE audit_logs, password_reset_tokens, email_verification_tokens, sessions, user_roles, user_profiles, users RESTART IDENTITY CASCADE`
  );
  // roles seeded by migration
}

function getSetCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  // keep only name=value pairs for Cookie header
  return arr.map((c) => c.split(";")[0]).join("; ");
}

describe("identity integration", () => {
  beforeAll(async () => {
    // ensure connection works
    await query("SELECT 1");
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("register -> verify -> login", async () => {
    const email = `user-${Date.now()}@example.com`;
    const password = "Str0ngPass!1";

    const reg = await gql({
      query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
      variables: { input: { email, password } },
    });
    expect(reg.status).toBe(200);
    expect(reg.body.errors).toBeUndefined();
    expect(reg.body.data.register.ok).toBe(true);
    const verificationToken = reg.body.data.register.verificationToken;
    expect(verificationToken).toBeTruthy();

    const ver = await gql({
      query: `mutation($token: String!){ verifyEmail(token:$token){ ok } }`,
      variables: { token: verificationToken },
    });
    expect(ver.status).toBe(200);
    expect(ver.body.errors).toBeUndefined();
    expect(ver.body.data.verifyEmail.ok).toBe(true);

    const login = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok user { id email status emailVerified roles } } }`,
      variables: { input: { email, password } },
    });
    expect(login.status).toBe(200);
    expect(login.body.errors).toBeUndefined();
    expect(login.body.data.login.ok).toBe(true);
    expect(login.body.data.login.user.email).toBe(email.toLowerCase());
    expect(login.body.data.login.user.emailVerified).toBe(true);
    expect(login.body.data.login.user.roles).toEqual(expect.arrayContaining(["buyer", "seller"]));
    const cookie = getSetCookie(login);
    expect(cookie).toContain("aliauction_session=");

    const me = await gql({ query: `query{ me { id email } }`, cookie });
    expect(me.status).toBe(200);
    expect(me.body.data.me.email).toBe(email.toLowerCase());
  });

  it("buyer cannot call admin resolver", async () => {
    const email = `buyer-${Date.now()}@example.com`;
    const password = "Str0ngPass!1";
    const reg = await gql({
      query: `mutation($input: RegisterInput!){ register(input:$input){ ok verificationToken } }`,
      variables: { input: { email, password } },
    });
    await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: reg.body.data.register.verificationToken } });
    const login = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
      variables: { input: { email, password } },
    });
    const cookie = getSetCookie(login);

    const admin = await gql({ query: `query{ adminHealth { ok scope } }`, cookie });
    expect(admin.status).toBe(200);
    expect(admin.body.errors?.[0]?.message || "").toMatch(/FORBIDDEN|Insufficient/i);
    expect(admin.body.data?.adminHealth ?? null).toBeNull();

    // grant admin role and verify access (also records audit via helper)
    const userIdRes = await query(`SELECT id FROM users WHERE email=$1`, [email.toLowerCase()]);
    await grantRole(userIdRes.rows[0].id, "admin", userIdRes.rows[0].id);
    const login2 = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
      variables: { input: { email, password } },
    });
    const admin2 = await gql({ query: `query{ adminHealth { ok scope } }`, cookie: getSetCookie(login2) });
    expect(admin2.body.errors).toBeUndefined();
    expect(admin2.body.data.adminHealth.ok).toBe(true);
  });

  it("session revoked after password reset", async () => {
    const email = `reset-${Date.now()}@example.com`;
    const password = "Str0ngPass!1";
    const reg = await gql({
      query: `mutation($input: RegisterInput!){ register(input:$input){ ok verificationToken } }`,
      variables: { input: { email, password } },
    });
    await gql({ query: `mutation($t:String!){ verifyEmail(token:$t){ ok } }`, variables: { t: reg.body.data.register.verificationToken } });
    const login = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
      variables: { input: { email, password } },
    });
    const cookie = getSetCookie(login);
    const meBefore = await gql({ query: `query{ me { id email } }`, cookie });
    expect(meBefore.body.data.me?.email).toBe(email.toLowerCase());

    // Create a known reset token directly for test (token is normally emailed only).
    const userRes = await query(`SELECT id FROM users WHERE email=$1`, [email.toLowerCase()]);
    const userId = userRes.rows[0].id as string;
    const { generateToken, hashToken } = await import("../src/auth/tokens.js");
    const plain = generateToken(32);
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')`,
      [userId, hashToken(plain)]
    );

    const reset = await gql({
      query: `mutation($input: ResetPasswordInput!){ resetPassword(input:$input){ ok } }`,
      variables: { input: { token: plain, newPassword: "NewStr0ngPass!2" } },
    });
    expect(reset.body.errors).toBeUndefined();
    expect(reset.body.data.resetPassword.ok).toBe(true);

    const meAfter = await gql({ query: `query{ me { id email } }`, cookie });
    expect(meAfter.body.data.me).toBeNull();
  });

  it("unverified user blocked from protected mutation with stable error code", async () => {
    const email = `unverified-${Date.now()}@example.com`;
    const password = "Str0ngPass!1";
    await gql({
      query: `mutation($input: RegisterInput!){ register(input:$input){ ok } }`,
      variables: { input: { email, password } },
    });
    const login = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok user { emailVerified } } }`,
      variables: { input: { email, password } },
    });
    expect(login.body.data.login.user.emailVerified).toBe(false);
    const cookie = getSetCookie(login);

    const res = await gql({ query: `mutation{ protectedActionPing { ok } }`, cookie });
    expect(res.body.errors?.[0]?.message || "").toContain("EMAIL_NOT_VERIFIED");
    expect(res.body.data?.protectedActionPing ?? null).toBeNull();
  });

  it("enumeration-safe responses for register, login, forgot-password, resend-verification", async () => {
    const email = `enum-${Date.now()}@example.com`;
    const password = "Str0ngPass!1";
    const reg1 = await gql({
      query: `mutation($input: RegisterInput!){ register(input:$input){ ok message } }`,
      variables: { input: { email, password } },
    });
    expect(reg1.body.errors).toBeUndefined();

    // Existing email register should not reveal existence (generic validation error).
    const reg2 = await gql({
      query: `mutation($input: RegisterInput!){ register(input:$input){ ok } }`,
      variables: { input: { email, password: "AnotherPass!2" } },
    });
    expect(reg2.body.errors?.[0]?.message || "").toMatch(/VALIDATION_ERROR/);
    expect(reg2.body.errors?.[0]?.message || "").not.toMatch(/already exists|taken/i);

    const badLoginMissing = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
      variables: { input: { email: "nobody@example.com", password: "wrongpass1" } },
    });
    const badLoginWrong = await gql({
      query: `mutation($input: LoginInput!){ login(input:$input){ ok } }`,
      variables: { input: { email, password: "wrongpass1" } },
    });
    expect(badLoginMissing.body.errors?.[0]?.message).toBe("UNAUTHENTICATED: Invalid email or password.");
    expect(badLoginWrong.body.errors?.[0]?.message).toBe("UNAUTHENTICATED: Invalid email or password.");

    const forgotMissing = await gql({
      query: `mutation($e:String!){ requestPasswordReset(email:$e){ ok message } }`,
      variables: { e: "nobody@example.com" },
    });
    const forgotExisting = await gql({
      query: `mutation($e:String!){ requestPasswordReset(email:$e){ ok message } }`,
      variables: { e: email },
    });
    expect(forgotMissing.body.data.requestPasswordReset.ok).toBe(true);
    expect(forgotExisting.body.data.requestPasswordReset.ok).toBe(true);
    expect(forgotMissing.body.data.requestPasswordReset.message).toBe(forgotExisting.body.data.requestPasswordReset.message);

    const resendMissing = await gql({
      query: `mutation($e:String!){ resendVerification(email:$e){ ok message } }`,
      variables: { e: "nobody@example.com" },
    });
    const resendExisting = await gql({
      query: `mutation($e:String!){ resendVerification(email:$e){ ok message } }`,
      variables: { e: email },
    });
    expect(resendMissing.body.data.resendVerification.ok).toBe(true);
    expect(resendExisting.body.data.resendVerification.ok).toBe(true);
    expect(resendMissing.body.data.resendVerification.message).toBe(resendExisting.body.data.resendVerification.message);
  });

  it("audit row written for role change", async () => {
    const email = `audit-${Date.now()}@example.com`;
    const password = "Str0ngPass!1";
    const reg = await gql({
      query: `mutation($input: RegisterInput!){ register(input:$input){ ok userId verificationToken } }`,
      variables: { input: { email, password } },
    });
    const userId = reg.body.data.register.userId;
    await grantRole(userId, "admin", userId);
    const rows = await query(
      `SELECT action, target_type, target_id, metadata FROM audit_logs WHERE action = $1 AND target_id = $2`,
      ["user.role_change", userId]
    );
    expect((rows.rowCount ?? 0)).toBeGreaterThan(0);
    expect(rows.rows[0].target_type).toBe("user");
    expect(rows.rows[0].metadata?.role || rows.rows[0].metadata).toBeTruthy();
  });

});
