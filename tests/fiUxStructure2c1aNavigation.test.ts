import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  FI_OS_REPORTS_ADMIN_LEGACY_ROUTES,
  FI_OS_REPORTS_LEGACY_ROUTES,
  buildReportsSidebarSubItems,
} from "@/src/lib/fiOs/reports/reportsWorkspaceCore";
import { buildFiOsClinicSettingsGroups } from "@/src/lib/fiOs/settings/clinicSettingsNavigationCore";
import {
  FI_OS_TEAM_LEGACY_ROUTES,
  buildTeamSidebarSubItems,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";

const settingsNavPath = path.join(
  process.cwd(),
  "src",
  "components",
  "fi-os",
  "FiOsClinicSettingsNav.tsx"
);
const trainingPagePath = path.join(
  process.cwd(),
  "app",
  "(fi-admin)",
  "fi-admin",
  "[tenantId]",
  "team",
  "training",
  "page.tsx"
);
const tenantRoot = path.join(process.cwd(), "app", "(fi-admin)", "fi-admin", "[tenantId]");

test("Staff is absent from mounted Settings navigation while Roles & permissions keeps destination", () => {
  const source = readFileSync(settingsNavPath, "utf8");
  assert.doesNotMatch(source, /href=\{\`\$\{base\}\/staff\`\}/);
  assert.doesNotMatch(source, /showStaffLink/);
  assert.match(source, /showStaffAndServicesNav/);
  assert.doesNotMatch(source, />\s*Staff entitlements\s*</);
  assert.match(source, /showAdminUsersNav/);
  assert.match(source, /showHubspotImport/);

  const groups = buildFiOsClinicSettingsGroups("/fi-admin/t-2c1a", {
    showConfiguration: true,
    showClinicOperations: true,
    showTemplates: true,
    showTaxLocalisation: true,
    showBilling: true,
    showSecurity: true,
    showHubspotImport: true,
  });
  const roles = groups.find((group) => group.id === "roles-permissions");
  assert.equal(roles?.label, "Roles & permissions");
  assert.equal(roles?.destinations[0]?.href, "/fi-admin/t-2c1a/settings/staff-access");
  assert.ok(
    groups
      .find((group) => group.id === "integrations")
      ?.destinations.some((item) => item.id === "integrations")
  );
  assert.ok(
    !groups
      .find((group) => group.id === "integrations")
      ?.destinations.some((item) => item.id === "integrations-hubspot-import")
  );
});

test("academyos is absent from Team legacy catalogue while Training page Academy link remains", () => {
  assert.ok(!FI_OS_TEAM_LEGACY_ROUTES.some((route) => String(route.id) === "academyos"));
  assert.ok(!FI_OS_TEAM_LEGACY_ROUTES.some((route) => String(route.suffix) === "academy"));
  const catalogIds = buildTeamSidebarSubItems("t-2c1a", {
    showHrOsNav: true,
    showTeamAdminSurfaces: true,
  }).map((item) => item.id);
  assert.ok(!catalogIds.includes("academyos"));

  const trainingSource = readFileSync(trainingPagePath, "utf8");
  assert.match(trainingSource, /href=\{\`\$\{base\}\/academy\`\}/);
  assert.match(trainingSource, /Academy \(direct\)/);
});

test("Reports emits Surgery insights and Graft count review only once for admin catalog", () => {
  assert.ok(
    !FI_OS_REPORTS_LEGACY_ROUTES.some(
      (route) =>
        String(route.id) === "surgery-intelligence-dashboard" ||
        String(route.id) === "graft-counting-legacy"
    )
  );
  assert.ok(
    FI_OS_REPORTS_ADMIN_LEGACY_ROUTES.some((route) => route.id === "surgery-intelligence-dashboard")
  );
  assert.ok(
    FI_OS_REPORTS_ADMIN_LEGACY_ROUTES.some((route) => route.id === "graft-counting-legacy")
  );

  const adminSubs = buildReportsSidebarSubItems("t-2c1a", {
    showAuditOsNav: true,
    showReportsAdminSurfaces: true,
  });
  const surgeryInsights = adminSubs.filter((item) => item.id === "surgery-intelligence-dashboard");
  const graftCount = adminSubs.filter((item) => item.id === "graft-counting-legacy");
  assert.equal(surgeryInsights.length, 1);
  assert.equal(graftCount.length, 1);
});

test("HOLD routes remain untouched and HubSpot uses Integrations hub without temporary peer", () => {
  const settingsSource = readFileSync(settingsNavPath, "utf8");
  assert.match(settingsSource, /showHubspotImport/);
  assert.match(settingsSource, /buildFiOsClinicSettingsGroups/);

  const groups = buildFiOsClinicSettingsGroups("/fi-admin/t-2c1a", {
    showConfiguration: true,
    showClinicOperations: false,
    showTemplates: false,
    showTaxLocalisation: false,
    showBilling: false,
    showSecurity: false,
    showHubspotImport: true,
  });
  const integrations = groups.find((group) => group.id === "integrations");
  assert.equal(
    integrations?.destinations.find((item) => item.id === "integrations")?.href,
    "/fi-admin/t-2c1a/settings/integrations"
  );
  assert.ok(
    !integrations?.destinations.some((item) => item.id === "integrations-hubspot-import")
  );

  for (const relativePage of [
    path.join("staff", "page.tsx"),
    path.join("audit", "page.tsx"),
    path.join("workforce-os", "staff-access", "page.tsx"),
  ]) {
    const pagePath = path.join(tenantRoot, relativePage);
    assert.ok(existsSync(pagePath), `${relativePage} must remain`);
    assert.doesNotMatch(readFileSync(pagePath, "utf8"), /\bredirect\s*\(/);
  }
});
