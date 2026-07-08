import "server-only";

import { cache } from "react";

import type { ModuleAccessDenialReason } from "@/src/lib/platform/entitlements/entitlementTypes";
import {
  loadHrOsNavVisibleForViewer,
  resolveHrOsRouteAccess,
} from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

import { canEnterTeamWorkspace } from "./staffCapabilityCore";
import { getStaffEffectiveAccess } from "./staffAccess.server";
import {
  resolveTeamWorkspaceTabAccess,
  type TeamWorkspaceTabAccess,
} from "./staffTeamAccessCore";

export type TeamWorkspaceAccessDecision =
  | {
      allowed: true;
      tabAccess: TeamWorkspaceTabAccess;
      /** HR OS route gate passed (manager+ roles). */
      hrOsRouteGranted: boolean;
    }
  | {
      allowed: false;
      tabAccess: TeamWorkspaceTabAccess;
      hrOsRouteGranted: false;
      deniedReason: ModuleAccessDenialReason;
    };

async function resolveTeamWorkspaceAccessImpl(
  tenantId: string
): Promise<TeamWorkspaceAccessDecision> {
  const tid = tenantId.trim();
  const [hrAccess, showHrOsNav, { access }] = await Promise.all([
    resolveHrOsRouteAccess(tid),
    loadHrOsNavVisibleForViewer(tid),
    getStaffEffectiveAccess(tid),
  ]);

  const hrOsFullNav = hrAccess.ok && showHrOsNav;
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav });

  if (hrAccess.ok) {
    return {
      allowed: true,
      tabAccess,
      hrOsRouteGranted: true,
    };
  }

  if (canEnterTeamWorkspace(access)) {
    return {
      allowed: true,
      tabAccess,
      hrOsRouteGranted: false,
    };
  }

  return {
    allowed: false,
    tabAccess,
    hrOsRouteGranted: false,
    // Team has a workforce-access fallback — entitlement denials here are misleading.
    deniedReason: "role_not_allowed",
  };
}

/** Deduped per request — team layout + pages share one capability evaluation. */
export const resolveTeamWorkspaceAccessForViewer = cache(resolveTeamWorkspaceAccessImpl);
