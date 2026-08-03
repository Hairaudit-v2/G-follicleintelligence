/**
 * FI-LH-NAV-COMPACT-1 — Settings workspace sub-nav (low-frequency admin routes).
 */

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { FI_OS_D6_INTELLIGENCE_NAV_ENTRIES } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";

/** Admin-only settings sub-routes — hidden from staff nav unless admin surfaces are on. */
export const FI_OS_SETTINGS_ADMIN_LEGACY_ROUTES = [
  ...FI_OS_D6_INTELLIGENCE_NAV_ENTRIES.map((entry) => ({
    id: entry.id,
    label:
      entry.id === "d6-bake"
        ? "Intelligence validation"
        : entry.id === "d6-navigation-audit"
          ? "Navigation audit"
          : entry.id === "d6-signal-learning"
            ? "Learning signals"
            : entry.id === "d6-presence"
              ? "Presence review"
              : entry.label,
    suffix: entry.routeSuffix,
  })),
] as const;

export const FI_OS_SETTINGS_HIDDEN_MORE_SUB_ITEM_IDS = new Set(
  FI_OS_SETTINGS_ADMIN_LEGACY_ROUTES.map((r) => r.id)
);

export type BuildSettingsSidebarSubItemsOptions = {
  showSettingsAdminSurfaces?: boolean;
};

export type FiOsSettingsSidebarSubItem = {
  id: string;
  label: string;
  href: string;
  featureKey?: FiFeatureKey;
};

export function buildFiOsSettingsLegacyHref(tenantId: string, suffix: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/${suffix.replace(/^\/+/, "")}`;
}

export function buildSettingsSidebarSubItems(
  tenantId: string,
  opts?: BuildSettingsSidebarSubItemsOptions
): FiOsSettingsSidebarSubItem[] {
  const tid = tenantId.trim();
  /** Personal preference — available to every staff member (not admin-only). */
  const personal: FiOsSettingsSidebarSubItem[] = [
    {
      id: "clinic-guide",
      label: "Clinic guide",
      href: buildFiOsSettingsLegacyHref(tid, "settings/clinic-guide"),
      // No featureKey: doctors/nurses/reception must reach their on/off toggle.
    },
  ];

  if (opts?.showSettingsAdminSurfaces !== true) return personal;

  return [
    ...personal,
    ...FI_OS_SETTINGS_ADMIN_LEGACY_ROUTES.map((route) => ({
      id: route.id,
      label: `${route.label} (direct)`,
      href: buildFiOsSettingsLegacyHref(tid, route.suffix),
      featureKey: "settings" as const,
    })),
  ];
}
