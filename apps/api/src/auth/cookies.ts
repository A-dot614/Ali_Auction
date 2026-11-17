import type { CookieOptions } from "express";

/** D10 (secure cookie attributes): reusable, testable cookie options. */
export function sessionCookieOptions(secureCookies: boolean, expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
