import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  isTodaySurfaceStaffBakeAllowed,
  type TodaySurfaceStaffBakeGateInput,
} from "./todaySurfaceStaffBakeGate.server";

const ENV_KEYS = ["FI_TODAY_SURFACE_USER_EMAILS", "FI_TODAY_SURFACE_USER_IDS"] as const;

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

const AUTH_USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function gate(input: Partial<TodaySurfaceStaffBakeGateInput> = {}): boolean {
  return isTodaySurfaceStaffBakeAllowed({
    authUserId: AUTH_USER,
    userEmail: null,
    osRole: null,
    fiUserRole: null,
    hasActiveTenantAdminProfile: false,
    ...input,
  });
}

describe("isTodaySurfaceStaffBakeAllowed", () => {
  it("fails closed when auth user is missing", () => {
    assert.equal(
      isTodaySurfaceStaffBakeAllowed({
        authUserId: null,
        osRole: "fi_platform_admin",
      }),
      false
    );
  });

  it("allows platform admin OS role", () => {
    assert.equal(gate({ osRole: "fi_platform_admin" }), true);
  });

  it("allows fi_admin OS role", () => {
    assert.equal(gate({ osRole: "fi_admin" }), true);
  });

  it("allows tenant owner via fi_users role", () => {
    assert.equal(gate({ fiUserRole: "owner" }), true);
  });

  it("allows tenant admin via fi_users role", () => {
    assert.equal(gate({ fiUserRole: "admin" }), true);
  });

  it("allows active tenant backend admin profile", () => {
    assert.equal(gate({ hasActiveTenantAdminProfile: true }), true);
  });

  it("blocks normal staff viewers when tenant Today is enabled", () => {
    assert.equal(
      gate({
        fiUserRole: "member",
        osRole: "fi_nurse",
      }),
      false
    );
  });

  it("allows explicit email allowlist match", () => {
    process.env.FI_TODAY_SURFACE_USER_EMAILS = "founder@example.com,other@example.com";
    assert.equal(gate({ userEmail: "Founder@Example.com" }), true);
    assert.equal(gate({ userEmail: "staff@example.com" }), false);
  });

  it("allows explicit user id allowlist match", () => {
    process.env.FI_TODAY_SURFACE_USER_IDS = `${AUTH_USER},${OTHER_USER}`;
    assert.equal(gate({ authUserId: OTHER_USER }), true);
    assert.equal(
      gate({
        authUserId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      }),
      false
    );
  });

  it("prefers allowlist over blocked staff role", () => {
    process.env.FI_TODAY_SURFACE_USER_IDS = AUTH_USER;
    assert.equal(
      gate({
        authUserId: AUTH_USER,
        fiUserRole: "member",
        osRole: "fi_nurse",
      }),
      true
    );
  });
});
