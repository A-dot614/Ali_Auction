import { describe, expect, it } from "vitest";
import { liveness, readiness } from "../src/observability/health.js";

describe("health checks (Slice 10)", () => {
  it("health: ready returns 503 with an injected failing dependency and body contains no error text", async () => {
    const ok = await readiness({
      postgres: async () => undefined,
      redis: async () => undefined,
      timeoutMs: 50,
    });
    expect(ok.status).toBe("ok");
    expect(ok.checks).toEqual({ postgres: "ok", redis: "ok" });

    const failed = await readiness({
      postgres: async () => undefined,
      redis: async () => { throw new Error("ECONNREFUSED redis://secret-host:6379 user@example.com stack trace"); },
      timeoutMs: 50,
    });
    expect(failed.status).toBe("fail");
    expect(failed.checks).toEqual({ postgres: "ok", redis: "fail" });
    const body = JSON.stringify(failed);
    expect(body).not.toContain("ECONNREFUSED");
    expect(body).not.toContain("secret-host");
    expect(body).not.toContain("user@example.com");
    expect(body).not.toContain("stack");
  });

  it("liveness has no dependency checks", () => {
    expect(liveness()).toEqual({ status: "ok" });
  });
});
