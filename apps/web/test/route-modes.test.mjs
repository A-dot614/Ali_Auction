import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "page.tsx" || entry.name === "page.demo.tsx") out.push(full);
  }
  return out;
}

const ALL_PAGES = walk(path.join(root, "src/app"));
const PARAMS = { slug: "vintage-desk-lamp", orderId: "demo-order-1", listingId: "demo-listing-1" };

const DEMO_EXPECTATIONS = [
  ["src/app/demo/page.demo.tsx", ["Demo hub"]],
  ["src/app/demo/listings/page.demo.tsx", ["Demo listings"]],
  ["src/app/demo/listings/[slug]/page.demo.tsx", ["Vintage desk lamp", "Photos", "Seller information", "Auction timer"]],
  ["src/app/demo/bidding/page.demo.tsx", ["Demo bidding simulation"]],
  ["src/app/demo/checkout/page.demo.tsx", ["Demo checkout"]],
  ["src/app/demo/orders/page.demo.tsx", ["Demo orders"]],
  ["src/app/demo/orders/[orderId]/page.demo.tsx", ["Payment events", "Timeline", "dispute_opened", "refund_recorded"]],
  ["src/app/demo/shipping/page.demo.tsx", ["Demo shipping"]],
  ["src/app/demo/disputes/page.demo.tsx", ["Demo disputes"]],
  ["src/app/demo/staff/disputes/page.demo.tsx", ["Demo staff review", "No outcome"]],
  ["src/app/demo/account/page.demo.tsx", ["Demo account", "Not enabled yet"]],
  ["src/app/demo/account/email/page.demo.tsx", ["Not enabled yet"]],
  ["src/app/admin/status/page.tsx", ["1 decided / 34 pending", "FEATURE_LIVE_BIDDING_ENABLED", "OFF"]],
];

const REAL_EXPECTATIONS = [
  ["src/app/page.tsx", ["AliAuction.ca"]],
  ["src/app/search/page.tsx", ["Search"]],
  ["src/app/checkout/page.tsx", ["Payments not enabled"]],
  ["src/app/shipping/page.tsx", ["Not enabled yet"]],
  ["src/app/disputes/page.tsx", ["Not enabled yet"]],
  ["src/app/staff/disputes/page.tsx", ["Not enabled yet"]],
  ["src/app/account/page.tsx", ["Not enabled yet"]],
  ["src/app/account/email/page.tsx", ["Not enabled yet"]],
  ["src/app/buyer/bids/page.tsx", ["Bidding is not enabled"]],
  ["src/app/categories/[slug]/page.tsx", ["Category"]],
  ["src/app/buyer/orders/page.tsx", ["My orders"]],
  ["src/app/buyer/orders/[orderId]/page.tsx", ["Order detail"]],
  ["src/app/admin/status/page.tsx", ["1 decided / 34 pending"]],
];

const script = [
  "const files = JSON.parse(process.argv[1]);",
  "const ReactModule = await import('react');",
  "globalThis.React = ReactModule.default || ReactModule;",
  "globalThis.fetch = async () => ({",
  "  ok: true,",
  "  json: async () => ({ data: { listing: null, auctionForListing: null, serverTime: '2026-11-20T12:00:00.000Z' } }),",
  "});",
  "function collect(node, out) {",
  "  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return; }",
  "  if (Array.isArray(node)) { for (const item of node) collect(item, out); return; }",
  "  if (node && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, 'props')) {",
  "    for (const value of Object.values(node.props)) collect(value, out);",
  "  }",
  "}",
  "const results = [];",
  "for (const file of files) {",
  "  try {",
  "    const mod = await import(file);",
  "    const component = (mod.default && mod.default.default) || mod.default;",
  "    const element = await component({ params: Promise.resolve(JSON.parse(process.argv[2])), searchParams: Promise.resolve({}) });",
  "    const strings = [];",
  "    collect(element, strings);",
  "    results.push({ file, ok: true, strings });",
  "  } catch (error) {",
  "    results.push({ file, ok: false, error: String((error && error.message) || error) });",
  "  }",
  "}",
  "console.log(JSON.stringify(results));",
].join("\n");

function renderAllPages(demo) {
  const files = ALL_PAGES.map((file) => pathToFileURL(file).href);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script, JSON.stringify(files), JSON.stringify(PARAMS)],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_PUBLIC_DEMO_MODE: demo ? "true" : "false",
        VITE_DEMO_MODE: "",
      },
    }
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function assertPage(results, rel, fragments) {
  const file = pathToFileURL(path.join(root, rel)).href;
  const page = results.find((entry) => entry.file === file);
  assert.ok(page, `missing render result for ${rel}`);
  assert.equal(page.ok, true, `${rel}: ${page.error ?? ""}`);
  const text = page.strings.join(" ");
  for (const fragment of fragments) {
    assert.ok(text.includes(fragment), `${rel} must render "${fragment}"; got: ${text.slice(0, 400)}`);
  }
}

test("every route renders in demo mode with the expected demo content", () => {
  const results = renderAllPages(true);
  const failures = results.filter((entry) => !entry.ok).map((entry) => `${entry.file}: ${entry.error}`);
  assert.equal(
    results.filter((entry) => entry.ok).length,
    ALL_PAGES.length,
    failures.join("\n")
  );
  for (const [rel, fragments] of DEMO_EXPECTATIONS) assertPage(results, rel, fragments);
});

test("every route renders in real mode with not-enabled states instead of errors", () => {
  const results = renderAllPages(false);
  const failures = results.filter((entry) => !entry.ok).map((entry) => `${entry.file}: ${entry.error}`);
  assert.equal(
    results.filter((entry) => entry.ok).length,
    ALL_PAGES.length,
    failures.join("\n")
  );
  for (const [rel, fragments] of REAL_EXPECTATIONS) assertPage(results, rel, fragments);
});
