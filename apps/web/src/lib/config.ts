/**
 * Web configuration. No secrets live here: only public API origin and a public
 * feature flag read from build/runtime config, never a user toggle (D4).
 */

export const webConfig = {
  apiOrigin: process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000",
  // Real-time UI is OFF by default. There is no Socket.io gateway in this slice (D4).
  realtimeEnabled: process.env.NEXT_PUBLIC_FEATURE_REALTIME_UI === "true",
  // NOT FOR PRODUCTION placeholder polling interval (D4).
  refetchIntervalMs: 15_000,
  // NOT FOR PRODUCTION placeholder cache TTL for public pages (D8).
  publicCacheTtlSeconds: 300,
} as const;

export type WebConfig = typeof webConfig;
