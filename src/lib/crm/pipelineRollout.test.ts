import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  isPipelineV1EnabledForTenant,
  parsePipelineV1TenantAllowlist,
} from "./pipelineRollout.server";

const ENV_KEY = "FI_PIPELINE_V1_TENANT_ALLOWLIST";

let savedEnv: string | undefined;

beforeEach(() => {
  savedEnv = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

describe("parsePipelineV1TenantAllowlist", () => {
  it("defaults to empty when unset", () => {
    assert.equal(parsePipelineV1TenantAllowlist(undefined).size, 0);
    assert.equal(parsePipelineV1TenantAllowlist("").size, 0);
  });

  it("trims whitespace and lowercases UUIDs", () => {
    const set = parsePipelineV1TenantAllowlist(`  ${TENANT_A.toUpperCase()} , ${TENANT_B}  `);
    assert.equal(set.has(TENANT_A), true);
    assert.equal(set.has(TENANT_B), true);
  });

  it("ignores malformed entries safely", () => {
    const set = parsePipelineV1TenantAllowlist(
      `${TENANT_A},not-a-uuid,acme-clinic,,${TENANT_B},email@example.com`
    );
    assert.equal(set.size, 2);
    assert.equal(set.has(TENANT_A), true);
    assert.equal(set.has(TENANT_B), true);
  });

  it("ignores wildcards so production tenants stay off", () => {
    assert.equal(parsePipelineV1TenantAllowlist("*").size, 0);
    assert.equal(parsePipelineV1TenantAllowlist("all").size, 0);
    assert.equal(parsePipelineV1TenantAllowlist("true").size, 0);
    assert.equal(parsePipelineV1TenantAllowlist(`*,${TENANT_A}`).has(TENANT_A), true);
    assert.equal(parsePipelineV1TenantAllowlist(`*,${TENANT_A}`).size, 1);
  });
});

describe("isPipelineV1EnabledForTenant", () => {
  it("defaults off when env is missing", async () => {
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), false);
  });

  it("returns true for an approved UUID", async () => {
    process.env[ENV_KEY] = TENANT_A;
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), true);
  });

  it("returns false for a non-approved UUID", async () => {
    process.env[ENV_KEY] = TENANT_A;
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_B), false);
  });

  it("normalizes whitespace on the queried tenant id", async () => {
    process.env[ENV_KEY] = ` ${TENANT_A} `;
    assert.equal(await isPipelineV1EnabledForTenant(`  ${TENANT_A}  `), true);
  });

  it("ignores malformed allowlist values", async () => {
    process.env[ENV_KEY] = "not-a-uuid,*,all";
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), false);
  });

  it("rejects empty or non-UUID tenant ids", async () => {
    process.env[ENV_KEY] = TENANT_A;
    assert.equal(await isPipelineV1EnabledForTenant(""), false);
    assert.equal(await isPipelineV1EnabledForTenant("   "), false);
    assert.equal(await isPipelineV1EnabledForTenant("acme-clinic"), false);
  });

  it("does not treat platform-admin identity as an allowlist entry", async () => {
    process.env[ENV_KEY] = "fi_admin,platform_admin,admin";
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), false);
  });

  it("does not enable every tenant via wildcard", async () => {
    process.env[ENV_KEY] = "*";
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), false);
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_B), false);
  });
});
