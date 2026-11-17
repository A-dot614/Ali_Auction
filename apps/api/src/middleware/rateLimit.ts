import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

// Basic IP-based rate limits. TODO(docs/10): Redis-backed/shared limits for multi-instance.
export type RateLimitConfig = {
  windowMs?: number;
  generalLimit?: number;
  strictLimit?: number;
};

export type RateLimiters = { general: RateLimitRequestHandler; strict: RateLimitRequestHandler };

export function createRateLimiters(config: RateLimitConfig = {}): RateLimiters {
  const windowMs = config.windowMs ?? 15 * 60 * 1000;
  const generalLimit = config.generalLimit ?? (isTest ? 10_000 : 30);
  const strictLimit = config.strictLimit ?? (isTest ? 10_000 : 10);
  const message = { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } };
  return {
    general: rateLimit({ windowMs, limit: generalLimit, standardHeaders: "draft-7", legacyHeaders: false, message }),
    strict: rateLimit({ windowMs, limit: strictLimit, standardHeaders: "draft-7", legacyHeaders: false, message }),
  };
}

// Patterns for mutations that use the stricter limiter (D10 security checklist).
export const AUTH_SENSITIVE_OPERATIONS = /requestPasswordReset|resetPassword|register|login|resendVerification/;
export const WRITE_SENSITIVE_OPERATIONS = /placeBid|createCheckout|reportListing/;

const defaults = createRateLimiters();
export const authRateLimiter = defaults.general;
export const strictAuthRateLimiter = defaults.strict;
