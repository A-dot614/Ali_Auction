import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const migrationsDir = path.resolve(here, "../migrations");
const inventory = readFileSync(path.join(root, "docs-implementation/privacy-data-inventory.md"), "utf8");

const migrationColumns = new Set<string>();
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".js"))) {
  const text = readFileSync(path.join(migrationsDir, file), "utf8");
  for (const match of text.matchAll(/\b([a-z_][a-z0-9_]*):\s*\{\s*type:/g)) {
    migrationColumns.add(match[1]);
  }
}

const PERSONAL_LOOKING = ["email", "phone", "address", "legal_name", "password_hash", "shipping", "dob", "ip_address", "user_agent"];

describe("privacy data inventory (Slice 10)", () => {
  it("privacy inventory: every personal-looking migration column appears in the inventory", () => {
    const missing: string[] = [];
    for (const column of migrationColumns) {
      if (!PERSONAL_LOOKING.some((needle) => column.toLowerCase().includes(needle))) continue;
      if (!inventory.includes(`| ${column} |`) && !inventory.includes(`| ${column} `)) {
        missing.push(column);
      }
    }
    expect(missing, `personal-looking columns missing from inventory: ${missing.join(", ")}`).toEqual([]);
    expect(inventory).toContain("OPEN (docs/16 §7 #7)");
  });

  it("privacy inventory: every inventory personal row exists in a migration", () => {
    const personalClasses = ["Personal", "Sensitive personal", "Highly restricted"];
    const checked: string[] = [];
    for (const line of inventory.split("\n")) {
      if (!line.startsWith("|") || line.includes("---")) continue;
      const cells = line.split("|").map((c) => c.trim());
      // cells: ['', table, column, classification, purpose, readers, retention, logs, '']
      if (cells.length < 8) continue;
      const classification = cells[3];
      if (!personalClasses.some((c) => classification.startsWith(c))) continue;
      const column = cells[2];
      checked.push(column);
      expect(migrationColumns.has(column), `inventory column ${column} not found in migrations`).toBe(true);
      expect(cells[6]).toContain("OPEN");
      expect(cells[7]).toBe("No");
    }
    expect(checked.length).toBeGreaterThan(20);
  });
});
