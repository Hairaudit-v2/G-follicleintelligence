import "server-only";

import { notFound } from "next/navigation";

import type { FiOsTeamTabId } from "@/src/lib/fiOs/team/teamWorkspaceCore";
import { getStaffEffectiveAccess } from "@/src/lib/staffAccess/staffAccess.server";
import { isTeamTabSegmentAllowed } from "@/src/lib/staffAccess/staffTeamAccessCore";
import { resolveTeamWorkspaceAccessForViewer } from "@/src/lib/staffAccess/staffTeamAccess.server";

/** Route gate: deny with 404 when the viewer lacks access to a Team workspace tab. */
export async function assertTeamTabAccessOrNotFound(
  tenantId: string,
  tabId: FiOsTeamTabId
): Promise<void> {
  const teamAccess = await resolveTeamWorkspaceAccessForViewer(tenantId.trim());
  if (!teamAccess.allowed) {
    notFound();
  }

  const { access } = await getStaffEffectiveAccess(tenantId.trim());
  const allowed = isTeamTabSegmentAllowed(access, tabId, {
    hrOsFullNav: teamAccess.tabAccess.hrOsFullNav,
  });

  if (!allowed) {
    notFound();
  }
}
