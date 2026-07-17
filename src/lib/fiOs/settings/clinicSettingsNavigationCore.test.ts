import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  FI_OS_SETTINGS_GROUP_ORDER,
  buildFiOsClinicSettingsGroups,
  isFiOsSettingsDestinationActive,
  isFiOsSettingsGroupActive,
  primaryFiOsSettingsDestinations,
} from "@/src/lib/fiOs/settings/clinicSettingsNavigationCore";

const base = "/fi-admin/t-settings-1b";

function fullGroups() {
  return buildFiOsClinicSettingsGroups(base, {
    showConfiguration: true,
    showClinicOperations: true,
    showTemplates: true,
    showTaxLocalisation: true,
    showBilling: true,
    showSecurity: true,
    showHubspotImport: true,
  });
}

test("Settings IA follows the approved six-group order", () => {
  const groups = fullGroups();
  assert.deepEqual(
    groups.map((group) => group.id),
    [...FI_OS_SETTINGS_GROUP_ORDER]
  );
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Clinic", "Roles & permissions", "Templates", "Integrations", "Billing", "Security"]
  );
});

test("Clinic group maps configuration destinations and keeps Clinic guide contextual", () => {
  const clinic = fullGroups().find((group) => group.id === "clinic")!;
  const labels = clinic.destinations.map((item) => item.label);
  assert.deepEqual(labels, [
    "Configuration",
    "Services",
    "Rooms",
    "Clinic setup",
    "Tax & localisation",
    "Clinic guide",
  ]);
  const guide = clinic.destinations.find((item) => item.id === "clinic-guide")!;
  assert.equal(guide.contextual, true);
  assert.ok(!primaryFiOsSettingsDestinations(clinic).some((item) => item.id === "clinic-guide"));
});

test("Integrations owns HairAudit discovery without temporary HubSpot import peer", () => {
  const groups = fullGroups();
  assert.ok(!groups.some((group) => group.label === "HubSpot import"));
  assert.ok(!groups.some((group) => group.label === "HairAudit discovery"));
  assert.ok(!groups.some((group) => group.label === "Clinic guide"));

  const integrations = groups.find((group) => group.id === "integrations")!;
  assert.deepEqual(
    integrations.destinations.map((item) => item.label),
    ["Integrations", "HairAudit discovery"]
  );
  assert.ok(
    !integrations.destinations.some((item) => item.id === "integrations-hubspot-import")
  );
});

test("Roles, Templates, Billing and Security retain existing destinations and gates inputs", () => {
  const groups = fullGroups();
  assert.equal(
    groups.find((group) => group.id === "roles-permissions")?.destinations[0]?.href,
    `${base}/settings/staff-access`
  );
  assert.equal(
    groups.find((group) => group.id === "templates")?.destinations[0]?.href,
    `${base}/settings/templates`
  );
  assert.equal(
    groups.find((group) => group.id === "billing")?.destinations[0]?.href,
    `${base}/settings/payments`
  );
  assert.equal(
    groups.find((group) => group.id === "security")?.destinations[0]?.href,
    `${base}/settings/admin-users`
  );
});

test("CRM-read HubSpot reaches canonical workspace via Integrations without Configuration destinations", () => {
  const groups = buildFiOsClinicSettingsGroups(base, {
    showConfiguration: false,
    showClinicOperations: false,
    showTemplates: false,
    showTaxLocalisation: false,
    showBilling: false,
    showSecurity: false,
    showHubspotImport: true,
  });
  assert.deepEqual(
    groups.map((group) => group.id),
    ["integrations"]
  );
  assert.equal(groups[0]!.destinations[0]?.id, "integrations-hubspot");
  assert.equal(
    groups[0]!.destinations[0]?.href,
    `${base}/settings/integrations/hubspot?tab=import-review`
  );
  assert.ok(!groups[0]!.destinations.some((item) => item.id === "integrations-hubspot-import"));
});

test("nested Settings routes mark their group active", () => {
  const groups = fullGroups();
  const integrations = groups.find((group) => group.id === "integrations")!;
  const clinic = groups.find((group) => group.id === "clinic")!;
  assert.equal(
    isFiOsSettingsGroupActive(`${base}/settings/integrations/hubspot`, integrations),
    true
  );
  assert.equal(
    isFiOsSettingsDestinationActive(
      `${base}/settings/integrations/hubspot`,
      `${base}/settings/integrations`
    ),
    true
  );
  assert.equal(isFiOsSettingsGroupActive(`${base}/settings/clinic-setup`, clinic), true);
  assert.equal(isFiOsSettingsGroupActive(`${base}/team/staff`, clinic), false);
});

test("underlying Settings routes remain available after IA grouping", () => {
  const tenantRoot = path.join(process.cwd(), "app", "(fi-admin)", "fi-admin", "[tenantId]");
  for (const relativePage of [
    path.join("configuration", "page.tsx"),
    path.join("services", "page.tsx"),
    path.join("rooms", "page.tsx"),
    path.join("settings", "clinic-setup", "page.tsx"),
    path.join("settings", "tax-localisation", "page.tsx"),
    path.join("settings", "clinic-guide", "page.tsx"),
    path.join("settings", "templates", "page.tsx"),
    path.join("settings", "integrations", "page.tsx"),
    path.join("settings", "integrations", "hubspot", "page.tsx"),
    path.join("settings", "hairaudit-discovery", "page.tsx"),
    path.join("settings", "payments", "page.tsx"),
    path.join("settings", "admin-users", "page.tsx"),
    path.join("settings", "staff-access", "page.tsx"),
  ]) {
    assert.ok(existsSync(path.join(tenantRoot, relativePage)), `${relativePage} must remain`);
  }

  const navSource = readFileSync(
    path.join(process.cwd(), "src", "components", "fi-os", "FiOsClinicSettingsNav.tsx"),
    "utf8"
  );
  assert.match(navSource, /aria-label="Clinic settings"/);
  assert.match(navSource, /DropdownMenuTrigger asChild/);
  assert.match(navSource, /aria-current=\{active \? "page" : undefined\}/);
  assert.doesNotMatch(navSource, /href=\{\`\$\{base\}\/staff\`\}/);
});
