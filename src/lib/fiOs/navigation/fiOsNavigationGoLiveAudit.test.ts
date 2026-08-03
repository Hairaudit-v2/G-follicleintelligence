import assert from "node:assert/strict";
import test from "node:test";

import {
  getFiOsMinimalNavActiveId,
  primaryRailSlotIds,
  resolveFiOsMinimalNavItems,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import {
  FI_OS_QUICK_CREATE_ITEMS,
  resolveFiOsQuickCreateItems,
} from "@/src/lib/fiAdmin/fiOsQuickCreateItems";
import { resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import {
  FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS,
  isStaffHiddenMoreDrawerLabel,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import {
  GO_LIVE_ADMIN_D6_NAV_IDS,
  GO_LIVE_LEGACY_ROUTE_SUFFIXES,
  GO_LIVE_NAV_ROLE_SCENARIOS,
  GO_LIVE_NAVIGATION_AUDIT_NOTES,
  GO_LIVE_PRIMARY_RAIL_LABELS,
  GO_LIVE_STAFF_HIDDEN_MORE_TERMS,
  GO_LIVE_WORKSPACE_TAB_LABELS,
  assertFiOsNavigationGoLiveAuditPassed,
  buildFiOsNavigationGoLiveAuditReport,
  isStaffHiddenMoreDirectLabel,
  runFiOsNavigationGoLiveAudit,
  summarizeFiOsNavigationGoLiveAudit,
} from "@/src/lib/fiOs/navigation/fiOsNavigationGoLiveAudit";

const tenantId = "t-go-live-audit-1";
const base = `/fi-admin/${tenantId}`;

function fullSidebar(showAdmin = false) {
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
    showAdmin,
    showAdmin,
    undefined,
    showAdmin
  );
}

function moreSections(opts?: {
  showNavigationAdminSurfaces?: boolean;
  workspaceProfile?: FiWorkspaceProfileKey;
  showProcedureDayNav?: boolean;
  showReportsAdminSurfaces?: boolean;
  showTeamAdminSurfaces?: boolean;
}) {
  const showAdmin =
    opts?.showNavigationAdminSurfaces === true ||
    opts?.showReportsAdminSurfaces === true ||
    opts?.showTeamAdminSurfaces === true;
  return buildFiOsSidebarWorkflowSections(
    fullSidebar(showAdmin),
    opts?.workspaceProfile ?? "default",
    {
      tenantBase: base,
      forCollapsedShell: true,
      showNavigationAdminSurfaces: opts?.showNavigationAdminSurfaces ?? false,
      showProcedureDayNav: opts?.showProcedureDayNav ?? false,
      showSurgeryAdminSurfaces: opts?.showNavigationAdminSurfaces ?? false,
      showTeamAdminSurfaces:
        opts?.showTeamAdminSurfaces ?? opts?.showNavigationAdminSurfaces ?? false,
      showReportsAdminSurfaces:
        opts?.showReportsAdminSurfaces ?? opts?.showNavigationAdminSurfaces ?? false,
      showSettingsAdminSurfaces:
        opts?.showNavigationAdminSurfaces ?? opts?.showReportsAdminSurfaces ?? false,
    }
  );
}

function flattenMoreSubLabels(sections = moreSections()) {
  return sections.flatMap((s) => s.items.flatMap((i) => i.subItems?.map((sub) => sub.label) ?? []));
}

function flattenMoreSubIds(sections = moreSections()) {
  return sections.flatMap((s) => s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? []));
}

test("go-live audit notes document scope and six-slot rail", () => {
  assert.match(GO_LIVE_NAVIGATION_AUDIT_NOTES, /six slots/i);
  assert.match(
    GO_LIVE_NAVIGATION_AUDIT_NOTES,
    /Today · Calendar · Patients · Team · Reports · More/
  );
  assert.match(GO_LIVE_NAVIGATION_AUDIT_NOTES, /Search\/New/);
});

test("primary rail exactly equals Today · Calendar · Patients · Team · Reports · More", () => {
  assert.deepEqual(
    [...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS],
    ["today", "calendar", "patients", "team", "reports", "more"]
  );
  assert.equal(primaryRailSlotIds().length, 6);

  const items = resolveFiOsMinimalNavItems(base, fullSidebar());
  assert.equal(items.length, 6);
  assert.deepEqual(
    items.map((i) => i.id),
    [...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS]
  );
  assert.deepEqual(
    items.map((i) => i.label),
    [...GO_LIVE_PRIMARY_RAIL_LABELS]
  );
});

test("Search and New are not present in primary rail", () => {
  const labels = resolveFiOsMinimalNavItems(base, fullSidebar()).map((i) => i.label);
  assert.ok(!labels.some((l) => /^(search|new)$/i.test(l)));
});

test("Calendar route and link remain unchanged on minimal rail", () => {
  const sidebar = fullSidebar();
  const calendarSidebar = sidebar.find((i) => i.id === "calendar");
  const calendarRail = resolveFiOsMinimalNavItems(base, sidebar).find((i) => i.id === "calendar");
  assert.equal(calendarRail?.kind, "link");
  if (calendarRail?.kind === "link") {
    assert.equal(calendarRail.href, `${base}/calendar`);
    assert.equal(calendarRail.disabled, calendarSidebar?.disabled ?? false);
  }
  assert.equal(getFiOsMinimalNavActiveId(`${base}/calendar`, base), "calendar");
});

test("receptionist More drawer excludes staff-hidden terms and admin surfaces", () => {
  const sections = moreSections({
    showNavigationAdminSurfaces: false,
    workspaceProfile: "reception",
  });
  const subLabels = flattenMoreSubLabels(sections);
  const subIds = flattenMoreSubIds(sections);

  for (const term of GO_LIVE_STAFF_HIDDEN_MORE_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    assert.ok(
      !subLabels.some((l) => re.test(l)),
      `receptionist More should exclude label containing "${term}"`
    );
  }

  for (const label of subLabels) {
    assert.ok(!isStaffHiddenMoreDrawerLabel(label), `hidden label: ${label}`);
    assert.ok(!isStaffHiddenMoreDirectLabel(label), `direct label: ${label}`);
  }

  for (const d6Id of GO_LIVE_ADMIN_D6_NAV_IDS) {
    assert.ok(!subIds.includes(d6Id), `receptionist More should hide ${d6Id}`);
  }
});

test("platform admin still sees permitted admin, audit, and intelligence surfaces", () => {
  const sections = moreSections({
    showNavigationAdminSurfaces: true,
    workspaceProfile: "platform_admin",
    showProcedureDayNav: true,
    showReportsAdminSurfaces: true,
    showTeamAdminSurfaces: true,
  });
  const subIds = flattenMoreSubIds(sections);

  for (const d6Id of GO_LIVE_ADMIN_D6_NAV_IDS) {
    assert.ok(subIds.includes(d6Id), `admin More should include ${d6Id}`);
  }

  for (const legacyId of [
    "reception-os",
    "surgery-os",
    "workforce-os-hub",
    "analytics-legacy",
    "staff-identity-audit",
  ]) {
    assert.ok(subIds.includes(legacyId), `admin More should include ${legacyId}`);
  }
});

test("workspace tabs exist for Front Desk, Surgery, Team, and Reports", () => {
  assert.deepEqual(GO_LIVE_WORKSPACE_TAB_LABELS.frontDesk, [
    "Today",
    "Tomorrow",
    "Messages",
  ]);
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.surgery.includes("Overview"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.surgery.includes("Cases"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.surgery.includes("Review"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.surgery.includes("Surgery day"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.team.includes("Team overview"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.team.includes("Staff directory"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.team.includes("Roster"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.team.includes("Identity & access"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.reports.includes("Reports overview"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.reports.includes("Analytics"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.reports.includes("Quality review"));
  assert.ok(GO_LIVE_WORKSPACE_TAB_LABELS.reports.includes("Admin audit"));
});

test("deep-link route catalog includes preserved legacy routes", () => {
  assert.ok(GO_LIVE_LEGACY_ROUTE_SUFFIXES.length > 20);
  const expected = [
    "operations",
    "reception-os",
    "reception",
    "tomorrow",
    "surgery-os",
    "cases",
    "procedure-day",
    "workforce-os",
    "hr-os",
    "staff",
    "analytics",
    "audit",
    "intelligence/navigation-audit",
  ];
  for (const suffix of expected) {
    assert.ok(
      GO_LIVE_LEGACY_ROUTE_SUFFIXES.includes(
        suffix as (typeof GO_LIVE_LEGACY_ROUTE_SUFFIXES)[number]
      ),
      `legacy catalog should include ${suffix}`
    );
  }
});

test("quick-create actions remain unchanged", () => {
  const items = resolveFiOsQuickCreateItems(base, true, true);
  assert.deepEqual(
    items.map((i) => i.id),
    FI_OS_QUICK_CREATE_ITEMS.map((d) => d.id)
  );
  const consultation = items.find((i) => i.id === "consultation");
  assert.equal(consultation?.enabled, true);
  assert.equal(consultation?.href, `${base}/consultations/new`);
});

test("active group mapping works for consolidated workspace child routes and legacy routes", () => {
  assert.equal(getFiOsMinimalNavActiveId(`${base}/team/roster`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/reports/quality`, base), "reports");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/workforce-os/roster`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/intelligence/presence`, base), "reports");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/front-desk/clinic-flow`, base), null);
  assert.equal(getFiOsMinimalNavActiveId(`${base}/surgery/cases`, base), null);
});

test("staff-facing label audit passes for receptionist scenario", () => {
  const report = buildFiOsNavigationGoLiveAuditReport(tenantId, {
    persona: "receptionist",
    workspaceProfile: "reception",
    showNavigationAdminSurfaces: false,
  });
  assertFiOsNavigationGoLiveAuditPassed(report);
});

test("all standard role scenarios pass go-live audit", () => {
  const reports = runFiOsNavigationGoLiveAudit(tenantId);
  assert.equal(reports.length, GO_LIVE_NAV_ROLE_SCENARIOS.length);

  for (const report of reports) {
    assertFiOsNavigationGoLiveAuditPassed(report);
  }

  const summary = summarizeFiOsNavigationGoLiveAudit(reports);
  assert.equal(summary.failedScenarios, 0);
  assert.equal(summary.passedScenarios, GO_LIVE_NAV_ROLE_SCENARIOS.length);
});

test("collapsed shell mobile rail shows six slots for all role profiles", () => {
  for (const scenario of GO_LIVE_NAV_ROLE_SCENARIOS) {
    const report = buildFiOsNavigationGoLiveAuditReport(tenantId, scenario);
    assert.equal(report.primaryRailIds.length, 6);
    assert.deepEqual(report.primaryRailLabels, [...GO_LIVE_PRIMARY_RAIL_LABELS]);
  }
});

test("manager scenario retains admin surfaces while staff scenarios do not", () => {
  const manager = buildFiOsNavigationGoLiveAuditReport(tenantId, {
    persona: "manager",
    workspaceProfile: "clinic_manager",
    showNavigationAdminSurfaces: true,
    showProcedureDayNav: true,
    showTeamAdminSurfaces: true,
    showReportsAdminSurfaces: true,
    tenantBackendAdminRole: "clinic_admin",
  });
  assert.ok(manager.moreDrawerSubIds.includes("d6-navigation-audit"));

  const receptionist = buildFiOsNavigationGoLiveAuditReport(tenantId, {
    persona: "receptionist",
    workspaceProfile: "reception",
    showNavigationAdminSurfaces: false,
  });
  assert.ok(!receptionist.moreDrawerSubIds.includes("d6-navigation-audit"));
  assert.ok(!receptionist.moreDrawerSubIds.includes("staff-identity-audit"));
});
