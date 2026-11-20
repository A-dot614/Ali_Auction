import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/^page(\.demo)?\.tsx$/.test(entry.name)) out.push(path.relative(root, full).split(path.sep).join("/"));
  }
  return out;
}

const PAGES = walk(path.join(root, "src/app"));
const REAL_PAGES = PAGES.filter((file) => !file.includes("/demo/"));
const DEMO_PAGES = PAGES.filter((file) => file.includes("/demo/"));

test("every real page declares metadata and the shared shell without a local h1", () => {
  assert.ok(REAL_PAGES.length >= 30, `expected the completed real route set, found ${REAL_PAGES.length}`);
  for (const file of REAL_PAGES) {
    const text = read(file);
    assert.match(text, /export const metadata/, `${file} must declare metadata`);
    assert.match(text, /PageShell|ScaffoldPage/, `${file} must use the shared shell`);
    assert.ok(!/<h1\b/.test(text), `${file} must not add a second h1`);
  }
});

test("every demo page uses the demo-only extension and the shared shell", () => {
  assert.ok(DEMO_PAGES.length >= 18, `expected the completed demo route set, found ${DEMO_PAGES.length}`);
  for (const file of DEMO_PAGES) {
    assert.match(file, /\.demo\.tsx$/, `${file} must be demo-only`);
    assert.match(read(file), /PageShell/, `${file} must use the shared shell`);
  }
});

test("seller, buyer and staff screens call only the existing API operations", () => {
  const seller = read("src/components/SellerListingForm.tsx");
  for (const operation of ["createListingDraft", "updateListingDraft", "submitListingForReview"]) {
    assert.match(seller, new RegExp(operation), `seller form must use ${operation}`);
  }
  const onboarding = read("src/components/SellerProfileForm.tsx");
  assert.match(onboarding, /createSellerProfile/);
  assert.match(onboarding, /submitSellerVerification/);

  const orders = read("src/app/buyer/orders/page.tsx");
  assert.match(orders, /myOrders/);
  const detail = read("src/app/buyer/orders/[orderId]/page.tsx");
  assert.match(detail, /\border\(id: \$id\)/);
  const review = read("src/app/staff/listings/page.tsx");
  assert.match(review, /pendingListingReviews/);
  const actions = read("src/components/ListingReviewActions.tsx");
  for (const operation of ["approveListing", "rejectListing", "pauseListing", "removeListing"]) {
    assert.match(actions, new RegExp(operation), `review actions must use ${operation}`);
  }
});

test("unsupported capabilities are labelled, never invented", () => {
  assert.match(read("src/app/buyer/bids/page.tsx"), /Bidding is not enabled/);
  assert.match(read("src/app/buyer/bids/page.tsx"), /watchlist/);
  assert.match(read("src/components/SellerListingForm.tsx"), /Photo uploads are not available/);
  assert.match(read("src/app/checkout/page.tsx"), /Payments not enabled/);
  assert.match(read("src/app/account/email/page.tsx"), /Not enabled yet/);
});

test("legal and static pages show the counsel draft notice without authored policy text", () => {
  const content = read("src/components/LegalNoticeContent.tsx");
  assert.match(content, /DRAFT, not approved by counsel/);
  assert.match(content, /not yet drafted/);
  for (const slug of ["about", "help", "contact", "terms", "privacy", "refunds"]) {
    assert.ok(exists(`src/app/${slug}/page.tsx`), `${slug} real page missing`);
    assert.ok(exists(`src/app/demo/${slug}/page.demo.tsx`), `${slug} demo page missing`);
    assert.match(read(`src/app/${slug}/page.tsx`), /LegalNoticeContent/);
    assert.match(read(`src/app/demo/${slug}/page.demo.tsx`), /LegalNoticeContent/);
  }
});

test("quality states exist and never render raw errors", () => {
  for (const file of ["loading.tsx", "not-found.tsx", "error.tsx"]) {
    assert.ok(exists(`src/app/${file}`), `${file} missing`);
  }
  const error = read("src/app/error.tsx");
  assert.match(error, /"use client"/);
  assert.match(error, /reset/);
  assert.ok(!/\{error\./.test(error), "raw error fields must not be rendered");
  assert.match(read("src/app/not-found.tsx"), /Page not found/);
  assert.match(read("src/components/ui/Skeleton.tsx"), /aria-hidden="true"/);
});

test("admin status keeps the required decision counts and flag wording", () => {
  const status = read("src/app/admin/status/page.tsx");
  assert.match(status, /counts\.decided\} decided \/ \$\{counts\.pending\} pending/);
  assert.match(read("src/lib/decision-log.ts"), /FEATURE_LIVE_BIDDING_ENABLED/);
  assert.match(
    status,
    /Real bidding and real-money payments stay OFF until every required decision-log row is filled and signed off\./
  );
});
