import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { hasDemoCredentials } from "./credentials";

const KEYS = [
  "FI_E2E_DEMO_ADMIN_EMAIL",
  "FI_E2E_DEMO_ADMIN_PASSWORD",
  "FI_E2E_TENANT_ID",
] as const;

describe("hasDemoCredentials", () => {
  let saved: Partial<Record<(typeof KEYS)[number], string | undefined>>;

  beforeEach(() => {
    saved = {};
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns false when any credential is unset", () => {
    process.env.FI_E2E_DEMO_ADMIN_PASSWORD = "secret";
    process.env.FI_E2E_TENANT_ID = "tenant-1";
    assert.equal(hasDemoCredentials(), false);
  });

  it("returns false when email/password/tenant are whitespace-only", () => {
    process.env.FI_E2E_DEMO_ADMIN_EMAIL = "  ";
    process.env.FI_E2E_DEMO_ADMIN_PASSWORD = "\t";
    process.env.FI_E2E_TENANT_ID = " ";
    assert.equal(hasDemoCredentials(), false);
  });

  it("returns true when email, password, and tenant are non-empty", () => {
    process.env.FI_E2E_DEMO_ADMIN_EMAIL = "demo@example.test";
    process.env.FI_E2E_DEMO_ADMIN_PASSWORD = "secret";
    process.env.FI_E2E_TENANT_ID = "tenant-1";
    assert.equal(hasDemoCredentials(), true);
  });
});
