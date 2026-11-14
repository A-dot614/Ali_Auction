import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createHandler } from "graphql-http/lib/use/express";
import { schema } from "./graphql/schema.js";
import { assertSafeFeatureFlags, config } from "./config.js";
import { buildAuthContext } from "./graphql/resolvers/identity.js";
import { authRateLimiter, strictAuthRateLimiter } from "./middleware/rateLimit.js";

// Load env from app-local or monorepo root (pnpm runs scripts from package dirs).
for (const p of [".env", "../../.env"]) {
  const abs = resolve(process.cwd(), p);
  if (existsSync(abs)) dotenv.config({ path: abs, override: false });
}

// Safety: never allow live bidding or real-money flows to be enabled by default/config in this phase.
assertSafeFeatureFlags();

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: process.env.APP_URL || "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "aliauction-api",
      phase: "phase-1-identity-access",
      timestamp: new Date().toISOString(),
    });
  });

  // Rate limit auth-sensitive GraphQL operations (register/login/reset) via coarse endpoint limits.
  // TODO(docs/10): per-operation limits and Redis-backed limiter for distributed deployments.
  app.use("/graphql", (req, res, next) => {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (/requestPasswordReset|resetPassword|register|login/.test(body)) {
      return strictAuthRateLimiter(req, res, next);
    }
    return authRateLimiter(req, res, next);
  });

  app.all(
    "/graphql",
    createHandler({
      schema,
      context: async (req, params) => {
        // graphql-http provides raw IncomingMessage; params.context has res in express adapter.
        const rawReq: any = req.raw;
        const res: any = (req as any).context?.res || (params as any)?.context?.res;
        // ensure cookies parsed on raw req for our helper
        if (res?.req?.cookies) rawReq.cookies = res.req.cookies;
        else if ((req as any).context?.req?.cookies) rawReq.cookies = (req as any).context.req.cookies;
        // fallback: parse from header if needed (cookie-parser ran on express req)
        if (!rawReq.cookies && rawReq.headers?.cookie) {
          // minimal parse
          rawReq.cookies = Object.fromEntries(
            rawReq.headers.cookie.split(";").map((c: string) => {
              const i = c.indexOf("=");
              return [decodeURIComponent(c.slice(0, i).trim()), decodeURIComponent(c.slice(i + 1).trim())];
            })
          );
        }
        return buildAuthContext(rawReq, res);
      },
    })
  );

  return app;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isDirectRun) {
  const app = createApp();
  app.listen(config.apiPort, () => {
    // eslint-disable-next-line no-console
    console.log(`AliAuction API listening on http://localhost:${config.apiPort}`);
    console.log(`GraphQL endpoint: http://localhost:${config.apiPort}/graphql`);
  });
}

