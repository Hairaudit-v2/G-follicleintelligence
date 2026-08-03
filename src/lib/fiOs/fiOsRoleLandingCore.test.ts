import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFiOsTenantHomeHref,
  resolveFiOsPostLoginPathSuffix,
} from "@/src/lib/fiOs/fiOsRoleLandingCore";

const TID = "c2615b95-b707-4485-aa5f-be8f78ec868a";

describe("resolveFiOsPostLoginPathSuffix", () => {
  it("lands all roles on /today (D6G)", () => {
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_consultant" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_doctor" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_nurse" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_clinic_admin" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "reception" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "consultant" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({ tenantAdminRole: "finance_admin" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({ workspaceProfile: "reception" }), "/today");
    assert.equal(resolveFiOsPostLoginPathSuffix({}), "/today");
    assert.notEqual(resolveFiOsPostLoginPathSuffix({}), "/cases");
  });
});

describe("buildFiOsTenantHomeHref", () => {
  it("builds Today and deep homes", () => {
    assert.equal(buildFiOsTenantHomeHref(TID, "/today"), `/fi-admin/${TID}/today`);
    assert.equal(buildFiOsTenantHomeHref(TID, ""), `/fi-admin/${TID}/today`);
    assert.equal(buildFiOsTenantHomeHref(TID, "/front-desk"), `/fi-admin/${TID}/front-desk`);
    assert.equal(buildFiOsTenantHomeHref(TID, "/crm"), `/fi-admin/${TID}/crm`);
  });
});
