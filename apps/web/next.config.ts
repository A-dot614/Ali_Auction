import type { NextConfig } from "next";
import { assertDemoBuildAllowed, demoModeFromEnv } from "./src/lib/demo";

/**
 * Demo is a build-time web-only setting. VITE_DEMO_MODE is accepted as the
 * equivalent name: normalise it before Next inlines public build variables so
 * a single NEXT_PUBLIC_DEMO_MODE check can drive both routing and UI.
 */
if (process.env.VITE_DEMO_MODE === "true" && process.env.NEXT_PUBLIC_DEMO_MODE === undefined) {
  process.env.NEXT_PUBLIC_DEMO_MODE = "true";
}
const isDemo = demoModeFromEnv(process.env as Record<string, string | undefined>);

// Build-time safety: demo behaviour can never be compiled into a production build.
assertDemoBuildAllowed(process.env.NODE_ENV ?? "development", isDemo);

/**
 * Demo route files use the `.demo.tsx` page extension. Next.js only discovers
 * them when that extension is enabled, so a non-demo build cannot ship the demo
 * routes or their in-memory catalogue strings.
 */
const PAGE_EXTENSIONS = isDemo
  ? ["demo.tsx", "tsx", "ts", "jsx", "js"]
  : ["tsx", "ts", "jsx", "js"];

/**
 * D9 security headers. Restrictive CSP; HSTS only in production. The API origin
 * is public config, never a secret.
 */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000";

export function securityHeadersFor(
  nodeEnv: string,
  apiOrigin: string = API_ORIGIN
): Array<{ key: string; value: string }> {
  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' is required for Next.js inline bootstrap scripts until a nonce-based
    // CSP is implemented (placeholder pending review, docs/16 §8 #6).
    "script-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${apiOrigin}`,
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  const headers: Array<{ key: string; value: string }> = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
  if (nodeEnv === "production") {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  }
  return headers;
}

export const securityHeaders = securityHeadersFor(process.env.NODE_ENV ?? "development");

const nextConfig: NextConfig = {
  pageExtensions: PAGE_EXTENSIONS,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
