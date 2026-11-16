function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  get nodeEnv() {
    return env("NODE_ENV", "development");
  },
  get apiPort() {
    return Number(env("API_PORT", "4000"));
  },
  get databaseUrl() {
    return env("DATABASE_URL", "");
  },
  get redisUrl() {
    return env("REDIS_URL", "");
  },
  // Feature flags - MUST default off for money/live bidding flows.
  // TODO(docs/16, docs/01, docs/07): enable only after approved rules, legal/payment/compliance review.
  get features() {
    return {
      liveBiddingEnabled: env("FEATURE_LIVE_BIDDING_ENABLED", "false") === "true",
      realMoneyPaymentsEnabled: env("FEATURE_REAL_MONEY_PAYMENTS_ENABLED", "false") === "true",
    };
  },
  get session() {
    return {
      cookieName: env("SESSION_COOKIE_NAME", "aliauction_session"),
      ttlDays: Number(env("SESSION_TTL_DAYS", "14")),
      rotateAfterMinutes: Number(env("SESSION_ROTATE_AFTER_MINUTES", "30")),
      secureCookies: env("NODE_ENV", "development") === "production",
    };
  },
  // Auction placeholders (Slice 4a). TODO(docs/16 §3): approved increment schedule by band/category is OPEN.
  get auction() {
    return {
      // Placeholder bid increment: single value, default 100 minor units (CAD $1.00). Not final (docs/16 §3 #3).
      bidIncrementMinor: Number(env("AUCTION_BID_INCREMENT_MINOR", "100")),
    };
  },
};

export function assertSafeFeatureFlags() {
  if (config.features.liveBiddingEnabled) {
    throw new Error(
      "FEATURE_LIVE_BIDDING_ENABLED must remain false: live bidding not permitted until approved/tested."
    );
  }
  if (config.features.realMoneyPaymentsEnabled) {
    throw new Error(
      "FEATURE_REAL_MONEY_PAYMENTS_ENABLED must remain false: real-money/escrow/payout flows not permitted."
    );
  }
}
