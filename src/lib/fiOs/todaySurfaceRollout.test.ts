import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { isTodaySurfaceEnabledForTenant } from "./todaySurfaceRollout.server";

const ENV_KEYS = ["FI_TODAY_SURFACE_ENABLED", "FI_TODAY_SURFACE_TENANT_IDS"] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

describe("isTodaySurfaceEnabledForTenant", () => {
  it("defaults to off when neither env var is set", () => {
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), false);
  });

  it("is off for an empty tenant id even when globally enabled", () => {
    process.env.FI_TODAY_SURFACE_ENABLED = "true";
    assert.equal(isTodaySurfaceEnabledForTenant(""), false);
    assert.equal(isTodaySurfaceEnabledForTenant("   "), false);
  });

  it("enables every tenant when FI_TODAY_SURFACE_ENABLED=true", () => {
    process.env.FI_TODAY_SURFACE_ENABLED = "true";
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), true);
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_B), true);
  });

  it("treats FI_TODAY_SURFACE_ENABLED case-insensitively", () => {
    process.env.FI_TODAY_SURFACE_ENABLED = "TRUE";
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), true);
  });

  it("ignores non-'true' values for FI_TODAY_SURFACE_ENABLED", () => {
    process.env.FI_TODAY_SURFACE_ENABLED = "1";
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), false);
  });

  it("matches a single tenant UUID in the allowlist", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = TENANT_A;
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), true);
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_B), false);
  });

  it("matches UUIDs case-insensitively", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = TENANT_A.toUpperCase();
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), true);
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A.toUpperCase()), true);
  });

  it("supports a comma-separated list of tenant ids", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = `${TENANT_A},${TENANT_B}`;
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), true);
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_B), true);
    assert.equal(isTodaySurfaceEnabledForTenant("33333333-3333-3333-3333-333333333333"), false);
  });

  it("trims whitespace around allowlist entries and the queried tenant id", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = `  ${TENANT_A} , ${TENANT_B}  `;
    assert.equal(isTodaySurfaceEnabledForTenant(`  ${TENANT_A}  `), true);
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_B), true);
  });

  it("ignores empty entries produced by trailing/double commas", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = `${TENANT_A},,  ,${TENANT_B},`;
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), true);
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_B), true);
  });

  it("matches a tenant slug when the caller supplies one and it's in the allowlist", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = "acme-clinic";
    assert.equal(
      isTodaySurfaceEnabledForTenant(TENANT_A, { tenantSlug: "acme-clinic" }),
      true
    );
  });

  it("does not match on slug when no slug is supplied and the id isn't the UUID form", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = "acme-clinic";
    assert.equal(isTodaySurfaceEnabledForTenant(TENANT_A), false);
  });

  it("matches slugs case-insensitively and trims whitespace", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = " Acme-Clinic ";
    assert.equal(
      isTodaySurfaceEnabledForTenant(TENANT_A, { tenantSlug: "  acme-clinic  " }),
      true
    );
  });

  it("does not require a matching slug when the UUID itself is allowlisted", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = TENANT_A;
    assert.equal(
      isTodaySurfaceEnabledForTenant(TENANT_A, { tenantSlug: "unrelated-slug" }),
      true
    );
  });
});
