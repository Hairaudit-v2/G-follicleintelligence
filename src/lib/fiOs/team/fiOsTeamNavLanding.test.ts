import assert from "node:assert/strict";
import test from "node:test";

import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { resolveFiOsMinimalNavItems } from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import {
  buildTeamWorkspaceLandingHref,
  FI_OS_TEAM_NAV_ID,
  resolveTeamWorkspaceLandingTabId,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";
import {
  computeEffectiveAccess,
  computeStaffAccessNavFeatureOverrides,
} from "@/src/lib/staffAccess/staffAccessCore";
import { canEnterTeamWorkspace } from "@/src/lib/staffAccess/staffCapabilityCore";
import {
  isTeamTabSegmentAllowed,
  resolveTeamWorkspaceTabAccess,
} from "@/src/lib/staffAccess/staffTeamAccessCore";

const tenantId = "evolved-hair";
const base = `/fi-admin/${tenantId}`;

function teamSidebarItem(visibleTabIds: readonly string[], showHrOsNav: boolean) {
  const raw = resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    showHrOsNav,
    true,
    false,
    false,
    visibleTabIds as Parameters<typeof resolveFiOsPrimarySidebarItems>[11]
  );
  const featureMap = buildDefaultFeatureAccessAllEnabled();
  const sidebar = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, featureMap);
  return sidebar.find((item) => item.id === FI_OS_TEAM_NAV_ID);
}

test("FI-TEAM-MANAGER-ACCESS-404-1: manager without HR OS lands on roster, not overview", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  assert.equal(canEnterTeamWorkspace(access), true);

  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  assert.ok(!tabAccess.visibleTabIds.includes("overview"));
  assert.ok(tabAccess.visibleTabIds.includes("roster"));
  assert.ok(tabAccess.visibleTabIds.includes("staff"));

  const landingTab = resolveTeamWorkspaceLandingTabId(tabAccess.visibleTabIds);
  assert.equal(landingTab, "roster");

  const landingHref = buildTeamWorkspaceLandingHref(tenantId, tabAccess.visibleTabIds);
  assert.equal(landingHref, `${base}/team/roster`);
});

test("FI-TEAM-MANAGER-ACCESS-404-1: manager primary Team nav href matches roster landing", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  const team = teamSidebarItem(tabAccess.visibleTabIds, false);

  assert.ok(team);
  assert.equal(team!.href, `${base}/team/roster`);
  assert.ok(team!.subItems?.some((sub) => sub.href === `${base}/team/roster`));
  assert.ok(!team!.subItems?.some((sub) => sub.label === "Team overview"));
});

test("FI-TEAM-MANAGER-ACCESS-404-1: auditor with HR OS keeps overview landing", () => {
  const access = computeEffectiveAccess({ roleKey: "auditor", grants: [] });
  assert.equal(canEnterTeamWorkspace(access), false);

  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: true });
  assert.ok(tabAccess.visibleTabIds.includes("overview"));

  const landingHref = buildTeamWorkspaceLandingHref(tenantId, tabAccess.visibleTabIds);
  assert.equal(landingHref, `${base}/team`);

  const team = teamSidebarItem(tabAccess.visibleTabIds, true);
  assert.ok(team);
  assert.equal(team!.href, `${base}/team`);
});

test("FI-TEAM-MANAGER-ACCESS-404-1: manager with HR OS full nav keeps overview landing", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: true });
  assert.ok(tabAccess.visibleTabIds.includes("overview"));

  const landingHref = buildTeamWorkspaceLandingHref(tenantId, tabAccess.visibleTabIds);
  assert.equal(landingHref, `${base}/team`);
});

test("FI-TEAM-MANAGER-ACCESS-404-1: receptionist roster grant lands on roster without overview", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [
      {
        moduleKey: "workforce_os",
        tabKey: "roster",
        accessLevel: "edit",
        scope: "tenant",
        revokedAt: null,
      },
    ],
  });

  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  assert.deepEqual(tabAccess.visibleTabIds, ["staff", "roster"]);
  assert.equal(resolveTeamWorkspaceLandingTabId(tabAccess.visibleTabIds), "roster");
  assert.equal(
    buildTeamWorkspaceLandingHref(tenantId, tabAccess.visibleTabIds),
    `${base}/team/roster`
  );
  assert.equal(isTeamTabSegmentAllowed(access, "identity", { hrOsFullNav: false }), false);
});

test("FI-TEAM-MANAGER-ACCESS-404-1: nav visibility and route gate aligned for manager", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  const overrides = computeStaffAccessNavFeatureOverrides(access);
  assert.equal(overrides.staff, undefined);

  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  const team = teamSidebarItem(tabAccess.visibleTabIds, false);
  assert.ok(team);

  const rail = resolveFiOsMinimalNavItems(base, filterFiOsPrimarySidebarItemsByFeatureAccess(
    resolveFiOsPrimarySidebarItems(base, true, true, null, true, true, true, false, true, false, false, tabAccess.visibleTabIds),
    buildDefaultFeatureAccessAllEnabled()
  ));
  const teamRail = rail.find((item) => item.id === "team");
  assert.equal(teamRail?.kind, "link");
  if (teamRail?.kind === "link") {
    assert.equal(teamRail.disabled, false);
    assert.equal(teamRail.href, `${base}/team/roster`);
  }
});

test("FI-TEAM-MANAGER-ACCESS-404-1: overview redirect fallback excludes overview to avoid loop", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: true });
  const fallbackHref = buildTeamWorkspaceLandingHref(tenantId, tabAccess.visibleTabIds, {
    excludeOverview: true,
  });
  assert.equal(fallbackHref, `${base}/team/roster`);
});
