import rateLimit from "express-rate-limit";

// Basic IP-based rate limits for auth-sensitive endpoints (Phase 1 baseline).
// TODO(docs/10, docs/06): refine limits, add Redis-backed/shared limits for multi-instance, and cover bidding/checkout/reports.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
});

export const strictAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
});
