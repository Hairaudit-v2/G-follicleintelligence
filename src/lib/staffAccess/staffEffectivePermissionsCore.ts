/**
 * D6G-G0B — Single effective permission surface for nav, route gates, and actions.
 *
 * Combines:
 * - base role templates (SA-1)
 * - explicit staff grants (capability overrides via module/tab)
 * - admin override path (when provided to computeEffectiveAccess)
 *
 * Prefer these helpers over role-name checks.
 */

import {
  canAccessWorkforceTab,
  canEnterTeamWorkspace,
  listSatisfiedStaffCapabilities,
  staffCapabilitySatisfies,
} from "./staffCapabilityCore";
import {
  canEditModule,
  canViewModule,
  computeEffectiveAccess,
  type ComputeEffectiveAccessInput,
  type EffectiveAccessMap,
} from "./staffAccessCore";
import type { StaffCapabilityKey } from "./staffCapabilityRegistry";

export type EffectiveStaffPermissions = {
  /** Derived SA-1 access map (for advanced callers). */
  access: EffectiveAccessMap;
  /** Satisfied capability keys (audit snapshot). */
  capabilities: StaffCapabilityKey[];

  canViewRoster: boolean;
  canManageRoster: boolean;
  canManageStandardHours: boolean;
  canViewTeamWorkspace: boolean;
  canViewIdentityAccess: boolean;
  canManageIdentityAccess: boolean;
  canViewReports: boolean;
  canViewReportsAdmin: boolean;
  canViewSurgeryAdmin: boolean;
  canViewNavigationAdminSurfaces: boolean;
};

/**
 * Resolve boolean permissions from an already-computed effective access map.
 * Pure — no I/O.
 */
export function resolveEffectiveStaffPermissions(
  access: EffectiveAccessMap,
  opts?: {
    /** Platform / clinic admin surfaces for intelligence & reports admin. */
    showNavigationAdminSurfaces?: boolean;
    showReportsAdminSurfaces?: boolean;
    hrOsFullNav?: boolean;
  }
): EffectiveStaffPermissions {
  const showAdmin = opts?.showNavigationAdminSurfaces === true;
  const showReportsAdmin = opts?.showReportsAdminSurfaces === true || showAdmin;

  const canManageRoster = staffCapabilitySatisfies(access, "roster.manage");
  const canViewRoster =
    staffCapabilitySatisfies(access, "roster.view") || canManageRoster;
  const canManageStandardHours = staffCapabilitySatisfies(
    access,
    "roster.standard_hours.manage"
  );
  const canManageIdentityAccess = staffCapabilitySatisfies(
    access,
    "team.identity.manage"
  );
  const canViewIdentityAccess =
    canManageIdentityAccess ||
    canAccessWorkforceTab(access, "identity", "read") ||
    opts?.hrOsFullNav === true;

  return {
    access,
    capabilities: listSatisfiedStaffCapabilities(access),
    canViewRoster,
    canManageRoster,
    canManageStandardHours,
    canViewTeamWorkspace: canEnterTeamWorkspace(access),
    canViewIdentityAccess,
    canManageIdentityAccess,
    canViewReports: canViewModule(access, "analytics_os"),
    canViewReportsAdmin: showReportsAdmin && canViewModule(access, "analytics_os"),
    canViewSurgeryAdmin: showAdmin && canEditModule(access, "surgery_os"),
    canViewNavigationAdminSurfaces: showAdmin,
  };
}

/** Convenience: computeEffectiveAccess then resolve booleans. */
export function resolveEffectiveStaffPermissionsFromInput(
  input: ComputeEffectiveAccessInput,
  opts?: Parameters<typeof resolveEffectiveStaffPermissions>[1]
): EffectiveStaffPermissions {
  return resolveEffectiveStaffPermissions(computeEffectiveAccess(input), opts);
}

/**
 * Map a workforce tab grant to capability keys for audit metadata.
 * Pure helper — does not write audit rows.
 */
export function capabilityKeysForGrant(input: {
  moduleKey: string;
  tabKey: string | null;
  accessLevel: string;
}): StaffCapabilityKey[] {
  if (input.moduleKey !== "workforce_os") return [];
  const tab = input.tabKey?.trim() || null;
  const level = input.accessLevel;
  const keys: StaffCapabilityKey[] = [];

  if (tab === "roster") {
    if (level === "read") keys.push("roster.view");
    if (level === "edit" || level === "approve" || level === "admin") {
      keys.push("roster.view", "roster.manage", "roster.standard_hours.manage");
    }
  }
  if (tab === "standard_hours") {
    if (level === "edit" || level === "approve" || level === "admin") {
      keys.push("roster.standard_hours.manage");
    }
  }
  if (tab === "identity" && (level === "edit" || level === "approve" || level === "admin")) {
    keys.push("team.identity.manage");
  }
  if (tab === "onboarding" && (level === "edit" || level === "approve" || level === "admin")) {
    keys.push("team.onboarding.manage");
  }
  if (tab === "compliance" && (level === "edit" || level === "approve" || level === "admin")) {
    keys.push("team.compliance.manage");
  }
  if (tab === "training" && (level === "edit" || level === "approve" || level === "admin")) {
    keys.push("team.training.manage");
  }
  return keys;
}
