import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { timingSafeUtf8Equal } from "./timingSafeSecret";

describe("timingSafeUtf8Equal", () => {
  it("returns true for identical strings", () => {
    assert.equal(timingSafeUtf8Equal("same-secret-value-here", "same-secret-value-here"), true);
  });

  it("returns false for different strings of same length", () => {
    assert.equal(timingSafeUtf8Equal("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"), false);
  });

  it("returns false when lengths differ", () => {
    assert.equal(timingSafeUtf8Equal("short", "longer-value-here"), false);
  });
});
