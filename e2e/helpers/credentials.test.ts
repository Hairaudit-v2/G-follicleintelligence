import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  hasDemoCredentials,
  hasLowRoleCredentials,
  hasProductionAdminCredentials,
} from "./credentials";

const DEMO_KEYS = [
  "FI_E2E_DEMO_ADMIN_EMAIL",
  "FI_E2E_DEMO_ADMIN_PASSWORD",
  "FI_E2E_TENANT_ID",
] as const;

const PROD_KEYS = [
  "FI_E2E_PRODUCTION_ADMIN_EMAIL",
  "FI_E2E_PRODUCTION_ADMIN_PASSWORD",
  "FI_E2E_TENANT_ID",
  "FI_E2E_BASE_URL",
] as const;

const LOW_KEYS = ["FI_E2E_LOW_ROLE_EMAIL", "FI_E2E_LOW_ROLE_PASSWORD", "FI_E2E_TENANT_ID"] as const;

describe("hasDemoCredentials", () => {
  let saved: Partial<Record<(typeof DEMO_KEYS)[number], string | undefined>>;

  beforeEach(() => {
    saved = {};
    for (const key of DEMO_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of DEMO_KEYS) {
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

describe("hasProductionAdminCredentials", () => {
  let saved: Partial<Record<(typeof PROD_KEYS)[number], string | undefined>>;

  beforeEach(() => {
    saved = {};
    for (const key of PROD_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of PROD_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("requires base URL plus production admin email/password/tenant", () => {
    process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL = "admin@example.test";
    process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD = "secret";
    process.env.FI_E2E_TENANT_ID = "tenant-1";
    assert.equal(hasProductionAdminCredentials(), false);
    process.env.FI_E2E_BASE_URL = "https://follicleintelligence.ai";
    assert.equal(hasProductionAdminCredentials(), true);
  });
});

describe("hasLowRoleCredentials", () => {
  let saved: Partial<Record<(typeof LOW_KEYS)[number], string | undefined>>;

  beforeEach(() => {
    saved = {};
    for (const key of LOW_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of LOW_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns false when unset and true when all present", () => {
    assert.equal(hasLowRoleCredentials(), false);
    process.env.FI_E2E_LOW_ROLE_EMAIL = "viewer@example.test";
    process.env.FI_E2E_LOW_ROLE_PASSWORD = "secret";
    process.env.FI_E2E_TENANT_ID = "tenant-1";
    assert.equal(hasLowRoleCredentials(), true);
  });
});
