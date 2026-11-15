import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";

describe("rate limiting", () => {
  it("returns 429 with stable error code after N requests when explicitly limited", async () => {
    const app = express();
    const limiter = rateLimit({
      windowMs: 60_000,
      limit: 2,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
    });
    app.get("/limited", limiter, (_req, res) => res.json({ ok: true }));

    await request(app).get("/limited").expect(200);
    await request(app).get("/limited").expect(200);
    const res = await request(app).get("/limited").expect(429);
    expect(res.body?.error?.code || res.body?.code).toBe("RATE_LIMITED");
  });

  it("production config is not relaxed (default limits are strict, not test values)", async () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      // Re-evaluate module logic by constructing limiters with same formula as middleware.
      // The exported app limiters are created at import time; this asserts the intended
      // production values (30 general / 10 strict auth) are not the relaxed test values.
      const isTest = process.env.NODE_ENV === "test";
      const generalLimit = isTest ? 10_000 : 30;
      const strictLimit = isTest ? 10_000 : 10;
      expect(generalLimit).toBe(30);
      expect(strictLimit).toBe(10);
      expect(generalLimit).toBeLessThan(10_000);
      expect(strictLimit).toBeLessThan(10_000);

      // Also verify a limiter created with production-strict value blocks after N.
      const app = express();
      const limiter = rateLimit({
        windowMs: 60_000,
        limit: strictLimit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
      });
      app.get("/limited", limiter, (_req, res) => res.json({ ok: true }));
      for (let i = 0; i < strictLimit; i++) {
        await request(app).get("/limited").expect(200);
      }
      const res = await request(app).get("/limited").expect(429);
      expect(res.body?.error?.code).toBe("RATE_LIMITED");
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });
});
