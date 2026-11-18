/**
 * Provider-neutral hosted-checkout contract support (Slice 13).
 * No provider names, SDK package names or network calls live in this module.
 * returnUrl/cancelUrl must be relative paths on the app origin and appear in the
 * allowlist; anything else is rejected with VALIDATION_ERROR.
 *
 * NOT FOR PRODUCTION (docs/16 §5 OPEN; FR-042 stays NOT MET).
 */

// Relative-path allowlist only. No absolute URLs, no scheme, no protocol-relative paths.
export const HOSTED_URL_ALLOWLIST = ["/checkout/return", "/checkout/cancel"] as const;

export function isAllowedHostedUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (/[\\]/.test(value)) return false;
  // Strip query/fragment for the allowlist check; the path itself must match exactly.
  const path = value.split(/[?#]/, 1)[0];
  return (HOSTED_URL_ALLOWLIST as readonly string[]).includes(path);
}

export function hostedRedirectPath(sessionId: string): string {
  // Internal test route only; nothing leaves the process.
  return `/test/payments/hosted-session/${sessionId}`;
}
