import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { FI_FEATURE_REGISTRY } from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILES, isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";

function isFeatureOn(access: ReadonlyMap<FiFeatureKey, boolean>, key: FiFeatureKey): boolean {
  return access.get(key) !== false;
}

/**
 * Short, positive copy for tenants with partial Stage 2 visibility (no “restricted” framing).
 */
export function buildFiOsWorkspaceFocusLine(opts: {
  workspaceProfile?: FiWorkspaceProfileKey | null;
  featureAccess: ReadonlyMap<FiFeatureKey, boolean> | null;
}): string | null {
  const { featureAccess, workspaceProfile } = opts;
  if (!featureAccess) return null;
  const pk: FiWorkspaceProfileKey =
    workspaceProfile && isFiWorkspaceProfileKey(workspaceProfile) ? workspaceProfile : "default";
  const preferred = FI_WORKSPACE_PROFILES[pk]?.preferredNavFeatures ?? [];
  const labels = preferred
    .filter((k) => isFeatureOn(featureAccess, k))
    .map((k) => FI_FEATURE_REGISTRY[k]?.label ?? k)
    .filter(Boolean);

  if (labels.length >= 2) {
    const head = labels.slice(0, 3).join(", ");
    return `Your workspace is focused on ${head}.`;
  }
  if (labels.length === 1) {
    return `Your workspace is focused on ${labels[0]}.`;
  }

  const fallbacks: FiFeatureKey[] = [
    "consultations",
    "calendar",
    "crm",
    "cases",
    "patients",
    "procedure_day",
  ];
  const fbLabels = fallbacks
    .filter((k) => isFeatureOn(featureAccess, k))
    .map((k) => FI_FEATURE_REGISTRY[k].label);
  if (fbLabels.length) {
    return `Your workspace is tuned for ${fbLabels.slice(0, 2).join(" and ")}.`;
  }

  return "Your workspace highlights the modules your team has turned on for you.";
}
