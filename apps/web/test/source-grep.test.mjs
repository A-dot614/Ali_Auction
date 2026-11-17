import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SOURCE_FILES = [
  ...walk(path.join(root, "src")),
  path.join(root, "next.config.ts"),
  path.join(root, "postcss.config.mjs"),
  path.join(root, "tailwind.config.ts"),
  path.join(root, "public/sw.js"),
];

test("no localStorage or sessionStorage token usage in apps/web source", () => {
  for (const file of SOURCE_FILES) {
    const text = fs.readFileSync(file, "utf8");
    assert.ok(!text.includes("localStorage"), `${file} must not use localStorage`);
    assert.ok(!text.includes("sessionStorage"), `${file} must not use sessionStorage`);
  }
});

test("no secrets in apps/web source or bundle config", () => {
  const forbidden = ["API_SECRET", "WEBHOOK_SECRET", "PRIVATE_KEY", "client_secret", "password_hash", "FAKE_PAYMENT"];
  for (const file of SOURCE_FILES) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.ok(!text.includes(needle), `${file} must not reference ${needle}`);
    }
  }
});

test("no Date.now() in countdown logic that decides state (grep test)", () => {
  const countdown = fs.readFileSync(path.join(root, "src/lib/countdown.ts"), "utf8");
  const occurrences = countdown.match(/Date\.now\(\)/g) || [];
  assert.equal(occurrences.length, 1, "the offset-based function is the only clock read");
  assert.ok(countdown.includes("Math.max(0"), "remaining time is clamped and never negative");
  for (const file of walk(path.join(root, "src/lib"))) {
    if (file.endsWith("countdown.ts")) continue;
    assert.ok(!fs.readFileSync(file, "utf8").includes("Date.now()"), `${file} must not read the clock`);
  }
});
