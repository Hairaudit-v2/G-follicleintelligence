import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFiOsTenantHomeHref,
  resolveFiOsPostLoginPathSuffix,
} from "@/src/lib/fiOs/fiOsRoleLandingCore";
import { isBareFiAdminTenantHomePath } from "@/src/lib/workforce/staffTenantLinkRepairCore";

const TID = "c2615b95-b707-4485-aa5f-be8f78ec868a";

describe("resolveFiOsPostLoginPathSuffix", () => {
  it("maps OS roles to job homes (not Cases)", () => {
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_consultant" }), "/crm");
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_doctor" }), "/doctor");
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_nurse" }), "/front-desk");
    assert.equal(resolveFiOsPostLoginPathSuffix({ osRole: "fi_clinic_admin" }), "");
  });

  it("maps staff role keys when OS role is absent", () => {
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "reception" }), "/front-desk");
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "Receptionist" }), "/front-desk");
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "consultant" }), "/crm");
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "manager" }), "");
  });

  it("F-PILOT-06: consultant workspace profile wins over manager staff_role (bare → /crm)", () => {
    assert.equal(
      resolveFiOsPostLoginPathSuffix({
        staffRoleKey: "manager",
        workspaceProfile: "consultant",
      }),
      "/crm"
    );
    assert.equal(
      resolveFiOsPostLoginPathSuffix({
        staffRoleKey: "Manager",
        workspaceProfile: "consultant",
      }),
      "/crm"
    );
  });

  it("maps finance tenant admin to Money hub", () => {
    assert.equal(
      resolveFiOsPostLoginPathSuffix({ tenantAdminRole: "finance_admin" }),
      "/financial-os"
    );
  });

  it("maps free-text surgeon staff labels to doctor home", () => {
    assert.equal(
      resolveFiOsPostLoginPathSuffix({
        staffRoleKey: "Contractor Doctor / Hair Transplant Surgeon",
      }),
      "/doctor"
    );
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "Nurse" }), "/front-desk");
    assert.equal(resolveFiOsPostLoginPathSuffix({ staffRoleKey: "consultant" }), "/crm");
  });

  it("defaults to Today (empty suffix), never /cases", () => {
    assert.equal(resolveFiOsPostLoginPathSuffix({}), "");
    assert.notEqual(resolveFiOsPostLoginPathSuffix({}), "/cases");
  });

  it("maps workspace profile when staff role key is absent", () => {
    assert.equal(resolveFiOsPostLoginPathSuffix({ workspaceProfile: "reception" }), "/front-desk");
    assert.equal(resolveFiOsPostLoginPathSuffix({ workspaceProfile: "consultant" }), "/crm");
    assert.equal(resolveFiOsPostLoginPathSuffix({ workspaceProfile: "finance" }), "/financial-os");
  });
});

describe("buildFiOsTenantHomeHref", () => {
  it("builds Today and deep homes", () => {
    assert.equal(buildFiOsTenantHomeHref(TID, ""), `/fi-admin/${TID}`);
    assert.equal(buildFiOsTenantHomeHref(TID, "/front-desk"), `/fi-admin/${TID}/front-desk`);
    assert.equal(buildFiOsTenantHomeHref(TID, "/crm"), `/fi-admin/${TID}/crm`);
  });
});

describe("isBareFiAdminTenantHomePath", () => {
  it("detects tenant Today-only paths", () => {
    assert.equal(isBareFiAdminTenantHomePath(`/fi-admin/${TID}`), true);
    assert.equal(isBareFiAdminTenantHomePath(`/fi-admin/${TID}/`), true);
    assert.equal(isBareFiAdminTenantHomePath(`/fi-admin/${TID}/crm`), false);
  });
});
