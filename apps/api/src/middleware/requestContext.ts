import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { type Logger } from "../logging/logger.js";

/**
 * D1/D3 (Slice 10): request id propagation and request logging.
 * Only method, path (no query), status, duration, requestId and GraphQL operation
 * name are logged. Bodies, variables, query strings and other headers are never logged.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const raw = req.header("x-request-id");
  const id = typeof raw === "string" && UUID.test(raw) ? raw : randomUUID();
  (req as any).requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

function operationNameFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const query = (body as any).query;
  if (typeof query !== "string") return undefined;
  const match = query.match(/\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : undefined;
}

export function requestLogging(
  logger: Logger,
  clock: () => Date = () => new Date(),
  onFinish?: (fields: { method: string; path: string; status: number; durationMs: number }) => void
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = clock().getTime();
    res.on("finish", () => {
      const requestId = ((req as any).requestId as string) ?? randomUUID();
      const durationMs = clock().getTime() - started;
      const fields: Record<string, unknown> = {
        method: req.method,
        path: req.path, // no query string
        status: res.statusCode,
        duration_ms: durationMs,
        requestId,
      };
      const operation = operationNameFromBody((req as any).body);
      if (operation) fields.operationName = operation;
      logger.info("http_request", fields);
      if (onFinish) {
        onFinish({ method: req.method, path: req.path, status: res.statusCode, durationMs });
      }
    });
    next();
  };
}
