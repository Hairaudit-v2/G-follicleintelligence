import assert from "node:assert/strict";
import test from "node:test";

import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
} from "@/src/config/fiFeatureAccessRegistry";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import {
  buildNavExpandedGroupsStorageKey,
  countCompactNavGroupHeaders,
  FI_OS_COMPACT_NAV_MAX_GROUP_HEADERS,
  mergeExpandedNavGroups,
  parsePersistedExpandedNavGroups,
  resolveActiveWorkflowGroupForNav,
  serializeExpandedNavGroups,
  toggleNavGroupExpansion,
} from "@/src/lib/fiOs/navigation/fiOsNavigationCompactCore";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { workflowGroupForD6gNavItemId } from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";

const tenantId = "t-compact-nav-1";
const base = `/fi-admin/${tenantId}`;

function staffSidebar() {
  return resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    undefined,
    false
  );
}

function adminSidebar() {
  return resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    undefined,
    true
  );
}

function legacySections(sidebar = staffSidebar(), profile: FiWorkspaceProfileKey = "default") {
  return buildFiOsSidebarWorkflowSections(sidebar, profile, {
    tenantBase: base,
    forCollapsedShell: false,
    showNavigationAdminSurfaces: false,
    showSettingsAdminSurfaces: false,
  });
}

function adminLegacySections() {
  return buildFiOsSidebarWorkflowSections(adminSidebar(), "default", {
    tenantBase: base,
    forCollapsedShell: false,
    showNavigationAdminSurfaces: true,
    showSettingsAdminSurfaces: true,
    showReportsAdminSurfaces: true,
    showTeamAdminSurfaces: true,
  });
}

function collapsedDrawerSections(
  sidebar = staffSidebar(),
  profile: FiWorkspaceProfileKey = "default"
) {
  return buildFiOsSidebarWorkflowSections(sidebar, profile, {
    tenantBase: base,
    forCollapsedShell: true,
    showNavigationAdminSurfaces: false,
    showSettingsAdminSurfaces: false,
  });
}

function adminCollapsedDrawerSections() {
  return buildFiOsSidebarWorkflowSections(adminSidebar(), "default", {
    tenantBase: base,
    forCollapsedShell: true,
    showNavigationAdminSurfaces: true,
    showSettingsAdminSurfaces: true,
    showReportsAdminSurfaces: true,
    showTeamAdminSurfaces: true,
  });
}

test("compact nav: route-to-group mapping for primary and deep links", () => {
  assert.equal(resolveActiveWorkflowGroupForNav("calendar"), "FRONT_DESK");
  assert.equal(resolveActiveWorkflowGroupForNav("crm"), "PIPELINE");
  assert.equal(resolveActiveWorkflowGroupForNav("patient-twin"), "PATIENTS");
  assert.equal(resolveActiveWorkflowGroupForNav("doctor-workspace"), "CLINICAL");
  assert.equal(resolveActiveWorkflowGroupForNav("surgery"), "SURGERY");
  assert.equal(resolveActiveWorkflowGroupForNav("financial-os"), "FINANCE");
  assert.equal(resolveActiveWorkflowGroupForNav("reports"), "REPORTS");
  assert.equal(resolveActiveWorkflowGroupForNav("team"), "TEAM");
  assert.equal(resolveActiveWorkflowGroupForNav("settings"), "SETTINGS");

  assert.equal(
    resolveActiveWorkflowGroupForNav(getFiOsShellActiveSidebarId(`${base}/team/roster`, base)),
    "TEAM"
  );
  assert.equal(
    resolveActiveWorkflowGroupForNav(getFiOsShellActiveSidebarId(`${base}/workforce-os`, base)),
    "TEAM"
  );
  assert.equal(
    resolveActiveWorkflowGroupForNav(getFiOsShellActiveSidebarId(`${base}/hr-os/compliance`, base)),
    "TEAM"
  );
  assert.equal(
    resolveActiveWorkflowGroupForNav(
      getFiOsShellActiveSidebarId(`${base}/intelligence/navigation-audit`, base)
    ),
    "SETTINGS"
  );
  assert.equal(workflowGroupForD6gNavItemId("team-roster"), "TEAM");
  assert.equal(workflowGroupForD6gNavItemId("d6-navigation-audit"), "SETTINGS");
});

test("compact nav: staff legacy sidebar hides direct links; admin retains them", () => {
  const staff = legacySections();
  const staffSubIds = staff.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  const staffSubLabels = staff.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.label) ?? [])
  );

  assert.ok(!staffSubIds.includes("workforce-os-hub"));
  assert.ok(!staffSubIds.includes("hr-os-dashboard"));
  assert.ok(!staffSubIds.includes("reception-os"));
  assert.ok(!staffSubIds.includes("d6-navigation-audit"));
  for (const label of staffSubLabels) {
    assert.ok(!/\(direct\)/i.test(label), `staff nav should hide direct label: ${label}`);
  }

  const admin = adminLegacySections();
  const adminSubIds = admin.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  // A1: Team legacy direct links are never advertised, even for admins.
  assert.ok(!adminSubIds.includes("workforce-os-hub"));
  assert.ok(adminSubIds.includes("d6-navigation-audit"));
});

