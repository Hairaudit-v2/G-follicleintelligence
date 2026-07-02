import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { isWorkspaceShellEnabledForTenant } from "./workspaceShellRollout.server";

const ENV_KEYS = ["FI_WORKSPACE_SHELL_ENABLED", "FI_WORKSPACE_SHELL_TENANT_IDS"] as const;

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

describe("isWorkspaceShellEnabledForTenant", () => {
  it("defaults to off", () => {
    assert.equal(isWorkspaceShellEnabledForTenant(TENANT_A), false);
  });

  it("enables globally when FI_WORKSPACE_SHELL_ENABLED=true", () => {
    process.env.FI_WORKSPACE_SHELL_ENABLED = "true";
    assert.equal(isWorkspaceShellEnabledForTenant(TENANT_A), true);
    assert.equal(isWorkspaceShellEnabledForTenant(TENANT_B), true);
  });

  it("matches tenant allowlist", () => {
    process.env.FI_WORKSPACE_SHELL_TENANT_IDS = `${TENANT_A}, ${TENANT_B}`;
    assert.equal(isWorkspaceShellEnabledForTenant(TENANT_A), true);
    assert.equal(isWorkspaceShellEnabledForTenant("33333333-3333-3333-3333-333333333333"), false);
  });
});
