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
import {
  FI_OS_TEAM_ADMIN_LEGACY_ROUTES,
  FI_OS_TEAM_LEGACY_ROUTES,
  FI_OS_TEAM_NAV_ID,
  FI_OS_TEAM_TABS,
  buildFiOsTeamBase,
  buildFiOsTeamLegacyHref,
  buildFiOsTeamTabHref,
  buildTeamSidebarSubItems,
  isFiOsTeamConsolidatedPath,
  teamSubItemUsesStaffFriendlyLabel,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";

const tenantId = "t-team-1";
const base = `/fi-admin/${tenantId}`;

function fullSidebar(showTeamAdmin = false) {
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
    showTeamAdmin
  );
}

function moreSections(showTeamAdmin = false) {
  return buildFiOsSidebarWorkflowSections(fullSidebar(showTeamAdmin), "default", {
    tenantBase: base,
    forCollapsedShell: true,
    showTeamAdminSurfaces: showTeamAdmin,
    showNavigationAdminSurfaces: showTeamAdmin,
  });
}

function flattenMoreIds(sections = moreSections()) {
  const top = sections.flatMap((s) => s.items.map((i) => i.id));
  const subs = sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  return new Set([...top, ...subs]);
}

test("primary rail still has exactly six slots and Team remains on rail", () => {
  assert.deepEqual(
    [...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS],
    ["today", "calendar", "patients", "team", "reports", "more"]
  );
  assert.equal(primaryRailSlotIds().length, 6);
  const teamRail = resolveFiOsMinimalNavItems(base, fullSidebar()).find((i) => i.id === "team");
  assert.equal(teamRail?.kind, "link");
  if (teamRail?.kind === "link") {
    assert.equal(teamRail.href, `${base}/team`);
    assert.equal(teamRail.label, "Team");
  }
  assert.ok(isPrimaryRailNavId(FI_OS_TEAM_NAV_ID));
});

test("no extra Team or HR OS rows on primary minimal rail", () => {
  const labels = resolveFiOsMinimalNavItems(base, fullSidebar()).map((i) => i.label);
  const teamish = labels.filter((l) => /staff|hr os|workforce|onboarding centre/i.test(l));
  assert.equal(teamish.length, 0);
  const sidebarIds = fullSidebar().map((i) => i.id);
  assert.ok(!sidebarIds.includes("hr-os"));
  assert.ok(!sidebarIds.includes("staff"));
  assert.ok(!sidebarIds.includes("onboarding-centre"));
});

test("More contains one Team group with consolidated destination", () => {
  const team = moreSections().find((s) => s.groupId === "TEAM");
  assert.ok(team);
  assert.deepEqual(
    team!.items.map((i) => i.id),
    [FI_OS_TEAM_NAV_ID]
  );
  assert.equal(team!.items[0]!.href, `${base}/team`);
});

test("Team workspace exposes overview, staff, roster, onboarding, compliance, training, and identity tabs", () => {
  const subs = buildTeamSidebarSubItems(tenantId, { showHrOsNav: true });
  const subIds = new Set(subs.map((s) => s.id));
  for (const tab of FI_OS_TEAM_TABS) {
    assert.ok(subIds.has(tab.navSubItemId));
    assert.ok(isFiOsTeamConsolidatedPath(buildFiOsTeamTabHref(tenantId, tab), base));
  }
  assert.equal(buildFiOsTeamBase(tenantId), `${base}/team`);
});

test("legacy Team routes remain in nav catalog; staff More hides direct links", () => {
  const catalogIds = new Set(
    buildTeamSidebarSubItems(tenantId, { showHrOsNav: true }).map((s) => s.id)
  );
  for (const legacy of FI_OS_TEAM_LEGACY_ROUTES) {
    assert.ok(catalogIds.has(legacy.id), `${legacy.id} should remain in nav catalog`);
    assert.equal(buildFiOsTeamLegacyHref(tenantId, legacy.suffix), `${base}/${legacy.suffix}`);
  }
  const staffMoreIds = flattenMoreIds();
  for (const legacy of FI_OS_TEAM_LEGACY_ROUTES) {
    assert.ok(!staffMoreIds.has(legacy.id), `${legacy.id} should be hidden from staff More`);
  }
  assert.equal(getFiOsShellActiveSidebarId(`${base}/workforce-os`, base), "workforce-os-hub");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/staff`, base), "staff-directory-legacy");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/hr-os/onboarding`, base), "onboarding-centre");
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/workforce-os/staff-identity-audit`, base),
    "staff-identity-audit"
  );
});

test("consolidated team paths activate the team nav item", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/team`, base), FI_OS_TEAM_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/team/staff`, base), FI_OS_TEAM_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/team/roster`, base), FI_OS_TEAM_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/team/onboarding`, base), FI_OS_TEAM_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/team/compliance`, base), FI_OS_TEAM_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/team/training`, base), FI_OS_TEAM_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/team/identity`, base), FI_OS_TEAM_NAV_ID);
});

test("staff-facing team sub-items avoid module-heavy HR and audit labels", () => {
  const staffSubs = buildTeamSidebarSubItems(tenantId, {
    showHrOsNav: true,
    showTeamAdminSurfaces: false,
  });
  for (const sub of staffSubs) {
    assert.ok(teamSubItemUsesStaffFriendlyLabel(sub.label), sub.label);
    assert.ok(!labelHasLegacyModuleLanguage(sub.label), sub.label);
  }
  const identity = staffSubs.find((s) => s.id === "team-identity");
  assert.equal(identity?.label, "Identity & access");
});

test("platform admin retains identity audit and staff access legacy direct links", () => {
  const adminSubs = buildTeamSidebarSubItems(tenantId, {
    showHrOsNav: true,
    showTeamAdminSurfaces: true,
  });
  const adminIds = new Set(adminSubs.map((s) => s.id));
  for (const route of FI_OS_TEAM_ADMIN_LEGACY_ROUTES) {
    assert.ok(adminIds.has(route.id), `admin should see ${route.id}`);
  }
  const adminMore = flattenMoreIds(moreSections(true));
  assert.ok(adminMore.has("staff-identity-audit"));
  assert.ok(adminMore.has("staff-access-legacy"));
});

test("team routes activate primary team rail slot", () => {
  assert.equal(getFiOsMinimalNavActiveId(`${base}/team`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/workforce-os`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/staff`, base), "team");
});

test("Calendar, Front Desk, and Surgery routes remain unchanged", () => {
  const sidebar = fullSidebar();
  const calendarRail = resolveFiOsMinimalNavItems(base, sidebar).find((i) => i.id === "calendar");
  assert.equal(calendarRail?.kind, "link");
  if (calendarRail?.kind === "link") {
    assert.equal(calendarRail.href, `${base}/calendar`);
  }
  const frontDesk = sidebar.find((i) => i.id === FI_OS_FRONT_DESK_NAV_ID);
  assert.ok(frontDesk?.href.endsWith("/front-desk"));
  assert.equal(buildFiOsFrontDeskBase(tenantId), `${base}/front-desk`);
  const surgery = sidebar.find((i) => i.id === FI_OS_SURGERY_NAV_ID);
  assert.ok(surgery?.href.endsWith("/surgery"));
  assert.equal(buildFiOsSurgeryBase(tenantId), `${base}/surgery`);
});
