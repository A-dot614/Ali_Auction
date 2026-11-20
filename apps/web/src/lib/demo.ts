/**
 * Build-time demo setting for the web app only. Next.js exposes public build
 * variables with NEXT_PUBLIC_*; VITE_DEMO_MODE is accepted as the equivalent
 * name requested for the demo. The value is read once at build time, never from
 * user input, and never forwarded to the API.
 *
 * Demo-only copy and data live in separate modules that are imported only from
 * demo-only routes/components, so a non-demo build cannot ship them.
 *
 * No backend flag is changed here. Real bidding and real-money payments stay OFF.
 */

export type DemoEnv = Record<string, string | undefined>;

export function demoModeFromEnv(env: DemoEnv): boolean {
  return env.NEXT_PUBLIC_DEMO_MODE === "true" || env.VITE_DEMO_MODE === "true";
}

/** A production build must never contain demo behaviour. */
export function assertDemoBuildAllowed(nodeEnv: string, isDemo: boolean): void {
  if (isDemo && nodeEnv === "production") {
    throw new Error(
      "DEMO_MODE_ENABLED_IN_PRODUCTION: demo mode is build-time only and cannot be used in a production build."
    );
  }
}
