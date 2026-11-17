import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("manifest: required fields present, start_url and scope correct, no secrets", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "public/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "AliAuction.ca");
  assert.equal(manifest.short_name, "AliAuction");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.theme_color);
  assert.ok(manifest.background_color);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  const text = JSON.stringify(manifest);
  for (const secret of ["token", "password", "secret", "api_key"]) {
    assert.ok(!text.toLowerCase().includes(secret));
  }
});
