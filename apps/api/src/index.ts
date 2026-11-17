import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createHandler } from "graphql-http/lib/use/express";
import { createClient } from "redis";
import { schema } from "./graphql/schema.js";
import {
  assertMetricsTokenConfigured,
  assertMoneyFlagsOffForProduction,
  assertSafeFeatureFlags,
  config,
} from "./config.js";
import { buildAuthContext } from "./graphql/resolvers/identity.js";
import {
  createRateLimiters,
  AUTH_SENSITIVE_OPERATIONS,
  WRITE_SENSITIVE_OPERATIONS,
  type RateLimitConfig,
} from "./middleware/rateLimit.js";
import { handleWebhook } from "./payments/service.js";
import { query } from "./db.js";
import { createLogger, type LogSink } from "./logging/logger.js";
import { attachRequestId, requestLogging } from "./middleware/requestContext.js";
import { metrics } from "./observability/metrics.js";
import { liveness, readiness, type ReadinessDeps } from "./observability/health.js";
import { depthLimitRule, productionFormatError } from "./graphql/limits.js";

// Load env from app-local or monorepo root (pnpm runs scripts from package dirs).
for (const p of [".env", "../../.env"]) {
  const abs = resolve(process.cwd(), p);
  if (existsSync(abs)) dotenv.config({ path: abs, override: false });
}

assertSafeFeatureFlags();
assertMoneyFlagsOffForProduction();
assertMetricsTokenConfigured();

export type CreateAppOptions = {
  clock?: () => Date;
  logSink?: LogSink;
  rateLimits?: RateLimitConfig;
  healthDeps?: Partial<ReadinessDeps>;
  metricsToken?: string;
};

async function redisPing(): Promise<void> {
  const client = createClient({ url: config.redisUrl || undefined });
  await client.connect();
  try {
    await client.ping();
  } finally {
    await client.quit();
  }
}

export function createApp(opts: CreateAppOptions = {}) {
  const app = express();
  const clock = opts.clock ?? (() => new Date());
  const logger = createLogger({ clock, sink: opts.logSink });
  const limits = createRateLimiters(opts.rateLimits);
  const metricsToken = opts.metricsToken ?? config.observability.metricsToken;

  app.set("trust proxy", 1);
  app.use(cors({ origin: process.env.APP_URL || "http://localhost:3000", credentials: true }));
  app.use(cookieParser());
  app.use(attachRequestId);

  app.post("/webhooks/payments/fake", express.raw({ type: "*/*" }), async (req, res) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      const result = await handleWebhook("fake", raw, req.headers as Record<string, unknown>);
      res.json(result);
    } catch (err: any) {
      const code = String(err?.message || "INTERNAL_ERROR").split(":")[0];
      const status = code === "INVALID_SIGNATURE" ? 401 : code === "REAL_MONEY_DISABLED" ? 403 : 400;
      res.status(status).json({ error: { code, message: err?.message || code } });
    }
  });

  app.use(express.json());
  app.use(
    requestLogging(logger, clock, ({ method, path, status, durationMs }) => {
      const statusClass = `${Math.floor(status / 100)}xx`;
      metrics.increment("http_requests_total", { method, route: path, status_class: statusClass });
      metrics.observe("http_request_duration_ms", durationMs);
    })
  );

  // Existing /health route kept unchanged in behaviour.
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "aliauction-api",
      phase: "phase-1-identity-access",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health/live", (_req, res) => {
    res.status(200).json(liveness());
  });

  const healthDeps: ReadinessDeps = {
    postgres: () => query("SELECT 1").then(() => undefined),
    redis: redisPing,
    timeoutMs: config.observability.healthTimeoutMs,
    ...opts.healthDeps,
  };
  app.get("/health/ready", async (_req, res) => {
    const result = await readiness(healthDeps);
    res.status(result.status === "ok" ? 200 : 503).json(result);
  });

  app.get("/metrics", async (req, res) => {
    if (!metricsToken || req.header("authorization") !== `Bearer ${metricsToken}`) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized." } });
      return;
    }
    const result = await query(
      `SELECT count(*)::int AS c, min(created_at) AS oldest FROM outbox_events WHERE published_at IS NULL`
    );
    metrics.setGauge("outbox_unpublished_rows", result.rows[0].c);
    const oldest = result.rows[0].oldest;
    const age = oldest ? Math.max(0, (clock().getTime() - new Date(oldest).getTime()) / 1000) : 0;
    metrics.setGauge("outbox_oldest_unpublished_age_seconds", age);
    res.type("text/plain").send(metrics.render());
  });

  app.use("/graphql", (req, res, next) => {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (AUTH_SENSITIVE_OPERATIONS.test(body) || WRITE_SENSITIVE_OPERATIONS.test(body)) {
      return limits.strict(req, res, next);
    }
    return limits.general(req, res, next);
  });

  app.all(
    "/graphql",
    createHandler({
      schema,
      validationRules: [depthLimitRule(config.observability.graphqlMaxDepth)],
      ...(config.nodeEnv === "production" ? { formatError: productionFormatError } : {}),
      context: async (req, params) => {
        const rawReq: any = req.raw;
        const res: any = (req as any).context?.res || (params as any)?.context?.res;
        if (res?.req?.cookies) rawReq.cookies = res.req.cookies;
        else if ((req as any).context?.req?.cookies) rawReq.cookies = (req as any).context.req.cookies;
        if (!rawReq.cookies && rawReq.headers?.cookie) {
          rawReq.cookies = Object.fromEntries(
            rawReq.headers.cookie.split(";").map((c: string) => {
              const i = c.indexOf("=");
              return [decodeURIComponent(c.slice(0, i).trim()), decodeURIComponent(c.slice(i + 1).trim())];
            })
          );
        }
        rawReq.requestId = (req as any).requestId ?? (res?.req as any)?.requestId;
        return buildAuthContext(rawReq, res);
      },
    })
  );

  // No stack traces in error responses, in any environment.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const code = String(err?.message || "INTERNAL_ERROR").split(":")[0];
    const safeCode = /^[A-Z][A-Z0-9_]*$/.test(code) ? code : "INTERNAL_ERROR";
    res.status(500).json({
      error: {
        code: safeCode,
        message: config.nodeEnv === "production" ? "Internal error." : String(err?.message || "Internal error."),
      },
    });
  });

  return app;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isDirectRun) {
  const app = createApp();
  app.listen(config.apiPort, () => {
    console.log(`AliAuction API listening on http://localhost:${config.apiPort}`);
    console.log(`GraphQL endpoint: http://localhost:4000/graphql`);
  });
}
