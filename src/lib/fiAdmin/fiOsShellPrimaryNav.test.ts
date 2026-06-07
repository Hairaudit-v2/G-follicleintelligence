import assert from "node:assert/strict";
import test from "node:test";

import { getFiOsShellActiveSidebarId, resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

const base = "/fi-admin/t-1";

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
  assert.equal(getFiOsShellActiveSidebarId(`${base}/settings/reminders`, base), "settings");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/system-status`, base), "calendar");
});
