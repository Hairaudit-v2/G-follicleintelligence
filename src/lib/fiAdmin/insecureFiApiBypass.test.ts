import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isInsecureFiApiBypassAllowed } from "./insecureFiApiBypass";

describe("isInsecureFiApiBypassAllowed", () => {
  it("defaults to secure when FI_ALLOW_INSECURE_API is unset (e.g. development)", () => {
    assert.equal(isInsecureFiApiBypassAllowed({ NODE_ENV: "development" }), false);
  });

  it("does not bypass in development without explicit flag", () => {
    assert.equal(
      isInsecureFiApiBypassAllowed({ NODE_ENV: "development", FI_ALLOW_INSECURE_API: "" }),
      false
    );
    assert.equal(
      isInsecureFiApiBypassAllowed({ NODE_ENV: "development", FI_ALLOW_INSECURE_API: "false" }),
      false
    );
  });

  it("allows bypass in development when FI_ALLOW_INSECURE_API is affirmative", () => {
    assert.equal(
      isInsecureFiApiBypassAllowed({ NODE_ENV: "development", FI_ALLOW_INSECURE_API: "true" }),
      true
    );
    assert.equal(
      isInsecureFiApiBypassAllowed({ NODE_ENV: "development", FI_ALLOW_INSECURE_API: "1" }),
      true
    );
    assert.equal(
      isInsecureFiApiBypassAllowed({ NODE_ENV: "development", FI_ALLOW_INSECURE_API: " YES " }),
      true
    );
  });

  it("never bypasses in production even if flag is set", () => {
    assert.equal(
      isInsecureFiApiBypassAllowed({ NODE_ENV: "production", FI_ALLOW_INSECURE_API: "true" }),
      false
    );
    assert.equal(
      isInsecureFiApiBypassAllowed({ NODE_ENV: "production", FI_ALLOW_INSECURE_API: "1" }),
      false
    );
  });

  it("missing env keys default to secure", () => {
    assert.equal(isInsecureFiApiBypassAllowed({}), false);
  });

  it("treats non-production node env with flag as bypass (e.g. test)", () => {
    assert.equal(isInsecureFiApiBypassAllowed({ NODE_ENV: "test", FI_ALLOW_INSECURE_API: "yes" }), true);
  });
});
