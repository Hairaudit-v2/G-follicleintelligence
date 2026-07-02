import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { isNavCollapseEnabledForTenant } from "./navCollapseRollout.server";

const ENV_KEYS = [
  "FI_TODAY_SURFACE_ENABLED",
  "FI_TODAY_SURFACE_TENANT_IDS",
  "FI_WORKSPACE_SHELL_ENABLED",
  "FI_WORKSPACE_SHELL_TENANT_IDS",
] as const;

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

describe("isNavCollapseEnabledForTenant", () => {
  it("defaults to off", () => {
    assert.equal(isNavCollapseEnabledForTenant(TENANT_A), false);
  });

  it("requires both Today surface and Workspace Shell", () => {
    process.env.FI_TODAY_SURFACE_ENABLED = "true";
    assert.equal(isNavCollapseEnabledForTenant(TENANT_A), false);

    delete process.env.FI_TODAY_SURFACE_ENABLED;
    process.env.FI_WORKSPACE_SHELL_ENABLED = "true";
    assert.equal(isNavCollapseEnabledForTenant(TENANT_A), false);

    process.env.FI_TODAY_SURFACE_ENABLED = "true";
    assert.equal(isNavCollapseEnabledForTenant(TENANT_A), true);
  });

  it("respects tenant allowlists for both flags", () => {
    process.env.FI_TODAY_SURFACE_TENANT_IDS = TENANT_A;
    process.env.FI_WORKSPACE_SHELL_TENANT_IDS = TENANT_A;
    assert.equal(isNavCollapseEnabledForTenant(TENANT_A), true);
    assert.equal(isNavCollapseEnabledForTenant("22222222-2222-2222-2222-222222222222"), false);
  });
});
