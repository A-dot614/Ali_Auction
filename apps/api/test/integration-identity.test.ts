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
    `TRUNCATE TABLE audit_logs, password_reset_tokens, email_verification_tokens, sessions, user_roles, users RESTART IDENTITY CASCADE`
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
});
