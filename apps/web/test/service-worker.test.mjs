import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");

test("service worker: never caches /graphql, auth, account, buyer, seller, admin, or any response with Set-Cookie", () => {
  for (const prefix of ["/graphql", "/auth", "/account", "/buyer", "/seller", "/admin"]) {
    assert.ok(sw.includes(`"${prefix}"`), `must list private prefix ${prefix}`);
  }
  assert.ok(sw.includes("headers.has(\"cookie\")"));
  assert.ok(sw.includes("request.credentials === \"include\""));
  assert.ok(sw.includes("response.headers.has(\"set-cookie\")"));
  assert.ok(sw.includes("isPrivate(url.pathname) || credentialed"));
});

test("service worker: caches only shell and static assets and the short-TTL public pages", () => {
  assert.ok(sw.includes('const SHELL'));
  assert.ok(sw.includes('"/_next/static/"'));
  assert.ok(sw.includes('"/icons/"'));
  assert.ok(sw.includes('"/categories/"'));
  assert.ok(sw.includes('"/listings/"'));
  assert.ok(sw.includes("PUBLIC_TTL_MS"));
  assert.ok(sw.includes("NOT FOR PRODUCTION"));
  assert.ok(sw.includes("/offline.html"));
});
