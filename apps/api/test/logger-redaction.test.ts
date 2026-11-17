import { describe, expect, it } from "vitest";
import { createLogger, normalizeRequestId, redact } from "../src/logging/logger.js";

const FIXED = new Date("2026-11-17T10:20:30.000Z");

describe("structured logging and redaction (Slice 10)", () => {
  it("logger redacts deny-listed keys in nested objects and arrays", () => {
    const input = {
      password: "hunter2",
      nested: { password_hash: "hash", tokenHash: "tok", authorization: "Bearer x", safe: "ok" },
      list: [{ email: "a@b.com", cookie: "sid=1", ok: 1 }, { "Set-Cookie": "abc" }],
      legal_name: "Restricted Name",
      shipping_address_snapshot: { address: "1 Street" },
    };
    const result = redact(input) as any;
    expect(result.password).toBe("[REDACTED]");
    expect(result.nested.password_hash).toBe("[REDACTED]");
    expect(result.nested.tokenHash).toBe("[REDACTED]");
    expect(result.nested.authorization).toBe("[REDACTED]");
    expect(result.nested.safe).toBe("ok");
    expect(result.list[0].email).toBe("[REDACTED]");
    expect(result.list[0].cookie).toBe("[REDACTED]");
    expect(result.list[1]["Set-Cookie"]).toBe("[REDACTED]");
    expect(result.legal_name).toBe("[REDACTED]");
    expect(result.shipping_address_snapshot).toBe("[REDACTED]");
    const text = JSON.stringify(result);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("a@b.com");
    expect(text).not.toContain("Restricted Name");
  });

  it("logger emits one JSON object per line with requestId and injected time", () => {
    const lines: string[] = [];
    const log = createLogger({ clock: () => FIXED, sink: (l) => lines.push(l), requestId: "req-1" });
    log.info("first", { count: 1 });
    log.warn("second", { password: "secret" });
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed.time).toBe(FIXED.toISOString());
      expect(parsed.requestId).toBe("req-1");
      expect(typeof parsed.msg).toBe("string");
      expect(line.includes("\n")).toBe(false);
    }
    expect(lines[1]).not.toContain("secret");
  });

  it("request id helper keeps valid UUIDs and replaces invalid values", () => {
    const valid = "123e4567-e89b-42d3-a456-426614174000";
    expect(normalizeRequestId(valid)).toBe(valid);
    expect(normalizeRequestId("not-a-uuid")).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
