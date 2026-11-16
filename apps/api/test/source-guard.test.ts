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

const ALL_SRC = walk(srcDir);

// Files added in Slice 7. Existing callers of recordAudit keep the column default,
// so the guard only needs to cover the modules introduced here.
const NEW_SLICE7_SRC = [
  "accounts/accountStateMachine.ts",
  "accounts/service.ts",
  "reports/reportStateMachine.ts",
  "reports/permissions.ts",
  "reports/service.ts",
  "graphql/resolvers/reports.ts",
].map((p) => path.join(srcDir, p));

describe("audit_logs is append-only (Slice 7)", () => {
  it("no UPDATE audit_logs or DELETE FROM audit_logs path exists in apps/api/src", () => {
    for (const file of ALL_SRC) {
      const text = readFileSync(file, "utf8");
      expect(text.toUpperCase().includes("UPDATE AUDIT_LOGS"), `${file} must not update audit_logs`).toBe(false);
      expect(text.toUpperCase().includes("DELETE FROM AUDIT_LOGS"), `${file} must not delete audit_logs`).toBe(false);
    }
  });
});

describe("injected clock discipline (Slice 7)", () => {
  it("no SQL now() or Date.now() appears in new Slice 7 source", () => {
    for (const file of NEW_SLICE7_SRC) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("now()"), `${file} must not use SQL clock functions`).toBe(false);
      expect(text.includes("Date.now()"), `${file} must not read the wall clock`).toBe(false);
    }
  });
});
