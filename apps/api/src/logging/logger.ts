import { randomUUID } from "node:crypto";

/**
 * D1/D2 (Slice 10): structured JSON-line logger with enforced recursive redaction.
 * Redaction lives here, not at call sites. The timestamp uses the injected clock
 * wherever one is supplied.
 */

const DENY_KEYS = [
  "password", "passwordhash", "password_hash", "token", "tokenhash", "token_hash",
  "secret", "authorization", "cookie", "set-cookie", "session", "sessionid",
  "webhooksecret", "webhook_secret", "x-fake-signature", "card", "cvv", "pan",
  "email", "phone", "address", "shipping_address_snapshot", "legal_name", "storage_key",
] as const;

const normalize = (key: string) => key.toLowerCase().replace(/[_-]/g, "");
const DENY_SET = new Set<string>(DENY_KEYS.map(normalize));
const REDACTED = "[REDACTED]";
const MAX_FIELDS = 20;
const MAX_DEPTH = 12;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = DENY_SET.has(normalize(key)) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export type LogLevel = "info" | "warn" | "error";
export type LogSink = (line: string) => void;
export type LoggerOptions = {
  clock?: () => Date;
  sink?: LogSink;
  requestId?: string | null;
};

export type Logger = {
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  child: (requestId: string) => Logger;
};

/** Accept only a valid UUID request id; otherwise generate one. */
export function normalizeRequestId(raw: unknown, clock?: () => Date): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof raw === "string" && uuid.test(raw)) return raw;
  void clock;
  return randomUUID();
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  // In tests the default sink is a no-op; tests that assert logs inject an explicit sink.
  const sink = opts.sink ?? (process.env.NODE_ENV === "test" ? () => undefined : (line: string) => console.log(line));
  const clock = opts.clock ?? (() => new Date());
  const emit = (level: LogLevel, msg: string, fields: Record<string, unknown> = {}) => {
    const safe = (redact(fields, 1) || {}) as Record<string, unknown>;
    const entries = Object.entries(safe).slice(0, MAX_FIELDS);
    const record = {
      level,
      msg,
      time: clock().toISOString(),
      ...(opts.requestId ? { requestId: opts.requestId } : {}),
      ...Object.fromEntries(entries),
    };
    sink(JSON.stringify(record));
  };
  return {
    info: (msg, fields) => emit("info", msg, fields ?? {}),
    warn: (msg, fields) => emit("warn", msg, fields ?? {}),
    error: (msg, fields) => emit("error", msg, fields ?? {}),
    child: (requestId: string) => createLogger({ ...opts, requestId }),
  };
}

export const logger = createLogger();
