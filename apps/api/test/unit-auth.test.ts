import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password.js";
import { generateToken, hashToken } from "../src/auth/tokens.js";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toBeTypeOf("string");
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});

describe("tokens", () => {
  it("generates random tokens and stable hashes", () => {
    const t1 = generateToken(32);
    const t2 = generateToken(32);
    expect(t1).not.toEqual(t2);
    expect(hashToken(t1)).toEqual(hashToken(t1));
    expect(hashToken(t1)).not.toEqual(hashToken(t2));
    expect(hashToken(t1)).toMatch(/^[a-f0-9]{64}$/);
  });
});
