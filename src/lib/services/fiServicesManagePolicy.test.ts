import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateFiServicesCatalogManageAllowed } from "./fiServicesManagePolicy";

function snap(
  p: Partial<{ adminKeyValid: boolean; osRole: string | null; tenantUserRole: string | null }>
) {
  return evaluateFiServicesCatalogManageAllowed({
    adminKeyValid: p.adminKeyValid ?? false,
    osRole: p.osRole ?? null,
    tenantUserRole: p.tenantUserRole ?? null,
  });
}

test("FI_ADMIN_API_KEY path allows manage", () => {
  assert.equal(snap({ adminKeyValid: true, osRole: null, tenantUserRole: null }), true);
});

test("platform OS fi_platform_admin may manage without tenant row", () => {
  assert.equal(snap({ osRole: "fi_platform_admin", tenantUserRole: null }), true);
});

test("platform OS fi_admin may manage without tenant row", () => {
  assert.equal(snap({ osRole: "FI_ADMIN", tenantUserRole: null }), true);
});

test("tenant admin may manage", () => {
  assert.equal(snap({ osRole: null, tenantUserRole: "admin" }), true);
});

test("tenant fi_admin may manage", () => {
  assert.equal(snap({ osRole: null, tenantUserRole: "fi_admin" }), true);
});

test("crm_operator may not manage services", () => {
  assert.equal(snap({ osRole: null, tenantUserRole: "crm_operator" }), false);
});

test("fi_auditor may not manage services even with tenant admin", () => {
  assert.equal(snap({ osRole: "fi_auditor", tenantUserRole: "admin" }), false);
});

test("fi_auditor alone is denied", () => {
  assert.equal(snap({ osRole: "fi_auditor", tenantUserRole: null }), false);
});

test("other OS role defers to tenant staff-manage role", () => {
  assert.equal(snap({ osRole: "fi_doctor", tenantUserRole: "admin" }), true);
  assert.equal(snap({ osRole: "fi_doctor", tenantUserRole: "member" }), false);
});

test("platform fi_admin wins over tenant crm_operator", () => {
  assert.equal(snap({ osRole: "fi_admin", tenantUserRole: "crm_operator" }), true);
});
