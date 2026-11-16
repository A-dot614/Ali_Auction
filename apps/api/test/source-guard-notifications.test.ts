import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const NEW_SLICE8_SRC = [
  "notifications/templates.ts",
  "notifications/consumer.ts",
  "notifications/sinks.ts",
  "notifications/service.ts",
  "outbox/consumer.ts",
  "graphql/resolvers/notifications.ts",
].map((p) => path.join(srcDir, p));

const ALL_SRC = walk(srcDir);

describe("injected clock discipline (Slice 8)", () => {
  it("no SQL clock functions or Date.now() in new source", () => {
    for (const file of NEW_SLICE8_SRC) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("now()"), `${file} must not use SQL clock functions`).toBe(false);
      expect(text.includes("Date.now()"), `${file} must not read the wall clock`).toBe(false);
    }
  });
});

describe("notification TODO markers closed (Slice 8)", () => {
  it("the former 3b/6/7 notification TODO markers no longer exist in source", () => {
    const legacy = [
      "No notifications are sent (Slice 8)",
      "TODO for Slice 8",
      "TODO(Slice 8)",
      "Slice 8 TODO",
      "seller notification on reject/pause/remove",
    ];
    for (const file of ALL_SRC) {
      const text = readFileSync(file, "utf8");
      for (const marker of legacy) {
        expect(text.toLowerCase().includes(marker.toLowerCase()), `${file} still contains legacy marker: ${marker}`).toBe(false);
      }
    }
  });

  it("each former TODO code path now points to D2 (outbox event)", () => {
    for (const file of [
      "catalogue/service.ts",
      "orders/service.ts",
      "payments/service.ts",
      "accounts/service.ts",
      "reports/service.ts",
    ]) {
      const text = readFileSync(path.join(srcDir, file), "utf8");
      expect(text.includes("Slice 8 (D2)"), `${file} must point to Slice 8 (D2)`).toBe(true);
    }
  });
});
