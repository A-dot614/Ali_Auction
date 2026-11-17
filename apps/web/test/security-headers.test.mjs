import test from "node:test";
import assert from "node:assert/strict";
import { securityHeadersFor } from "../next.config.ts";

function header(headers, key) {
  return headers.find((h) => h.key === key)?.value;
}

test("security headers: CSP, HSTS (production only), nosniff, Referrer-Policy, and frame-ancestors are present in config or response", () => {
  const dev = securityHeadersFor("development", "http://localhost:4000");
  const prod = securityHeadersFor("production", "http://localhost:4000");

  const csp = header(dev, "Content-Security-Policy");
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("connect-src 'self' http://localhost:4000"));
  assert.equal(header(dev, "X-Content-Type-Options"), "nosniff");
  assert.equal(header(dev, "Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.ok(header(dev, "Permissions-Policy"));

  assert.equal(header(dev, "Strict-Transport-Security"), undefined);
  assert.match(header(prod, "Strict-Transport-Security"), /max-age/);
});
