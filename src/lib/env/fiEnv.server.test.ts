import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertFiServerEnv, FiEnvValidationError, validateFiServerEnv } from "./fiEnv.server";

const validProdBase = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role",
  CRON_SECRET: "sixteen_chars_min_",
});

describe("validateFiServerEnv", () => {
  it("valid minimal production env passes", () => {
    const r = validateFiServerEnv(validProdBase());
    assert.equal(r.ok, true);
  });

  it("missing Supabase URL fails in production", () => {
    const e = { ...validProdBase(), NEXT_PUBLIC_SUPABASE_URL: "" };
    const r = validateFiServerEnv(e);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("NEXT_PUBLIC_SUPABASE_URL"));
  });

  it("invalid Supabase URL fails in production", () => {
    const e = { ...validProdBase(), NEXT_PUBLIC_SUPABASE_URL: "not-a-url" };
    const r = validateFiServerEnv(e);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("NEXT_PUBLIC_SUPABASE_URL"));
  });

  it("production FI_ALLOW_INSECURE_API=true fails", () => {
    const r = validateFiServerEnv({ ...validProdBase(), FI_ALLOW_INSECURE_API: "true" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("FI_ALLOW_INSECURE_API"));
  });

  it("production FI_ALLOW_ADMIN_KEY_QUERY=true fails", () => {
    const r = validateFiServerEnv({ ...validProdBase(), FI_ALLOW_ADMIN_KEY_QUERY: "1" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("FI_ALLOW_ADMIN_KEY_QUERY"));
  });

  it("production FI_ENABLE_DEV_ADMIN_ACCESS=true fails", () => {
    const r = validateFiServerEnv({ ...validProdBase(), FI_ENABLE_DEV_ADMIN_ACCESS: "true" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("FI_ENABLE_DEV_ADMIN_ACCESS"));
  });

  it("production SKIP_ENV_VALIDATION=true fails", () => {
    const r = validateFiServerEnv({ ...validProdBase(), SKIP_ENV_VALIDATION: "1" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("SKIP_ENV_VALIDATION"));
  });

  it("FI_ADMIN_API_KEY too short fails", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_ADMIN_API_KEY: "short",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("FI_ADMIN_API_KEY"));
  });

  it("cron secret too short fails", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_REMINDER_CRON_SECRET: "fifteen_chars__",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("FI_REMINDER_CRON_SECRET"));
  });

  it("CRON_SECRET too short fails", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      CRON_SECRET: "123456789012345",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("CRON_SECRET"));
  });

  it("missing CRON_SECRET fails in production", () => {
    const e = { ...validProdBase() };
    delete e.CRON_SECRET;
    const r = validateFiServerEnv(e);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("CRON_SECRET"));
  });

  it("FI_PAYMENTS_ENABLED requires Stripe secrets in production", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_PAYMENTS_ENABLED: "true",
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.includes("STRIPE_SECRET_KEY"));
      assert.ok(r.errors.includes("STRIPE_WEBHOOK_SECRET"));
    }
  });

  it("FI_PAYMENTS_ENABLED passes when Stripe secrets are set", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_PAYMENTS_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_live_placeholder_key_12345",
      STRIPE_WEBHOOK_SECRET: "whsec_placeholder_secret_12345",
    });
    assert.equal(r.ok, true);
  });

  it("FI_HR_SYNC_CRON_SECRET too short fails", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_HR_SYNC_CRON_SECRET: "123456789012345",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("FI_HR_SYNC_CRON_SECRET"));
  });

  it("non-production minimal env passes with empty Supabase URL", () => {
    const r = validateFiServerEnv({ NODE_ENV: "development" });
    assert.equal(r.ok, true);
  });

  it("non-production still rejects malformed URL when present", () => {
    const r = validateFiServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "not-a-valid-url",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("NEXT_PUBLIC_SUPABASE_URL"));
  });

  it("errors list variable names only, not secret values", () => {
    const secret = "super-secret-admin-key-123456";
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_ADMIN_API_KEY: "tooshort",
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      const joined = r.errors.join(" ");
      assert.ok(!joined.includes("tooshort"));
      assert.ok(!joined.includes(secret));
    }
  });

  it("production live email reminders require Resend vars", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_REMINDERS_LIVE_DELIVERY: "true",
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.includes("RESEND_API_KEY"));
      assert.ok(r.errors.includes("RESEND_FROM_EMAIL"));
    }
  });

  it("production legacy API enabled requires long FI_LEGACY_FI_API_SECRET", () => {
    const r = validateFiServerEnv({
      ...validProdBase(),
      FI_LEGACY_FI_API_ENABLED: "true",
      FI_LEGACY_FI_API_SECRET: "tooshort",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.includes("FI_LEGACY_FI_API_SECRET"));
  });
});

describe("assertFiServerEnv", () => {
  it("throws FiEnvValidationError with names only", () => {
    assert.throws(
      () =>
        assertFiServerEnv({
          NODE_ENV: "production",
          NEXT_PUBLIC_SUPABASE_URL: "",
        }),
      (e: unknown) =>
        e instanceof FiEnvValidationError &&
        (e as FiEnvValidationError).errors.includes("NEXT_PUBLIC_SUPABASE_URL")
    );
  });
});
