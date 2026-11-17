import test from "node:test";
import assert from "node:assert/strict";
import { ERROR_MESSAGES, errorCode, messageForError } from "../src/lib/errors.ts";

test("error code mapper: every stable API error code used in the web app has a placeholder message and no raw server text is returned", () => {
  const codes = Object.keys(ERROR_MESSAGES);
  assert.ok(codes.length >= 15);
  for (const code of codes) {
    const message = messageForError(`${code}: sensitive raw detail ${code}`);
    assert.ok(message.length > 0);
    assert.ok(!message.includes("sensitive raw detail"), `no raw text for ${code}`);
    assert.ok(!message.includes(code), `code itself is not shown for ${code}`);
  }
  assert.equal(errorCode("FORBIDDEN: Insufficient permissions."), "FORBIDDEN");
  assert.equal(errorCode("Something unstructured"), null);
  assert.equal(messageForError("TOTALLY_NEW_CODE: raw"), "Something went wrong. Please try again.");
});
