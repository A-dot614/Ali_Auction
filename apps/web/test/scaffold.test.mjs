import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real test for scaffold presence: ensures key Phase 1 web entry files exist.
// UI/component rendering tests are deferred until authenticated/buyer/seller flows and
// design-system components are implemented (docs/08, docs/12). Documented in PHASE1_STATUS.
test("web scaffold files exist", () => {
  const root = path.resolve(__dirname, "..");
  assert.ok(fs.existsSync(path.join(root, "src/app/page.tsx")));
  assert.ok(fs.existsSync(path.join(root, "src/app/layout.tsx")));
  assert.ok(fs.existsSync(path.join(root, "package.json")));
});
