import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SOURCE = walk(path.join(webRoot, "src"));
const DEMO_SOURCE = SOURCE.filter(
  (file) =>
    file.includes(`${path.sep}demo${path.sep}`) || /^demo/i.test(path.basename(file))
);
const REAL_SOURCE = SOURCE.filter((file) => !DEMO_SOURCE.includes(file));

test("real-mode screens never call a bidding or payment endpoint", () => {
  const forbidden = [
    "placeBid",
    "startHostedCheckout",
    "createCheckout",
    "handleWebhook",
    "/webhooks/payments",
    "fake_session",
    "fake_refund",
  ];
  const sensitive = [
    "src/app/checkout/page.tsx",
    "src/app/shipping/page.tsx",
    "src/app/disputes/page.tsx",
    "src/app/staff/disputes/page.tsx",
    "src/app/buyer/bids/page.tsx",
    "src/components/AuctionPanel.tsx",
  ].map((rel) => path.join(webRoot, rel));
  for (const file of [...sensitive, ...REAL_SOURCE]) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.ok(!text.includes(needle), `${path.relative(webRoot, file)} must not reference ${needle}`);
    }
  }
});

test("read-only screens do not fetch data in real mode", () => {
  for (const rel of [
    "src/app/checkout/page.tsx",
    "src/app/shipping/page.tsx",
    "src/app/disputes/page.tsx",
    "src/app/staff/disputes/page.tsx",
    "src/app/buyer/bids/page.tsx",
    "src/app/account/email/page.tsx",
  ]) {
    const text = fs.readFileSync(path.join(webRoot, rel), "utf8");
    assert.ok(!text.includes("gql("), `${rel} must not call the API client`);
    assert.ok(!text.includes("fetch("), `${rel} must not fetch`);
    assert.match(text, /Not enabled yet|Payments not enabled|Bidding is not enabled/);
  }
});

test("the demo notice is global and uses the exact required wording", () => {
  const shell = fs.readFileSync(path.join(webRoot, "src/components/PageShell.tsx"), "utf8");
  assert.ok(
    !/\/demo|demo-data|DemoShellExtras|DemoSearchResults|DemoCategoryListings|DEMO: not real/.test(shell),
    "real shell must not import demo code, data or copy"
  );

  const demoLayout = fs.readFileSync(path.join(webRoot, "src/app/demo/layout.demo.tsx"), "utf8");
  assert.match(demoLayout, /<DemoBanner \/>/, "demo layout renders the banner on every demo screen");
  assert.match(demoLayout, /aria-label="Demo screens"/, "demo navigation is labelled");

  const demoLib = fs.readFileSync(path.join(webRoot, "src/lib/demo-copy.ts"), "utf8");
  assert.match(demoLib, /DEMO: not real, nothing is charged, no decision made/);
  const banner = fs.readFileSync(path.join(webRoot, "src/components/DemoBanner.tsx"), "utf8");
  assert.match(banner, /DEMO_BANNER_TEXT/);
  for (const rel of [
    "src/app/demo/checkout/page.demo.tsx",
    "src/app/demo/shipping/page.demo.tsx",
    "src/app/demo/disputes/page.demo.tsx",
    "src/app/demo/account/page.demo.tsx",
    "src/app/demo/account/email/page.demo.tsx",
    "src/app/demo/bidding/page.demo.tsx",
  ]) {
    const text = fs.readFileSync(path.join(webRoot, rel), "utf8");
    assert.match(text, /PageShell/, `${rel} must use the shared real-mode shell`);
  }
});

test("web profile allowlist mirrors the API allowlist without email fields", async () => {
  const { PROFILE_EDIT_FIELDS } = await import("../src/lib/profile-fields.ts");
  assert.deepEqual([...PROFILE_EDIT_FIELDS], ["displayName", "bio", "provinceCode"]);
  const apiSource = fs.readFileSync(
    path.join(repoRoot, "apps/api/src/auth/emailChange.ts"),
    "utf8"
  );
  assert.match(apiSource, /PROFILE_EDIT_FIELDS = \["displayName", "bio", "provinceCode"\]/);
  assert.ok(![...PROFILE_EDIT_FIELDS].includes("email"));
});
