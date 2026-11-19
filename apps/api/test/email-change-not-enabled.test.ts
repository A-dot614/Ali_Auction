import { afterEach, describe, expect, it } from "vitest";
import { config, assertSafeFeatureFlags } from "../src/config.js";
import {
  PROFILE_EDIT_FIELDS,
  assertProfileEditFields,
  confirmEmailChange,
  requestEmailChange,
  requireEmailChangeReverification,
} from "../src/auth/emailChange.js";

const FLAG = "FEATURE_EMAIL_CHANGE_ENABLED";
const POLICY = "EMAIL_CHANGE_REVERIFICATION";
const originalFlag = process.env[FLAG];
const originalPolicy = process.env[POLICY];

afterEach(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
  if (originalPolicy === undefined) delete process.env[POLICY];
  else process.env[POLICY] = originalPolicy;
});

describe("profile editing without an email-change policy", () => {
  it("email-change flag defaults OFF and the startup guard throws when enabled", () => {
    delete process.env[FLAG];
    expect(config.features.emailChangeEnabled).toBe(false);
    process.env[FLAG] = "true";
    expect(() => assertSafeFeatureFlags()).toThrow(/FEATURE_EMAIL_CHANGE_ENABLED/);
  });

  it("profile edit fields are explicit and exclude email/account status", () => {
    expect(PROFILE_EDIT_FIELDS).toEqual(["displayName", "bio", "provinceCode"]);
    expect(() => assertProfileEditFields({ displayName: "A", bio: "B", provinceCode: "AB" })).not.toThrow();
    expect(() => assertProfileEditFields({ email: "x@example.com" })).toThrow(/NOT_ENABLED/);
    expect(() => assertProfileEditFields({ emailVerified: true })).toThrow(/NOT_ENABLED/);
    expect(() => assertProfileEditFields({ status: "active" })).toThrow(/NOT_ENABLED/);
    expect(() => assertProfileEditFields({ unknown: "x" })).toThrow(/VALIDATION_ERROR/);
  });

  it("re-verification policy has no default and email change stays NOT_ENABLED", async () => {
    delete process.env[POLICY];
    expect(config.account.emailChangeReverification).toBe("");
    expect(() => requireEmailChangeReverification()).toThrow(/NOT_CONFIGURED/);
    process.env[POLICY] = "owner-supplied-rule";
    expect(requireEmailChangeReverification()).toBe("owner-supplied-rule");
    await expect(requestEmailChange()).rejects.toThrow(/NOT_ENABLED/);
    await expect(confirmEmailChange()).rejects.toThrow(/NOT_ENABLED/);
  });
});
