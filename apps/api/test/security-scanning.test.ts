import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

describe("CI security scanning steps (Slice 10)", () => {
  it("scanning steps present in ci.yml (grep test)", () => {
    const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("name: Dependency audit");
    expect(ci).toContain("npx -y pnpm@9.15.4 audit --prod --audit-level=high");
    expect(ci).toContain("name: Secret scan");
    expect(ci).toContain("bash scripts/scan-secrets.sh");
    expect(ci).not.toContain("continue-on-error");
  });

  it("no SQL now() or Date.now() in new Slice 10 source (grep test)", () => {
    const newFiles = [
      "src/logging/logger.ts",
      "src/middleware/requestContext.ts",
      "src/observability/metrics.ts",
      "src/observability/health.ts",
      "src/graphql/limits.ts",
      "src/accounts/deletion.ts",
      "src/auth/cookies.ts",
    ].map((p) => path.join(root, "apps/api", p));
    for (const file of newFiles) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("now()"), `${file} must not use SQL clock functions`).toBe(false);
      expect(text.includes("Date.now()"), `${file} must not read the wall clock`).toBe(false);
    }
  });
});
