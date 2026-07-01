import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isFiAdminKeyTenantScopeAllowed,
  parseFiAdminKeyTenantAllowlist,
} from "./fiAdminKeyTenantScope";

const TENANT_A = "a0000000-0000-4000-8000-000000000001";
const TENANT_B = "b0000000-0000-4000-8000-000000000002";

describe("fiAdminKeyTenantScope", () => {
  it("parseFiAdminKeyTenantAllowlist returns null when unset", () => {
    assert.equal(parseFiAdminKeyTenantAllowlist(""), null);
    assert.equal(parseFiAdminKeyTenantAllowlist(undefined), null);
  });

  it("parseFiAdminKeyTenantAllowlist parses comma-separated UUIDs", () => {
    const set = parseFiAdminKeyTenantAllowlist(`${TENANT_A}, ${TENANT_B}`);
    assert.ok(set);
    assert.equal(set!.size, 2);
    assert.ok(set!.has(TENANT_A.toLowerCase()));
    assert.ok(set!.has(TENANT_B.toLowerCase()));
  });

  it("isFiAdminKeyTenantScopeAllowed allows any tenant when allowlist is null", () => {
    assert.equal(isFiAdminKeyTenantScopeAllowed(TENANT_A, null), true);
  });

  it("isFiAdminKeyTenantScopeAllowed denies tenants outside allowlist", () => {
    const allowlist = new Set([TENANT_A.toLowerCase()]);
    assert.equal(isFiAdminKeyTenantScopeAllowed(TENANT_A, allowlist), true);
    assert.equal(isFiAdminKeyTenantScopeAllowed(TENANT_B, allowlist), false);
  });
});