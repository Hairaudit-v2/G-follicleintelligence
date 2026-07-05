import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
} from "@/src/config/fiFeatureAccessRegistry";
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
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/settings/integrations/timely`, base),
    "settings"
  );
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/settings/integrations/timely/discovery`, base),
    "settings"
  );
  assert.equal(getFiOsShellActiveSidebarId(`${base}/system-status`, base), "calendar");
});

test("getFiOsShellActiveSidebarId: surgery readiness route maps to legacy sub-link", () => {
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/surgery-readiness`, base),
    "surgery-readiness-board"
  );
});

test("getFiOsShellActiveSidebarId: surgery intelligence route maps to legacy sub-link", () => {
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/surgery-os/intelligence`, base),
    "surgery-intelligence-dashboard"
  );
});

test("getFiOsShellActiveSidebarId: procedure day route maps to legacy sub-link", () => {
  const b = "/fi-admin/t-1";
  assert.equal(getFiOsShellActiveSidebarId(`${b}/procedure-day`, b), "procedure-day-board");
});

test("getFiOsShellActiveSidebarId: payments inbox maps to payments-inbox tab", () => {
  const b = "/fi-admin/t-1";
  assert.equal(getFiOsShellActiveSidebarId(`${b}/payments`, b), "payments-inbox");
});

test("resolveFiOsPrimarySidebarItems: consolidated surgery entry with preserved legacy sub-links", () => {
  const b = "/fi-admin/t-1";
  const items = resolveFiOsPrimarySidebarItems(b, true, true);
  const surgery = items.find((i) => i.id === "surgery");
  assert.ok(surgery?.subItems?.length);
  const subIds = new Set(surgery!.subItems!.map((s) => s.id));
  assert.ok(subIds.has("surgery-command"));
  assert.ok(subIds.has("surgery-cases"));
  assert.ok(subIds.has("surgery-review"));
  assert.ok(subIds.has("surgery-readiness-board"));
  assert.ok(subIds.has("cases-worklist"));
  assert.ok(!subIds.has("surgery-intelligence-dashboard"));
});

test("resolveFiOsPrimarySidebarItems: procedure day tab when FI_PROCEDURE_DAY_ENABLED", () => {
  const b = "/fi-admin/t-1";
  const items = resolveFiOsPrimarySidebarItems(b, true, true, null, true, true, false, false, true);
  const surgery = items.find((i) => i.id === "surgery");
  const subIds = new Set(surgery!.subItems!.map((s) => s.id));
  assert.ok(subIds.has("surgery-procedure-day"));
  assert.ok(subIds.has("procedure-day-board"));
});

test("getFiOsShellActiveSidebarId: consultation conversion route stays under Consultations", () => {
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/consultation-conversion`, base),
    "consultations"
  );
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

test("resolveFiOsPrimarySidebarItems: consolidated front desk entry with preserved legacy sub-links", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true);
  const frontDesk = items.find((i) => i.id === "front-desk" && !i.disabled);
  assert.ok(frontDesk);
  assert.ok(frontDesk!.href.endsWith("/front-desk"));
  const subIds = new Set(frontDesk!.subItems?.map((s) => s.id) ?? []);
  assert.ok(subIds.has("operations-centre"));
  assert.ok(subIds.has("reception-os"));
  assert.ok(subIds.has("reception-board"));
  assert.ok(subIds.has("tomorrow-board"));
  assert.ok(subIds.has("front-desk-clinic-flow"));
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

test("resolveFiOsPrimarySidebarItems: approved D3 presentation labels", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.dashboard?.label, "Today");
  assert.equal(byId["front-desk"]?.label, "Front desk");
  assert.equal(byId.surgery?.label, "Surgery");
  assert.equal(byId.crm?.label, "Enquiries");
  assert.equal(byId["follow-up-queue"]?.label, "Follow-ups");
  assert.equal(byId["patient-twin"]?.label, "Health record");
  assert.equal(byId.auditos?.label, "Quality review");
  assert.equal(byId["financial-os"]?.label, "Finances");
  assert.equal(byId.analytics?.label, "Insights");
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