test("compact nav 1B: All areas drawer applies staff-safe direct-link filtering", () => {
  const staff = collapsedDrawerSections();
  const staffSubIds = staff.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  const staffSubLabels = staff.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.label) ?? [])
  );

  assert.ok(!staffSubIds.includes("workforce-os-hub"));
  assert.ok(!staffSubIds.includes("reception-os"));
  for (const label of staffSubLabels) {
    assert.ok(!/\(direct\)/i.test(label), `staff drawer should hide direct label: ${label}`);
  }

  const admin = adminCollapsedDrawerSections();
  const adminSubIds = admin.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  // A1: Team legacy direct links are never advertised, even for admins.
  assert.ok(!adminSubIds.includes("workforce-os-hub"));
  assert.ok(adminSubIds.includes("d6-navigation-audit"));
});

test("compact nav 1B: collapsed All areas drawer fits within max group headers", () => {
  const raw = resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    false,
    false
  );
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    staff: false,
    analytics: false,
    surgery_pipeline: false,
    consultations: true,
    calendar: true,
    crm: true,
    dashboard: true,
    patients: true,
  });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, access);
  const sections = buildFiOsSidebarWorkflowSections(
    filtered,
    "reception" as FiWorkspaceProfileKey,
    {
      tenantBase: base,
      forCollapsedShell: true,
    }
  );
  assert.ok(countCompactNavGroupHeaders(sections) <= FI_OS_COMPACT_NAV_MAX_GROUP_HEADERS);
});

test("compact nav: workforce and HR deep routes map to Team group", () => {
  const team = legacySections().find((s) => s.groupId === "TEAM");
  assert.ok(team);
  assert.deepEqual(
    team!.items.map((i) => i.id),
    ["team"]
  );
  const subIds = team!.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []);
  assert.ok(subIds.includes("team-overview"));
  assert.ok(subIds.includes("team-staff"));
  assert.ok(subIds.includes("team-roster"));
});

test("compact nav: low-frequency admin routes grouped under Settings for admins", () => {
  const settings = adminLegacySections().find((s) => s.groupId === "SETTINGS");
  assert.ok(settings);
  const settingsItem = settings!.items.find((i) => i.id === "settings");
  assert.ok(settingsItem);
  const subIds = settingsItem!.subItems?.map((s) => s.id) ?? [];
  for (const d6Id of ["d6-presence", "d6-signal-learning", "d6-bake", "d6-navigation-audit"]) {
    assert.ok(subIds.includes(d6Id), `settings should include admin route ${d6Id}`);
  }

  const reports = adminLegacySections().find((s) => s.groupId === "REPORTS");
  const reportSubIds = reports?.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []) ?? [];
  assert.ok(!reportSubIds.includes("d6-navigation-audit"));
});

test("compact nav: receptionist persona fits within max collapsed group headers", () => {
  const raw = resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    false,
    false
  );
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    staff: false,
    analytics: false,
    surgery_pipeline: false,
    consultations: true,
    calendar: true,
    crm: true,
    dashboard: true,
    patients: true,
  });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, access);
  const sections = buildFiOsSidebarWorkflowSections(
    filtered,
    "reception" as FiWorkspaceProfileKey,
    {
      tenantBase: base,
      forCollapsedShell: false,
    }
  );
  assert.ok(countCompactNavGroupHeaders(sections) <= FI_OS_COMPACT_NAV_MAX_GROUP_HEADERS);
});

test("compact nav: expanded group persistence round-trips", () => {
  const key = buildNavExpandedGroupsStorageKey({ tenantId, userEmail: "nurse@clinic.test" });
  assert.match(key, /fi-os-nav-expanded-groups/);

  const initial = mergeExpandedNavGroups(new Set(["PIPELINE"]), "TEAM");
  assert.ok(initial.has("PIPELINE"));
  assert.ok(initial.has("TEAM"));

  const serialized = serializeExpandedNavGroups(initial);
  const parsed = parsePersistedExpandedNavGroups(serialized);
  assert.deepEqual([...parsed].sort(), ["PIPELINE", "TEAM"]);

  const toggled = toggleNavGroupExpansion(parsed, "PIPELINE");
  assert.ok(!toggled.has("PIPELINE"));
  assert.ok(toggled.has("TEAM"));
});

test("compact nav: disabled items remain in grouped sections", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true, "operations_admin", true, true);
  const sections = buildFiOsSidebarWorkflowSections(raw, "default", { tenantBase: base });
  const clinical = sections.find((s) => s.groupId === "CLINICAL");
  assert.ok(clinical);
  const doctor = clinical!.items.find((i) => i.id === "doctor-workspace");
  assert.ok(doctor?.disabled);
});
