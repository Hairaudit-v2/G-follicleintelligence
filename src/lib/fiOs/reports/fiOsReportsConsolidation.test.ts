import assert from "node:assert/strict";
import test from "node:test";

import {
  getFiOsMinimalNavActiveId,
  primaryRailSlotIds,
  resolveFiOsMinimalNavItems,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import {
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import {
  FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS,
  isPrimaryRailNavId,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import { labelHasLegacyModuleLanguage } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";
import {
  FI_OS_FRONT_DESK_NAV_ID,
  buildFiOsFrontDeskBase,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import {
  FI_OS_SURGERY_NAV_ID,
  buildFiOsSurgeryBase,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";
import { FI_OS_TEAM_NAV_ID, buildFiOsTeamBase } from "@/src/lib/fiOs/team/teamWorkspaceCore";
import {
  FI_OS_REPORTS_ADMIN_LEGACY_ROUTES,
  FI_OS_REPORTS_LEGACY_ROUTES,
  FI_OS_REPORTS_NAV_ID,
  FI_OS_REPORTS_TABS,
  buildFiOsReportsBase,
  buildFiOsReportsLegacyHref,
  buildFiOsReportsTabHref,
  buildReportsSidebarSubItems,
  isFiOsReportsConsolidatedPath,
  reportsSubItemUsesStaffFriendlyLabel,
} from "@/src/lib/fiOs/reports/reportsWorkspaceCore";

const tenantId = "t-reports-1";
const base = `/fi-admin/${tenantId}`;

function fullSidebar(showReportsAdmin = false) {
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
    showReportsAdmin,
    showReportsAdmin,
    undefined,
    showReportsAdmin
  );
}

function moreSections(showReportsAdmin = false) {
  return buildFiOsSidebarWorkflowSections(fullSidebar(showReportsAdmin), "default", {
    tenantBase: base,
    forCollapsedShell: true,
    showReportsAdminSurfaces: showReportsAdmin,
    showNavigationAdminSurfaces: showReportsAdmin,
    showSettingsAdminSurfaces: showReportsAdmin,
  });
}

function flattenMoreIds(sections = moreSections()) {
  const top = sections.flatMap((s) => s.items.map((i) => i.id));
  const subs = sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  return new Set([...top, ...subs]);
}

test("primary rail has six slots; Reports is More-only (not on rail)", () => {
  assert.deepEqual(
    [...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS],
    ["today", "calendar", "patients", "front-desk", "team", "more"]
  );
  assert.equal(primaryRailSlotIds().length, 6);
  const reportsRail = resolveFiOsMinimalNavItems(base, fullSidebar()).find(
    (i) => (i.id as string) === "reports"
  );
  assert.equal(reportsRail, undefined);
  assert.ok(!isPrimaryRailNavId(FI_OS_REPORTS_NAV_ID));
  assert.ok(!isPrimaryRailNavId("analytics"));
  assert.ok(fullSidebar().some((i) => i.id === "reports" && i.href.endsWith("/reports")));
});

test("no extra Analytics, Insights, or Intelligence rows on primary minimal rail", () => {
  const labels = resolveFiOsMinimalNavItems(base, fullSidebar()).map((i) => i.label);
  assert.ok(!labels.some((l) => /^insights$/i.test(l)));
  assert.ok(!labels.some((l) => /^intelligence$/i.test(l)));
  const sidebarIds = fullSidebar().map((i) => i.id);
  assert.ok(!sidebarIds.includes("analytics"));
  assert.ok(!sidebarIds.includes("auditos"));
});

test("More contains one Reports group with consolidated destination", () => {
  const reports = moreSections().find((s) => s.groupId === "REPORTS");
  assert.ok(reports);
  assert.deepEqual(
    reports!.items.map((i) => i.id),
    [FI_OS_REPORTS_NAV_ID]
  );
  assert.equal(reports!.items[0]!.href, `${base}/reports`);
});

test("Reports workspace exposes overview, analytics, quality, surgery, performance, library, and admin tabs", () => {
  const subs = buildReportsSidebarSubItems(tenantId, {
    showAuditOsNav: true,
    showReportsAdminSurfaces: true,
  });
  const subIds = new Set(subs.map((s) => s.id));
  for (const tab of FI_OS_REPORTS_TABS) {
    assert.ok(subIds.has(tab.navSubItemId));
    assert.ok(isFiOsReportsConsolidatedPath(buildFiOsReportsTabHref(tenantId, tab), base));
  }
  assert.ok(subIds.has("reports-library"));
  assert.equal(buildFiOsReportsBase(tenantId), `${base}/reports`);
  assert.equal(
    buildFiOsReportsTabHref(tenantId, FI_OS_REPORTS_TABS.find((t) => t.id === "library")!),
    `${base}/reports/library`
  );
});

test("legacy reporting routes remain in nav catalog; staff More hides direct links", () => {
  const catalogIds = new Set(
    buildReportsSidebarSubItems(tenantId, {
      showAuditOsNav: true,
      showReportsAdminSurfaces: true,
    }).map((s) => s.id)
  );
  for (const legacy of FI_OS_REPORTS_LEGACY_ROUTES) {
    assert.ok(catalogIds.has(legacy.id), `${legacy.id} should remain in nav catalog`);
    assert.equal(buildFiOsReportsLegacyHref(tenantId, legacy.suffix), `${base}/${legacy.suffix}`);
  }
  const staffMoreIds = flattenMoreIds();
  for (const legacy of FI_OS_REPORTS_LEGACY_ROUTES) {
    assert.ok(!staffMoreIds.has(legacy.id), `${legacy.id} should be hidden from staff More`);
  }
  assert.equal(getFiOsShellActiveSidebarId(`${base}/analytics`, base), "analytics-legacy");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/audit`, base), "auditos-legacy");
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/intelligence/navigation-audit`, base),
    "d6-navigation-audit"
  );
});

test("consolidated reports paths activate the reports nav item", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reports`, base), FI_OS_REPORTS_NAV_ID);
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/reports/analytics`, base),
    FI_OS_REPORTS_NAV_ID
  );
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reports/quality`, base), FI_OS_REPORTS_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reports/surgery`, base), FI_OS_REPORTS_NAV_ID);
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/reports/performance`, base),
    FI_OS_REPORTS_NAV_ID
  );
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reports/library`, base), FI_OS_REPORTS_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reports/admin`, base), FI_OS_REPORTS_NAV_ID);
});

test("staff-facing reports sub-items avoid module-heavy intelligence labels", () => {
  const staffSubs = buildReportsSidebarSubItems(tenantId, {
    showAuditOsNav: true,
    showReportsAdminSurfaces: false,
  });
  for (const sub of staffSubs) {
    if (sub.id === "reports-quality") {
      assert.equal(sub.label, "Quality review");
      continue;
    }
    if (sub.id === "insights-legacy") {
      continue;
    }
    assert.ok(reportsSubItemUsesStaffFriendlyLabel(sub.label), sub.label);
    assert.ok(!labelHasLegacyModuleLanguage(sub.label), sub.label);
  }
  const surgery = staffSubs.find((s) => s.id === "reports-surgery");
  assert.equal(surgery?.label, "Surgery review");
});

test("platform admin retains D6 intelligence legacy direct links", () => {
  const adminSubs = buildReportsSidebarSubItems(tenantId, {
    showAuditOsNav: true,
    showReportsAdminSurfaces: true,
  });
  const adminIds = new Set(adminSubs.map((s) => s.id));
  for (const route of FI_OS_REPORTS_ADMIN_LEGACY_ROUTES) {
    assert.ok(adminIds.has(route.id), `admin should see ${route.id}`);
  }
  const adminMore = flattenMoreIds(moreSections(true));
  assert.ok(adminMore.has("d6-navigation-audit"));
  assert.ok(adminMore.has("d6-presence"));
});

test("reports routes do not activate a primary rail slot (More-only)", () => {
  // Reports is More-only (FI-TRUST-LANDING-AND-SPINE-1) — no primary-rail active id
  assert.equal(getFiOsMinimalNavActiveId(`${base}/reports`, base), null);
  assert.equal(getFiOsMinimalNavActiveId(`${base}/analytics`, base), null);
  assert.equal(getFiOsMinimalNavActiveId(`${base}/intelligence/presence`, base), null);
});

test("Calendar, Front Desk, Surgery, and Team routes remain unchanged", () => {
  const sidebar = fullSidebar();
  const calendarRail = resolveFiOsMinimalNavItems(base, sidebar).find((i) => i.id === "calendar");
  assert.equal(calendarRail?.kind, "link");
  if (calendarRail?.kind === "link") {
    assert.equal(calendarRail.href, `${base}/calendar`);
  }
  assert.equal(buildFiOsFrontDeskBase(tenantId), `${base}/front-desk`);
  assert.ok(sidebar.find((i) => i.id === FI_OS_FRONT_DESK_NAV_ID)?.href.endsWith("/front-desk"));
  assert.equal(buildFiOsSurgeryBase(tenantId), `${base}/surgery`);
  assert.ok(sidebar.find((i) => i.id === FI_OS_SURGERY_NAV_ID)?.href.endsWith("/surgery"));
  assert.equal(buildFiOsTeamBase(tenantId), `${base}/team`);
  assert.ok(sidebar.find((i) => i.id === FI_OS_TEAM_NAV_ID)?.href.endsWith("/team"));
});
