import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const TEXT_NEEDLES = [
  "DEMO: not real, nothing is charged, no decision made",
  "Vintage desk lamp",
  "Ceramic mug set",
  "Commuter bicycle",
];

// Route strings are quoted or followed by a slash; the lookbehind avoids
// matching harmless module paths such as "./demo".
const DEMO_ROUTE = /(?<![.\w])\/demo(?:\/|["'`])/;

function isDemoOnly(file) {
  const rel = path.relative(webRoot, file);
  return (
    rel.includes(`${path.sep}demo${path.sep}`) ||
    rel.includes(".demo.tsx") ||
    /^demo/i.test(path.basename(file))
  );
}

test("production bundle leak script checks every required demo-only string", () => {
  const script = fs.readFileSync(path.join(webRoot, "scripts/check-production-bundle.mjs"), "utf8");
  for (const needle of TEXT_NEEDLES) {
    assert.ok(script.includes(needle), `leak script must check "${needle}"`);
  }
  assert.ok(script.includes("DEMO_ROUTE"), "leak script must check demo route names");
  assert.ok(script.includes("\\/demo"), "leak script must use the demo route pattern");
  assert.match(script, /cache/, "local webpack cache must be excluded from the shipped bundle scan");
});

test("no real-mode source file contains a demo-only string", () => {
  const files = walk(path.join(webRoot, "src")).filter((file) => !isDemoOnly(file));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of TEXT_NEEDLES) {
      assert.ok(!text.includes(needle), `${path.relative(webRoot, file)} must not contain "${needle}"`);
    }
    assert.ok(!DEMO_ROUTE.test(text), `${path.relative(webRoot, file)} must not contain a /demo route`);
  }
});

test("demo routes are only discoverable when the demo page extension is enabled", () => {
  const config = fs.readFileSync(path.join(webRoot, "next.config.ts"), "utf8");
  assert.match(config, /PAGE_EXTENSIONS = isDemo\s*\n\s*\? \["demo\.tsx", "tsx", "ts", "jsx", "js"\]/);
  assert.match(config, /: \["tsx", "ts", "jsx", "js"\]/);
  assert.match(config, /pageExtensions: PAGE_EXTENSIONS/);
  const demoPages = walk(path.join(webRoot, "src/app/demo")).filter((file) =>
    file.endsWith("page.demo.tsx")
  );
  assert.ok(demoPages.length >= 12, `expected renamed demo routes, found ${demoPages.length}`);
});
