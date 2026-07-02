import "server-only";

import { isTodaySurfaceEnabledForTenant } from "@/src/lib/fiOs/todaySurfaceRollout.server";
import {
  isWorkspaceShellEnabledForTenant,
  type WorkspaceShellTenantGateContext,
} from "@/src/lib/fiOs/workspaceShell/workspaceShellRollout.server";

/**
 * FI-UX-REBUILD D2 — navigation collapse rollout gate.
 *
 * Active only when both Today surface and Workspace Shell are enabled for the
 * tenant. Either flag OFF keeps the legacy module sidebar unchanged.
 */
export function isNavCollapseEnabledForTenant(
  tenantId: string,
  context: WorkspaceShellTenantGateContext = {}
): boolean {
  return (
    isTodaySurfaceEnabledForTenant(tenantId, context) &&
    isWorkspaceShellEnabledForTenant(tenantId, context)
  );
}
