/**
 * Web mirror of the API's no-policy profile edit allowlist in
 * apps/api/src/auth/emailChange.ts. Email and account-status fields are excluded.
 */

export const PROFILE_EDIT_FIELDS = ["displayName", "bio", "provinceCode"] as const;
export type ProfileEditField = (typeof PROFILE_EDIT_FIELDS)[number];

export function isProfileEditField(key: string): key is ProfileEditField {
  return (PROFILE_EDIT_FIELDS as readonly string[]).includes(key);
}
