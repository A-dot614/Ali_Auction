import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("shared source exports Phase 1 constants/types markers", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8");
  assert.match(src, /CURRENCY_CAD/);
  assert.match(src, /PHASE1_WORKSTREAMS/);
  assert.match(src, /MoneyMinor/);
});
