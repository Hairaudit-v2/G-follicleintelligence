import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EnvValidationError, validateFullEnv } from "./schema";

const validProdBase = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role",
  CRON_SECRET: "sixteen_chars_min_",
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

  it("missing CRON_SECRET fails in production", () => {
    const e = { ...validProdBase() };
    delete e.CRON_SECRET;
    const r = validateFullEnv(e);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.issues.some((i) => i.variable === "CRON_SECRET"));
  });

  it("FI_PAYMENTS_ENABLED requires Stripe secrets in production", () => {
    const r = validateFullEnv({
      ...validProdBase(),
      FI_PAYMENTS_ENABLED: "true",
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.issues.some((i) => i.variable === "STRIPE_SECRET_KEY"));
      assert.ok(r.issues.some((i) => i.variable === "STRIPE_WEBHOOK_SECRET"));
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
