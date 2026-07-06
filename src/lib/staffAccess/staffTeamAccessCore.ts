/**
 * D6G-G0B — Team workspace tab visibility from effective capabilities.
 */

import type { FiOsTeamTabId } from "@/src/lib/fiOs/team/teamWorkspaceCore";
import { FI_OS_TEAM_TABS } from "@/src/lib/fiOs/team/teamWorkspaceCore";

import {
  canAccessWorkforceTabForTeamNav,
  staffCapabilitySatisfies,
} from "./staffCapabilityCore";
import { TEAM_TAB_ID_TO_WORKFORCE_TAB_KEY } from "./staffCapabilityRegistry";
import { canEditModule, type EffectiveAccessMap } from "./staffAccessCore";

export type TeamWorkspaceTabAccess = {
  /** Tab ids visible in Team sub-nav for this viewer. */
  visibleTabIds: FiOsTeamTabId[];
  canManageRoster: boolean;
  canManageStandardHours: boolean;
  canManageIdentity: boolean;
  /** HR OS entitlement path — full HR tab set when true. */
  hrOsFullNav: boolean;
};

function tabVisibleByCapability(
  access: EffectiveAccessMap,
  tabId: FiOsTeamTabId,
  hrOsFullNav: boolean
): boolean {
  if (tabId === "overview") {
    return hrOsFullNav;
  }

  if (tabId === "staff") {
    return true;
  }

  if (hrOsFullNav) {
    return true;
  }

  const workforceTabKey = TEAM_TAB_ID_TO_WORKFORCE_TAB_KEY[tabId];
  if (!workforceTabKey) {
    return false;
  }

  if (tabId === "roster") {
    return (
      canAccessWorkforceTabForTeamNav(access, "roster", "read", { hrOsFullNav: false }) ||
      staffCapabilitySatisfies(access, "roster.manage")
    );
  }

  if (tabId === "identity") {
    return canAccessWorkforceTabForTeamNav(access, "identity", "read", { hrOsFullNav: false });
  }

  return canAccessWorkforceTabForTeamNav(access, workforceTabKey, "read", {
    hrOsFullNav: false,
  });
}

/** Resolve which Team workspace tabs a viewer may see. */
export function resolveTeamWorkspaceTabAccess(
  access: EffectiveAccessMap,
  opts?: { hrOsFullNav?: boolean }
): TeamWorkspaceTabAccess {
  const hrOsFullNav = opts?.hrOsFullNav === true;

  const visibleTabIds = FI_OS_TEAM_TABS.filter((tab) =>
    tabVisibleByCapability(access, tab.id, hrOsFullNav)
  ).map((tab) => tab.id);

  return {
    visibleTabIds,
    canManageRoster:
      hrOsFullNav && canEditModule(access, "workforce_os")
        ? true
        : staffCapabilitySatisfies(access, "roster.manage"),
    canManageStandardHours:
      hrOsFullNav && canEditModule(access, "workforce_os")
        ? true
        : staffCapabilitySatisfies(access, "roster.standard_hours.manage"),
    canManageIdentity:
      hrOsFullNav && canEditModule(access, "workforce_os")
        ? true
        : staffCapabilitySatisfies(access, "team.identity.manage"),
    hrOsFullNav,
  };
}

/** Whether a specific team tab segment is reachable (route gate helper). */
export function isTeamTabSegmentAllowed(
  access: EffectiveAccessMap,
  tabId: FiOsTeamTabId,
  opts?: { hrOsFullNav?: boolean }
): boolean {
  return resolveTeamWorkspaceTabAccess(access, opts).visibleTabIds.includes(tabId);
}
