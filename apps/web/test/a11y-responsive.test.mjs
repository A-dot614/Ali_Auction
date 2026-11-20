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
    else if (/\.(tsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SOURCE = walk(path.join(root, "src"));
const TSX = SOURCE.filter((file) => file.endsWith(".tsx"));
const CSS = SOURCE.filter((file) => file.endsWith(".css")).map((file) => fs.readFileSync(file, "utf8")).join("\n");

function relativeLuminance(hex) {
  const channels = hex.replace("#", "").match(/../g).map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function cssValue(variable) {
  const match = CSS.match(new RegExp(`${variable}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `CSS must define ${variable} as a hex colour`);
  return match[1];
}

function block(selector) {
  const match = CSS.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `CSS must define ${selector}`);
  return match[1];
}

test("every page has exactly one h1 through the shared shell", () => {
  const pages = walk(path.join(root, "src/app")).filter((file) =>
    /page(\.demo)?\.tsx$/.test(file)
  );
  assert.ok(pages.length >= 20, `expected full route scaffold, found ${pages.length}`);
  for (const page of pages) {
    const text = fs.readFileSync(page, "utf8");
    assert.ok(/PageShell|ScaffoldPage/.test(text), `${path.relative(root, page)} must use the shared shell`);
    assert.ok(!/<h1\b/.test(text), `${path.relative(root, page)} must not add a second h1`);
  }
  const shell = fs.readFileSync(path.join(root, "src/components/PageShell.tsx"), "utf8");
  assert.equal((shell.match(/<h1\b/g) || []).length, 1, "PageShell owns the single h1");
  assert.ok(shell.includes('id="main-content"'), "main landmark has a skip-link target");
});

test("every form control has a matching label", () => {
  for (const file of TSX) {
    const text = fs.readFileSync(file, "utf8");
    const controls = [...text.matchAll(/<(input|select|textarea)\b[\s\S]*?>/g)].map((match) => match[0]);
    if (controls.length === 0) continue;
    const labels = [...text.matchAll(/htmlFor=(?:"([^"]+)"|\{`([^`]+)`\})/g)].map(
      (match) => match[1] ?? match[2]
    );
    assert.ok(labels.length > 0, `${path.relative(root, file)} needs labelled controls`);
    for (const control of controls) {
      const id = control.match(/\bid=(?:"([^"]+)"|\{`([^`]+)`\})/);
      assert.ok(id, `${path.relative(root, file)} has an unlabelled control: ${control.slice(0, 80)}`);
      const value = id[1] ?? id[2];
      assert.ok(labels.includes(value), `${path.relative(root, file)} needs <label htmlFor="${value}">`);
    }
  }
});

test("buttons are native, typed and keyboard reachable", () => {
  for (const file of TSX) {
    const text = fs.readFileSync(file, "utf8");
    const buttons = [...text.matchAll(/<button\b/g)];
    for (const button of buttons) {
      const snippet = text.slice(button.index, button.index + 200);
      assert.match(snippet, /<button\b[^>]*\btype=/, `${path.relative(root, file)} button needs an explicit type`);
      assert.ok(!/\sdisabled(?:\s|\/?>)/.test(snippet.slice(0, 120)), `${path.relative(root, file)} button must not be permanently disabled`);
    }
    assert.ok(
      !/<(div|span|p|li|section)\b[^>]*\bonClick=/.test(text),
      `${path.relative(root, file)} must not use click handlers on non-interactive elements`
    );
  }
  const shell = fs.readFileSync(path.join(root, "src/components/PageShell.tsx"), "utf8");
  assert.ok(shell.includes('href="#main-content"'), "skip link is a real anchor");
});

test("focus is visible and the banner and Not enabled states meet 4.5:1 contrast", () => {
  assert.match(CSS, /:focus-visible\s*\{[^}]*outline:/, "visible focus outline required");
  assert.ok(!/outline:\s*(none|0)\s*;/.test(CSS), "focus outline must not be removed");

  const surface = cssValue("--surface");
  const text = cssValue("--text");
  const muted = cssValue("--muted");

  const banner = block("\\.demo-banner");
  const bannerBackground = banner.match(/background:\s*(#[0-9a-fA-F]{6})/)[1];
  const bannerText = banner.match(/color:\s*(#[0-9a-fA-F]{6})/)[1];
  assert.ok(contrast(bannerText, bannerBackground) >= 4.5, "demo banner text contrast >= 4.5:1");

  const notEnabled = block("\\.not-enabled strong");
  assert.ok(notEnabled.includes("var(--muted)"), "Not enabled emphasis uses the muted token");
  assert.ok(contrast(muted, surface) >= 4.5, "Not enabled text contrast >= 4.5:1");
  assert.ok(contrast(text, surface) >= 4.5, "body text contrast >= 4.5:1");

  const notEnabledComponent = fs.readFileSync(path.join(root, "src/components/NotEnabled.tsx"), "utf8");
  assert.ok(notEnabledComponent.includes('className="card not-enabled"'), "Not enabled uses the styled state");
  assert.ok(notEnabledComponent.includes('role="status"'), "Not enabled is announced as a status");
});

test("layout wraps without horizontal scroll at 360px", () => {
  assert.match(CSS, /box-sizing:\s*border-box/, "border-box prevents padding overflow");
  assert.match(CSS, /overflow-wrap:\s*anywhere/, "long identifiers wrap");
  assert.match(CSS, /img,\s*table,\s*pre,\s*code\s*\{\s*max-width:\s*100%/, "wide content is capped");
  assert.match(block("\\.nav-list"), /flex-wrap:\s*wrap/, "navigation wraps on narrow screens");
  assert.match(block("\\.nav-list a"), /min-height:\s*44px/, "navigation links keep a 44px target");

  for (const match of CSS.matchAll(/minmax\((\d+)px/g)) {
    assert.ok(Number(match[1]) <= 328, `grid minimum ${match[1]}px must fit a 360px viewport`);
  }
  assert.match(CSS, /@media\s*\(max-width:\s*767px\)/, "responsive breakpoint present");
  assert.match(CSS, /\.responsive-table[^{]*\{[^}]*display:\s*block/, "tables stack on small screens");
});
