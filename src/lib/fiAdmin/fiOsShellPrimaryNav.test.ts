import assert from "node:assert/strict";
import test from "node:test";

import { getFiOsShellActiveSidebarId, resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

const base = "/fi-admin/t-1";

test("resolveFiOsPrimarySidebarItems: finance_admin persona disables operational clinical tabs", () => {
  const items = resolveFiOsPrimarySidebarItems(base, false, false, "finance_admin");
  const cal = items.find((i) => i.id === "calendar");
  const rx = items.find((i) => i.id === "prescriptions");
  assert.equal(cal?.disabled, true);
  assert.equal(rx?.disabled, true);
});

test("resolveFiOsPrimarySidebarItems: CRM and patients follow flags", () => {
  const all = resolveFiOsPrimarySidebarItems(base, true, true);
  assert.ok(all.find((i) => i.id === "crm" && !i.disabled));
  assert.ok(all.find((i) => i.id === "patients" && !i.disabled));

  const noCrm = resolveFiOsPrimarySidebarItems(base, false, true);
  assert.ok(noCrm.find((i) => i.id === "crm" && i.disabled));

  const noPatients = resolveFiOsPrimarySidebarItems(base, true, false);
  assert.ok(noPatients.find((i) => i.id === "patients" && i.disabled));
});

test("getFiOsShellActiveSidebarId: maps foundation and settings clusters", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/foundation-integrity`, base), "patient-twin");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/staff`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/admin-users`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/tax-localisation`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/system-status`, base), "calendar");
});

test("getFiOsShellActiveSidebarId: surgery readiness route stays under Cases / SurgeryOS", () => {
  const base = "/fi-admin/t-1";
  assert.equal(getFiOsShellActiveSidebarId(`${base}/surgery-readiness`, base), "cases");
});

test("resolveFiOsPrimarySidebarItems: cases entry includes readiness board sub-link when enabled", () => {
  const base = "/fi-admin/t-1";
  const items = resolveFiOsPrimarySidebarItems(base, true, true);
  const cases = items.find((i) => i.id === "cases");
  assert.ok(cases?.subItems?.length);
  assert.ok(cases!.subItems!.some((s) => s.href.endsWith("/surgery-readiness")));
});

test("resolveFiOsPrimarySidebarItems: consultations follows bookings board flag", () => {
  const on = resolveFiOsPrimarySidebarItems(base, true, true);
  assert.ok(on.find((i) => i.id === "consultations" && !i.disabled));
  const off = resolveFiOsPrimarySidebarItems(base, true, false);
  assert.ok(off.find((i) => i.id === "consultations" && i.disabled));
});

test("resolveFiOsPrimarySidebarItems: dashboard_viewer AuditOS disabled when shell strips security nav", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true, "dashboard_viewer", false);
  const audit = items.find((i) => i.id === "auditos");
  assert.equal(audit?.disabled, true);
});

test("resolveFiOsPrimarySidebarItems: data_safety_admin AuditOS enabled when shell allows security nav", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true, "data_safety_admin", true);
  const audit = items.find((i) => i.id === "auditos");
  assert.equal(audit?.disabled, false);
});
