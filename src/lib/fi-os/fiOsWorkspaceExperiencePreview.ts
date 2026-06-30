import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
  FI_FEATURE_REGISTRY,
  listFiFeatureKeys,
} from "@/src/config/fiFeatureAccessRegistry";
import { resolveDashboardQuickActions } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import { filterResolvedQuickActionsByFeatureAccess } from "@/src/lib/fi-os/stage2FeatureVisibility";
import { composeWorkspaceQuickActionsOrder } from "@/src/lib/fi-os/workspaceQuickActionsComposer";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILES, isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

const PREVIEW_BASE = "/fi-admin/t-0";

function featureMapFromRecord(
  r: Record<FiFeatureKey, boolean>
): ReadonlyMap<FiFeatureKey, boolean> {
  return applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), r);
}

/**
 * Admin-only summary of how FI OS will feel for a staff member (Stage UI activation; no schema).
 */
export function buildStaffFiOsExperiencePreview(opts: {
  workspaceProfile: FiWorkspaceProfileKey;
  effectiveFeatures: Record<FiFeatureKey, boolean>;
  showCrmNav?: boolean;
  showBookingsBoard?: boolean;
}): string[] {
  const { workspaceProfile, effectiveFeatures } = opts;
  const showCrmNav = opts.showCrmNav ?? true;
  const showBookingsBoard = opts.showBookingsBoard ?? true;
  const access = featureMapFromRecord(effectiveFeatures);
  const profileKey: FiWorkspaceProfileKey = isFiWorkspaceProfileKey(workspaceProfile)
    ? workspaceProfile
    : "default";

  const lines: string[] = [];
  lines.push(`Workspace: ${FI_WORKSPACE_PROFILES[profileKey]?.label ?? profileKey}`);

  const rawNav = resolveFiOsPrimarySidebarItems(
    PREVIEW_BASE,
    showCrmNav,
    showBookingsBoard,
    null,
    true,
    true
  );
  const nav = filterFiOsPrimarySidebarItemsByFeatureAccess(rawNav, access);
  const sections = buildFiOsSidebarWorkflowSections(nav, profileKey);
  const primary = sections
    .filter((s) => s.groupId !== "HOME" && s.groupId !== "SYSTEM")
    .slice(0, 4)
    .map((s) => s.title);
  if (primary.length) {
    lines.push(`Primary groups: ${primary.join(", ")}`);
  }

  const hidden = listFiFeatureKeys()
    .filter((k) => k !== "quick_actions" && effectiveFeatures[k] === false)
    .map((k) => FI_FEATURE_REGISTRY[k].label);
  if (hidden.length) {
    lines.push(
      `Modules not on this layout: ${hidden.slice(0, 12).join(", ")}${hidden.length > 12 ? "…" : ""}`
    );
  }

  const quickBase = resolveDashboardQuickActions(PREVIEW_BASE, { showCrmNav, showBookingsBoard });
  const quickFiltered = filterResolvedQuickActionsByFeatureAccess(quickBase, access);
  const quickOrdered = composeWorkspaceQuickActionsOrder({
    workspaceProfile: profileKey,
    resolvedItems: quickFiltered,
  });
  const quickLabels = quickOrdered.filter((q) => q.enabled).map((q) => q.label);
  if (quickLabels.length) {
    lines.push(`Quick actions: ${quickLabels.join(", ")}`);
  }

  return lines;
}
