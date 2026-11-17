import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, suffix) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, suffix));
    else if (entry.name.endsWith(suffix)) out.push(full);
  }
  return out;
}

const PAGES = walk(path.join(root, "src/app"), "page.tsx");
const ALL_TSX = walk(path.join(root, "src"), ".tsx");

test("key pages have one h1, a main landmark, and every form control has an associated label", () => {
  assert.ok(PAGES.length >= 20, `expected the full route scaffold, found ${PAGES.length} pages`);
  for (const page of PAGES) {
    const text = fs.readFileSync(page, "utf8");
    const usesShell = /PageShell|ScaffoldPage/.test(text);
    assert.ok(usesShell || /<main\b/.test(text), `${page} must provide a main landmark`);
    assert.ok(!/<h1\b/.test(text), `${page} must not add a second h1 (PageShell owns it)`);
    assert.ok(/\b(title|description)\s*=/.test(text) || /title=/.test(text) || /<title>/.test(text), `${page} should pass a title`);
  }

  const shell = fs.readFileSync(path.join(root, "src/components/PageShell.tsx"), "utf8");
  assert.equal((shell.match(/<h1\b/g) || []).length, 1, "PageShell renders exactly one h1");
  assert.ok(shell.includes("<main"));
  assert.ok(shell.includes('aria-label="Primary"'));
  assert.ok(shell.includes('href="#main-content"'), "skip link present");

  const labelled = ALL_TSX.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  assert.ok(labelled.includes("htmlFor=") && labelled.includes("<label"), "form controls use labels");
  assert.ok(labelled.includes('htmlFor={`auth-${field.name}`}'), "auth fields are labelled dynamically");
  assert.ok(labelled.includes('htmlFor="bid-amount"'), "bid amount field is labelled");
  assert.ok(labelled.includes('htmlFor="search-query"'), "search field is labelled");
});
