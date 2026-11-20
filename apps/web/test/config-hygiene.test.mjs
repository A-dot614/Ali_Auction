import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

function parseEnvExample() {
  const values = {};
  for (const line of fs.readFileSync(path.join(repoRoot, ".env.example"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return values;
}

const ENV = parseEnvExample();

// Built from parts so the scanner pattern itself is not a committed key-like string.
const LIVE = "live_";
const PEM_BEGIN = "-----BEGIN ";
const PEM_END = " PRIVATE KEY-----";
const PEM = PEM_BEGIN + ".{0,40}" + PEM_END;
const KEY_LIKE = new RegExp(
  [
    `sk_${LIVE}`,
    `rk_${LIVE}`,
    "AKIA[0-9A-Z]{16}",
    "ghp_[A-Za-z0-9]{20,}",
    "AIza[0-9A-Za-z_-]{20,}",
    PEM,
    "xox[baprs]-",
  ].join("|")
);

const EMPTY_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "S3_BUCKET",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
];

const REQUIRED_KEYS = [
  "NODE_ENV",
  "APP_NAME",
  "APP_URL",
  "API_URL",
  "API_PORT",
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "SESSION_COOKIE_NAME",
  ...EMPTY_KEYS,
];

test(".env.example contains only placeholders and empty values, never a real credential", () => {
  for (const key of REQUIRED_KEYS) {
    assert.ok(Object.hasOwn(ENV, key), `.env.example must define ${key}`);
  }

  for (const key of EMPTY_KEYS) {
    assert.equal(ENV[key], "", `${key} must be empty in .env.example`);
  }

  assert.match(ENV.JWT_SECRET, /change-me|placeholder|replace/i, "JWT_SECRET must be a placeholder");
  assert.ok(ENV.JWT_SECRET.length < 40, "JWT_SECRET must not look like a generated secret");
  assert.match(ENV.DATABASE_URL, /@localhost:/, "example database URL must be local only");
  assert.match(ENV.REDIS_URL, /@?localhost:/, "example Redis URL must be local only");

  for (const [key, value] of Object.entries(ENV)) {
    assert.ok(!KEY_LIKE.test(value), `${key} contains a key-like string`);
  }
});

test("no committed file contains a real key-like string", () => {
  const allowlist = new Set(
    fs
      .readFileSync(path.join(repoRoot, "scripts/secret-scan-allowlist.txt"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
  const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
  assert.ok(tracked.includes(".env.example"), "the example env file must be tracked");
  assert.ok(!tracked.includes(".env"), "the local .env file must not be tracked");

  for (const file of tracked) {
    if (allowlist.has(file)) continue;
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    let text;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    assert.ok(!KEY_LIKE.test(text), `${file} contains a key-like string`);
  }
});

test("no payment provider SDK is a dependency", () => {
  const manifests = [
    path.join(repoRoot, "package.json"),
    path.join(webRoot, "package.json"),
    path.join(repoRoot, "apps/api/package.json"),
    path.join(repoRoot, "packages/shared/package.json"),
  ];
  const forbidden = /^(stripe|@stripe\/|paypal|@paypal\/|braintree|@braintree\/)/i;
  for (const manifest of manifests) {
    const json = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
    for (const name of Object.keys(deps)) {
      assert.ok(!forbidden.test(name), `${manifest} must not depend on provider SDK ${name}`);
    }
  }
});
