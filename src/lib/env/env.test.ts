import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EnvValidationError, validateFullEnv } from "./schema";

const validProdBase = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role",
});

describe("validateFullEnv", () => {
  it("valid minimal production env passes", () => {
    const r = validateFullEnv(validProdBase());
    assert.equal(r.ok, true);
  });

  it("throws descriptive EnvValidationError with variable names", () => {
    try {
      const r = validateFullEnv({ ...validProdBase(), NEXT_PUBLIC_SUPABASE_URL: "" });
      assert.equal(r.ok, false);
      if (!r.ok) {
        const err = new EnvValidationError(r.issues);
        assert.match(err.message, /NEXT_PUBLIC_SUPABASE_URL/);
        assert.match(err.message, /Invalid environment variables/);
        assert.ok(!err.message.includes("eyJ"));
      }
    } catch {
      assert.fail("expected validation result");
    }
  });

  it("respects SKIP_ENV_VALIDATION", () => {
    const r = validateFullEnv(
      { NODE_ENV: "production" },
      { skipValidation: true }
    );
    assert.equal(r.ok, true);
  });
});
