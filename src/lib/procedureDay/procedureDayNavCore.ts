import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import type { ResolvedClinicOsShellNavItem } from "@/src/lib/fiAdmin/clinicOsShellConfig";

export const PROCEDURE_DAY_BOARD_NAV_ID = "procedure-day-board";

/** Href for procedure-day deep links when the deployment flag is off (non-breaking fallback). */
export function resolveProcedureDayNavHref(base: string, enabled: boolean): string {
  const b = base.replace(/\/+$/, "") || "";
  return enabled ? `${b}/procedure-day` : `${b}/calendar`;
}

export function filterProcedureDayFromFiOsSidebarItems(
  items: readonly FiOsPrimarySidebarItem[],
  showProcedureDayNav: boolean
): FiOsPrimarySidebarItem[] {
  if (showProcedureDayNav) return [...items];
  return items.map((item) => {
    if (!item.subItems?.length) return item;
    const subItems = item.subItems.filter((s) => s.id !== PROCEDURE_DAY_BOARD_NAV_ID);
    if (subItems.length === item.subItems.length) return item;
    return { ...item, subItems };
  });
}

export function filterProcedureDayFromClinicOsNavItems(
  items: readonly ResolvedClinicOsShellNavItem[],
  showProcedureDayNav: boolean
): ResolvedClinicOsShellNavItem[] {
  if (showProcedureDayNav) return [...items];
  return items.filter((item) => item.id !== PROCEDURE_DAY_BOARD_NAV_ID);
}