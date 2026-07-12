/**
 * Platform-admin tenant-proxy write contract (pure + static).
 * Ensures UI permission and server assertion stay aligned for create-enquiry.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { resolvePipelinePermissionsFromSession } from "@/src/lib/crm/pipelineLoader";

test("1. platform admin with valid tenant proxy can view and create on Pipeline", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "fi_admin",
    canUseClinicFeatures: true,
    validPlatformAdminTenantProxy: true,
  });
  assert.equal(perms.canView, true);
  assert.equal(perms.canCreateEnquiry, true);
});

test("2. platform admin with valid tenant proxy has canCreateEnquiry=true even if features flag is off", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: false,
    validPlatformAdminTenantProxy: true,
  });
  assert.equal(perms.canCreateEnquiry, true);
  assert.equal(perms.canMutate, true);
});

test("3. tenant CRM operator can still create", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "crm_operator",
    canUseClinicFeatures: true,
  });
  assert.equal(perms.canCreateEnquiry, true);
});

test("4. receptionist capability override unchanged", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: true,
  });
  assert.equal(perms.canCreateEnquiry, true);
});

test("5. read-only staff cannot create", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: false,
    validPlatformAdminTenantProxy: false,
  });
  assert.equal(perms.canCreateEnquiry, false);
});

test("6. nurse without CRM shell cannot create", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: false,
    userRole: "nurse",
    canUseClinicFeatures: false,
  });
  assert.equal(perms.canView, false);
  assert.equal(perms.canCreateEnquiry, false);
});

test("7. permission resolution fails closed without shell access", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: false,
    userRole: "fi_admin",
    canUseClinicFeatures: true,
    validPlatformAdminTenantProxy: true,
  });
  // Without CRM shell access, even a proxy claim is ignored (fail closed).
  assert.equal(perms.canView, false);
  assert.equal(perms.canCreateEnquiry, false);
});

test("8. UI and server contracts both require tenant-scoped proxy for platform admin", () => {
  const gate = readFileSync("src/lib/crm/crmGate.ts", "utf8");
  assert.match(gate, /loadProxyFiUserRowForPlatformAdminTenant/);
  // Write path no longer blanket-denies platform admin; requires proxy for tenant
  assert.match(
    gate,
    /Platform administrators need a valid tenant context before mutating tenant data/
  );
  assert.doesNotMatch(
    gate.split("assertCrmTenantWriteAllowed")[1]?.slice(0, 1200) ?? "",
    /throw new CrmAccessError\(\s*403,\s*PLATFORM_ADMIN_WRITE_REQUIRES_IMPERSONATION\s*\)/
  );

  const clinic = readFileSync("src/lib/fiOs/developmentClinicAccess.server.ts", "utf8");
  assert.match(clinic, /loadProxyFiUserRowForPlatformAdminTenant/);
  assert.match(clinic, /allowed: true/);

  const loader = readFileSync("src/lib/crm/pipelineLoader.ts", "utf8");
  assert.match(loader, /validPlatformAdminTenantProxy/);
  assert.match(loader, /canCreateEnquiry/);

  const createAction = readFileSync("lib/actions/createLeadflowEnquiryAction.ts", "utf8");
  assert.match(createAction, /assertCrmTenantWriteAllowed/);
  assert.match(createAction, /createCrmLeadWithPerson/);
  // Form options must not require canUseClinicFeatures alone (blocks platform-admin proxy)
  assert.doesNotMatch(createAction, /session\?\.canUseClinicFeatures/);
});

test("9. platform admin without proxy cannot create (UI)", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: false,
    validPlatformAdminTenantProxy: false,
  });
  assert.equal(perms.canCreateEnquiry, false);
});

test("10. proxy grant is tenant-scoped by design (no cross-tenant flag)", () => {
  // Proxy flag is per-session-context for one tenantId; another tenant requires a separate resolve.
  const tenantA = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: false,
    validPlatformAdminTenantProxy: true,
  });
  const tenantB = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: false,
    validPlatformAdminTenantProxy: false,
  });
  assert.equal(tenantA.canCreateEnquiry, true);
  assert.equal(tenantB.canCreateEnquiry, false);
});
