import { config } from "../config.js";

/**
 * Decision-independent structure for FR-004. Profile edits that need no email policy
 * are already exposed through `auth/service.ts:updateMyProfile`; this module states the
 * allowed field set explicitly. Email change itself stays unimplemented and returns
 * NOT_ENABLED. Re-verification rules are a required input with NO default.
 */

export const PROFILE_EDIT_FIELDS = ["displayName", "bio", "provinceCode"] as const;
export type ProfileEditField = (typeof PROFILE_EDIT_FIELDS)[number];

export function assertProfileEditFields(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    if (key === "email" || key === "emailVerified" || key === "status") {
      throw new Error("NOT_ENABLED: email/account-status changes are not part of profile editing.");
    }
    if (!(PROFILE_EDIT_FIELDS as readonly string[]).includes(key)) {
      throw new Error(`VALIDATION_ERROR: unsupported profile field ${key}.`);
    }
  }
}

/** Required decision-dependent policy input: no default value exists. */
export function requireEmailChangeReverification(): string {
  const value = config.account.emailChangeReverification.trim();
  if (!value) {
    throw new Error("NOT_CONFIGURED: EMAIL_CHANGE_REVERIFICATION has no default; a decision is required.");
  }
  return value;
}

export async function requestEmailChange(): Promise<never> {
  throw new Error("NOT_ENABLED: email change is not implemented.");
}

export async function confirmEmailChange(): Promise<never> {
  throw new Error("NOT_ENABLED: email change is not implemented.");
}
