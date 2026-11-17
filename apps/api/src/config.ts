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
  // Search placeholders (Slice 5). TODO(docs/16 §8): approved query limits/search fields are OPEN.
  get search() {
    return {
      // NOT FOR PRODUCTION placeholder: approved query length limit is OPEN (docs/16 §8).
      maxQueryLength: Number(env("SEARCH_MAX_QUERY_LENGTH", "200")),
      defaultPageSize: 20,
      maxPageSize: 100,
    };
  },
  // Payment/fulfilment placeholders (Slice 6). All NOT FOR PRODUCTION.
  // TODO(docs/16 §4, §5, §6): provider, capture timing, fee payer/base/tax, shipping rates are OPEN.
  get payments() {
    return {
      // Fake-provider sandbox secret only; tests inject their own value. NOT FOR PRODUCTION.
      fakeWebhookSecret: env("FAKE_PAYMENT_WEBHOOK_SECRET", "fake-webhook-secret-placeholder-not-for-production"),
    };
  },
  get fees() {
    return {
      // Fallback placeholder; authoritative fee is snapshotted from fee_rules (docs/16 §4).
      buyerFeeBps: Number(env("BUYER_FEE_BPS", "800")),
    };
  },
  // Moderation/report placeholders (Slice 7). All NOT FOR PRODUCTION.
  // TODO(docs/16 §7 #5): prohibited/restricted item policy and report data limits are OPEN.
  get moderation() {
    return {
      // Placeholder maximum report-details length; approved limit is OPEN (docs/16 §7 #5).
      maxReportDetailsLength: Number(env("MAX_REPORT_DETAILS_LENGTH", "2000")),
    };
  },
  // Notification placeholders (Slice 8). All NOT FOR PRODUCTION.
  // TODO(docs/16 §7 #3, §8 #6): categories/copy/provider remain OPEN.
  get notifications() {
    return {
      // Placeholder retry cap; no approved delivery policy exists yet (docs/11 §6).
      maxDeliveryAttempts: Number(env("NOTIFICATION_MAX_DELIVERY_ATTEMPTS", "5")),
      batchSize: Number(env("NOTIFICATION_BATCH_SIZE", "100")),
    };
  },
  get fulfilment() {
    return {
      // No shipping rate decision exists yet; shipping fee stays 0 (docs/16 §6).
      shippingFeeMinor: Number(env("SHIPPING_FEE_MINOR", "0")),
    };
  },
  // Observability/security placeholders (Slice 10). NOT FOR PRODUCTION.
  get observability() {
    return {
      // Metrics bearer token. Required in production; tests inject a test token.
      metricsToken: env("METRICS_TOKEN", ""),
      // Placeholder dependency timeout, NOT FOR PRODUCTION (docs/13 §6).
      healthTimeoutMs: Number(env("HEALTH_DEPENDENCY_TIMEOUT_MS", "2000")),
      // Placeholder GraphQL depth cap, NOT FOR PRODUCTION (docs/16 does not cover it).
      graphqlMaxDepth: Number(env("GRAPHQL_MAX_DEPTH", "10")),
    };
  },
};

/** Production requires an explicit metrics token; never fall back to a default secret. */
export function assertMetricsTokenConfigured() {
  if (config.nodeEnv === "production" && !config.observability.metricsToken) {
    throw new Error("METRICS_TOKEN must be set in production.");
  }
}

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

/**
 * Slice 6 (D1): startup guard for money-moving features. Production startup must never see
 * FEATURE_REAL_MONEY_PAYMENTS_ENABLED enabled. Kept separate from assertSafeFeatureFlags so
 * tests can assert the money flag explicitly (docs/16 §5).
 */
export function assertMoneyFlagsOffForProduction() {
  if (config.nodeEnv === "production" && config.features.realMoneyPaymentsEnabled) {
    throw new Error(
      "FEATURE_REAL_MONEY_PAYMENTS_ENABLED must remain false in production: sandbox only."
    );
  }
}
