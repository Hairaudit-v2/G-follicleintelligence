import "server-only";

import { isWorkspaceShellEnabledForTenant } from "@/src/lib/fiOs/workspaceShell/workspaceShellRollout.server";

/**
 * FI-UX-REBUILD D6D rollout gate — cross-workspace signal sync.
 *
 * - `FI_WORKSPACE_SIGNAL_SYNC_ENABLED=true` — on for every tenant with workspace shell.
 * - `FI_WORKSPACE_SIGNAL_SYNC_TENANT_IDS=uuid,uuid` — allowlist only.
 * - When unset, inherits workspace shell rollout.
 */
export function isWorkspaceSignalSyncEnabledForTenant(tenantId: string): boolean {
  const tid = tenantId.trim().toLowerCase();
  if (!tid) return false;

  const explicit = process.env.FI_WORKSPACE_SIGNAL_SYNC_ENABLED?.trim().toLowerCase();
  if (explicit === "false" || explicit === "0") return false;
  if (explicit === "true" || explicit === "1") return true;

  const allowlist = new Set(
    (process.env.FI_WORKSPACE_SIGNAL_SYNC_TENANT_IDS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (allowlist.has(tid)) return true;

  return isWorkspaceShellEnabledForTenant(tenantId);
}
