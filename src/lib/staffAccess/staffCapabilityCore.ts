/**
 * D6G-G0B — Pure staff capability resolver (base role + explicit tab grants).
 */

import {
  STAFF_CAPABILITY_SPECS,
  WORKFORCE_SENSITIVE_TAB_KEYS,
  type StaffCapabilityKey,
  type WorkforceOsTabKey,
} from "./staffCapabilityRegistry";
import {
  canEditModule,
  canViewModule,
  getModuleAccess,
  moduleSatisfies,
  type EffectiveAccessMap,
} from "./staffAccessCore";
import {
  accessLevelSatisfies,
  type StaffAccessLevel,
} from "./staffAccessRegistry";

/** Whether the viewer holds a capability via module edit or explicit tab grant. */
export function staffCapabilitySatisfies(
  access: EffectiveAccessMap,
  capability: StaffCapabilityKey
): boolean {
  const spec = STAFF_CAPABILITY_SPECS[capability];
  if (moduleSatisfies(access, spec.module, spec.requiredLevel)) {
    return true;
  }
  if (canAccessWorkforceTab(access, spec.tabKey, spec.requiredLevel)) {
    return true;
  }
  if (
    capability === "roster.standard_hours.manage" &&
    staffCapabilitySatisfies(access, "roster.manage")
  ) {
    return true;
  }
  return false;
}

/**
 * Tab access for workforce_os with sensitive-tab isolation.
 * Sensitive tabs (identity, onboarding, etc.) require explicit tab grants unless the
 * viewer has full module edit (manager template).
 */
export function canAccessWorkforceTab(
  access: EffectiveAccessMap,
  tabKey: WorkforceOsTabKey,
  required: StaffAccessLevel = "read"
): boolean {
  if (canEditModule(access, "workforce_os")) {
    return true;
  }

  const entry = getModuleAccess(access, "workforce_os");
  const tab = entry.tabs[tabKey];

  if (WORKFORCE_SENSITIVE_TAB_KEYS.has(tabKey)) {
    return tab ? accessLevelSatisfies(tab.level, required) : false;
  }

  if (tab) {
    return accessLevelSatisfies(tab.level, required);
  }

  return false;
}

/**
 * Team sub-nav tab access when HR OS full nav is off.
 * Does not inherit module edit — requires explicit tab grants (roster-only safe).
 */
export function canAccessWorkforceTabForTeamNav(
  access: EffectiveAccessMap,
  tabKey: WorkforceOsTabKey,
  required: StaffAccessLevel = "read",
  opts?: { hrOsFullNav?: boolean }
): boolean {
  if (opts?.hrOsFullNav === true) {
    return canAccessWorkforceTab(access, tabKey, required);
  }

  const entry = getModuleAccess(access, "workforce_os");
  const tab = entry.tabs[tabKey];
  if (!tab) return false;
  return accessLevelSatisfies(tab.level, required);
}

/** True when any workforce tab grant or module view allows Team workspace entry. */
export function canEnterTeamWorkspace(access: EffectiveAccessMap): boolean {
  if (canViewModule(access, "workforce_os")) {
    return true;
  }
  const tabs = getModuleAccess(access, "workforce_os").tabs;
  return Object.keys(tabs).length > 0;
}

/** List capabilities currently satisfied (for audit snapshots). */
export function listSatisfiedStaffCapabilities(
  access: EffectiveAccessMap
): StaffCapabilityKey[] {
  return (Object.keys(STAFF_CAPABILITY_SPECS) as StaffCapabilityKey[]).filter((key) =>
    staffCapabilitySatisfies(access, key)
  );
}
