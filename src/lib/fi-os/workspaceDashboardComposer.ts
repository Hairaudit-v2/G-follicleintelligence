import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import { FI_DASHBOARD_WIDGET_KEYS } from "@/src/config/fiDashboardRegistry";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILES, isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { fiDashboardWidgetVisibleByFeatureAccess } from "@/src/lib/fi-os/stage2FeatureVisibility";

function dedupePreserveOrder(keys: readonly FiDashboardWidgetKey[]): FiDashboardWidgetKey[] {
  const seen = new Set<FiDashboardWidgetKey>();
  const out: FiDashboardWidgetKey[] = [];
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function filterByFeature(
  keys: readonly FiDashboardWidgetKey[],
  featureAccess: ReadonlyMap<FiFeatureKey, boolean> | null
): FiDashboardWidgetKey[] {
  return keys.filter((w) => fiDashboardWidgetVisibleByFeatureAccess(w, featureAccess));
}

const AVAILABLE_WIDGET_SET = new Set<FiDashboardWidgetKey>(FI_DASHBOARD_WIDGET_KEYS);

/**
 * Builds an ordered home widget stack:
 * - `default` profile (or unknown key) uses `registryBaselineOrder` (Stage 1/2 canonical order).
 * - Other profiles start from `FI_WORKSPACE_PROFILES[profile].defaultDashboardWidgets`, intersected with implemented keys.
 * - Stage 2 feature access always filters individual widgets (overrides win).
 * - Never returns an empty array.
 */
export function composeWorkspaceDashboardWidgets(opts: {
  workspaceProfile: FiWorkspaceProfileKey;
  featureAccess: ReadonlyMap<FiFeatureKey, boolean> | null;
  /** Typically {@link FI_DASHBOARD_HOME_WIDGET_ORDER}. */
  registryBaselineOrder: readonly FiDashboardWidgetKey[];
  /** Implemented widget keys (registry); future-proof for partial rollouts. */
  availableWidgets: readonly FiDashboardWidgetKey[];
}): FiDashboardWidgetKey[] {
  const { workspaceProfile, featureAccess, registryBaselineOrder, availableWidgets } = opts;
  const profileKey: FiWorkspaceProfileKey = isFiWorkspaceProfileKey(workspaceProfile) ? workspaceProfile : "default";
  const available = new Set(availableWidgets.filter((k) => AVAILABLE_WIDGET_SET.has(k)));

  const baseline = dedupePreserveOrder(registryBaselineOrder.filter((k) => available.has(k)));
  const baselineVisible = filterByFeature(baseline, featureAccess);

  const profile = FI_WORKSPACE_PROFILES[profileKey] ?? FI_WORKSPACE_PROFILES.default;
  const useBaselineOnly = profileKey === "default";

  const fromProfile = dedupePreserveOrder(
    (useBaselineOnly ? baseline : profile.defaultDashboardWidgets.filter((k) => available.has(k)))
  );
  const fromProfileVisible = filterByFeature(fromProfile, featureAccess);

  if (fromProfileVisible.length > 0) return fromProfileVisible;
  if (baselineVisible.length > 0) return baselineVisible;

  const lastResort = filterByFeature(dedupePreserveOrder([...FI_DASHBOARD_WIDGET_KEYS]), featureAccess);
  if (lastResort.length > 0) return lastResort;

  for (const k of registryBaselineOrder) {
    if (available.has(k) && fiDashboardWidgetVisibleByFeatureAccess(k, featureAccess)) return [k];
  }
  for (const k of FI_DASHBOARD_WIDGET_KEYS) {
    if (fiDashboardWidgetVisibleByFeatureAccess(k, featureAccess)) return [k];
  }
  return ["quick_actions"];
}
