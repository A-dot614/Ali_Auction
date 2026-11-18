import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const apiDir = resolve(process.cwd());
const sourceFiles = [
  "src/disputes/disputeStateMachine.ts",
  "src/disputes/permissions.ts",
  "src/disputes/service.ts",
  "src/graphql/resolvers/disputes.ts",
];

describe("Slice 12 source guards", () => {
  it("no SQL now() or Date.now() in new source (grep test)", () => {
    for (const rel of sourceFiles) {
      const text = readFileSync(resolve(apiDir, rel), "utf8");
      expect(text, `${rel} must not contain Date.now()`).not.toMatch(/Date\.now\s*\(/);
      expect(text, `${rel} must not contain SQL now()`).not.toMatch(/\bnow\(\)\s*(,|\)|$)/i);
    }
  });

  it("no fixed calendar date is passed through GraphQL in any new test (grep test over apps/api/test/*dispute*)", () => {
    const files = readdirSync(resolve(apiDir, "test")).filter((f) => f.includes("dispute"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(resolve(apiDir, "test", file), "utf8");
      expect(text, `${file} must not contain a fixed calendar date`).not.toMatch(/\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });
});
