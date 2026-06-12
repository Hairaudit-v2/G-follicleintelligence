import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILES, isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import {
  DASHBOARD_QUICK_ACTION_DEFINITIONS,
  type DashboardQuickActionKey,
  type ResolvedDashboardQuickAction,
} from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";

const DEFINITION_KEY_ORDER: readonly DashboardQuickActionKey[] = DASHBOARD_QUICK_ACTION_DEFINITIONS.map((d) => d.key);

/**
 * Reorders resolved quick actions using the workspace profile, then appends any remaining definition keys
 * so disabled CRM / bookings rows stay discoverable (matches pre–Stage 3 behaviour).
 */
export function composeWorkspaceQuickActionsOrder(opts: {
  workspaceProfile: FiWorkspaceProfileKey;
  resolvedItems: readonly ResolvedDashboardQuickAction[];
}): ResolvedDashboardQuickAction[] {
  const { workspaceProfile, resolvedItems } = opts;
  const profileKey: FiWorkspaceProfileKey = isFiWorkspaceProfileKey(workspaceProfile) ? workspaceProfile : "default";
  const profile = FI_WORKSPACE_PROFILES[profileKey] ?? FI_WORKSPACE_PROFILES.default;

  const preferred: readonly DashboardQuickActionKey[] =
    profileKey === "default" ? DEFINITION_KEY_ORDER : profile.defaultQuickActions;

  const byKey = new Map<DashboardQuickActionKey, ResolvedDashboardQuickAction>();
  for (const item of resolvedItems) byKey.set(item.key, item);

  const out: ResolvedDashboardQuickAction[] = [];
  const used = new Set<DashboardQuickActionKey>();

  for (const k of preferred) {
    const item = byKey.get(k);
    if (item) {
      out.push(item);
      used.add(k);
    }
  }
  for (const k of DEFINITION_KEY_ORDER) {
    if (used.has(k)) continue;
    const item = byKey.get(k);
    if (item) out.push(item);
  }
  return out;
}
