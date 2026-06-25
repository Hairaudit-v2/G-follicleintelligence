import assert from "node:assert/strict";
import test from "node:test";

import { applyPartialFeatureOverrides, buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

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
  assert.equal(getFiOsShellActiveSidebarId(`${base}/staff`, base), "staff");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/admin-users`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/tax-localisation`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/integrations`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/integrations/timely`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/integrations/timely/discovery`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/system-status`, base), "calendar");
});

test("getFiOsShellActiveSidebarId: surgery readiness route stays under Cases / SurgeryOS", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/surgery-readiness`, base), "cases");
});

test("getFiOsShellActiveSidebarId: procedure day route stays under Cases / SurgeryOS", () => {
  const b = "/fi-admin/t-1";
  assert.equal(getFiOsShellActiveSidebarId(`${b}/procedure-day`, b), "cases");
});

test("getFiOsShellActiveSidebarId: payments inbox maps to payments-inbox tab", () => {
  const b = "/fi-admin/t-1";
  assert.equal(getFiOsShellActiveSidebarId(`${b}/payments`, b), "payments-inbox");
});

test("resolveFiOsPrimarySidebarItems: cases entry includes readiness and procedure day sub-links when enabled", () => {
  const base = "/fi-admin/t-1";
  const items = resolveFiOsPrimarySidebarItems(base, true, true);
  const cases = items.find((i) => i.id === "cases");
  assert.ok(cases?.subItems?.length);
  assert.ok(cases!.subItems!.some((s) => s.href.endsWith("/surgery-readiness")));
  assert.ok(cases!.subItems!.some((s) => s.href.endsWith("/procedure-day")));
});

test("getFiOsShellActiveSidebarId: consultation conversion route stays under Consultations", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/consultation-conversion`, base), "consultations");
});

test("getFiOsShellActiveSidebarId: operations centre maps to Ops sidebar tab", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/operations`, base), "operations-centre");
});

test("getFiOsShellActiveSidebarId: reception board maps to Rec sidebar tab", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reception`, base), "reception-board");
});

test("getFiOsShellActiveSidebarId: tomorrow board maps to Tmrw sidebar tab", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/tomorrow`, base), "tomorrow-board");
});

test("resolveFiOsPrimarySidebarItems: operations and reception entries exist", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true);
  assert.ok(items.find((i) => i.id === "operations-centre" && !i.disabled));
  assert.ok(items.find((i) => i.id === "reception-board" && !i.disabled));
  assert.ok(items.find((i) => i.id === "tomorrow-board" && !i.disabled));
});

test("resolveFiOsPrimarySidebarItems: consultations entry includes conversion board sub-link when enabled", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true);
  const consult = items.find((i) => i.id === "consultations");
  assert.ok(consult?.subItems?.length === 1);
  assert.ok(consult!.subItems!.some((s) => s.href.endsWith("/consultation-conversion")));
});

test("resolveFiOsPrimarySidebarItems: consultations enabled with CRM-only access", () => {
  const crmOnly = resolveFiOsPrimarySidebarItems(base, true, false);
  assert.ok(crmOnly.find((i) => i.id === "consultations" && !i.disabled));
});

test("resolveFiOsPrimarySidebarItems: consultations disabled without CRM or bookings access", () => {
  const off = resolveFiOsPrimarySidebarItems(base, false, false);
  assert.ok(off.find((i) => i.id === "consultations" && i.disabled));
});

test("resolveFiOsPrimarySidebarItems: dashboard_viewer AuditOS disabled when shell strips security nav", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true, "dashboard_viewer", false);
  const audit = items.find((i) => i.id === "auditos");
  assert.equal(audit?.disabled, true);
});

test("filterFiOsPrimarySidebarItemsByFeatureAccess: patient twin row respects imaging OR patient_twin", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true);
  const imagingOnly = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    patient_twin: false,
    imaging: true,
  });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, imagingOnly);
  assert.ok(filtered.some((i) => i.id === "patient-twin"));

  const offBoth = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    patient_twin: false,
    imaging: false,
  });
  const filtered2 = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, offBoth);
  assert.ok(!filtered2.some((i) => i.id === "patient-twin"));
});
