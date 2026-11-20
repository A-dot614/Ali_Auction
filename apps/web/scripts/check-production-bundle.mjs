/**
 * Fails if demo-only strings are present in a non-demo Next.js build output.
 * Run after `next build` with demo mode OFF. The webpack cache is excluded: it
 * is a local build artefact, not part of the shipped production bundle.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(webRoot, ".next");

// A route string is quoted or followed by a slash; the lookbehind avoids
// matching harmless module paths such as "./demo".
const DEMO_ROUTE = /(?<![.\w])\/demo(?:\/|["'`])/;

const FORBIDDEN = [
  ["demo banner", "DEMO: not real, nothing is charged, no decision made"],
  ["demo route", DEMO_ROUTE],
  ["mock catalogue: vintage desk lamp", "Vintage desk lamp"],
  ["mock catalogue: ceramic mug set", "Ceramic mug set"],
  ["mock catalogue: commuter bicycle", "Commuter bicycle"],
];

const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json", ".css", ".html", ".txt", ".map"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "cache") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

if (!fs.existsSync(distDir)) {
  console.error(`[bundle-leak] FAIL: ${distDir} does not exist; build the web app first.`);
  process.exit(1);
}

const files = walk(distDir);
const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const [label, needle] of FORBIDDEN) {
    const found = needle instanceof RegExp ? needle.test(text) : text.includes(needle);
    if (found) {
      findings.push(`${path.relative(webRoot, file)} contains ${label}: "${String(needle)}"`);
    }
  }
}

if (findings.length > 0) {
  console.error("[bundle-leak] FAIL: demo-only strings found in the non-demo build:");
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(`[bundle-leak] OK: no demo-only strings in ${files.length} production build files.`);
