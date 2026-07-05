/**
 * FI-UX-REBUILD D6G-D — consolidated Surgery workspace (routes preserved).
 */

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

export const FI_OS_SURGERY_NAV_ID = "surgery" as const;

export type FiOsSurgeryTabId = "command" | "cases" | "procedure-day" | "review";

export type FiOsSurgeryTab = {
  id: FiOsSurgeryTabId;
  label: string;
  segment: string;
  navSubItemId: string;
  featureKey: FiFeatureKey;
};

export const FI_OS_SURGERY_TABS: readonly FiOsSurgeryTab[] = [
  {
    id: "command",
    label: "Surgery command",
    segment: "",
    navSubItemId: "surgery-command",
    featureKey: "surgery_pipeline",
  },
  {
    id: "cases",
    label: "Cases",
    segment: "cases",
    navSubItemId: "surgery-cases",
    featureKey: "cases",
  },
  {
    id: "procedure-day",
    label: "Procedure day",
    segment: "procedure-day",
    navSubItemId: "surgery-procedure-day",
    featureKey: "procedure_day",
  },
  {
    id: "review",
    label: "Review",
    segment: "review",
    navSubItemId: "surgery-review",
    featureKey: "surgery_pipeline",
  },
] as const;

/** Legacy deep-link routes that must remain live (not redirected). */
export const FI_OS_SURGERY_LEGACY_ROUTES = [
  { id: "surgery-os", label: "Surgery command", suffix: "surgery-os" },
  { id: "cases-worklist", label: "Cases", suffix: "cases" },
  { id: "procedure-day-board", label: "Procedure day", suffix: "procedure-day" },
  { id: "surgery-readiness-board", label: "Readiness board", suffix: "surgery-readiness" },
] as const;

/** Admin-only legacy routes — omitted from staff More unless admin surfaces are on. */
export const FI_OS_SURGERY_ADMIN_LEGACY_ROUTES = [
  {
    id: "surgery-intelligence-dashboard",
    label: "Outcome intelligence",
    suffix: "surgery-os/intelligence",
  },
  { id: "graft-counting-legacy", label: "Graft tray review", suffix: "surgery-os/graft-counting" },
] as const;

export const FI_OS_SURGERY_HIDDEN_MORE_SUB_ITEM_IDS = new Set([
  "procedure-day-board",
  "surgery-intelligence-dashboard",
  "graft-counting-legacy",
]);

export type BuildSurgerySidebarSubItemsOptions = {
  showProcedureDayNav?: boolean;
  showSurgeryAdminSurfaces?: boolean;
  casesBlocked?: boolean;
};

export function buildFiOsSurgeryBase(tenantId: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/surgery`;
}

export function buildFiOsSurgeryTabHref(tenantId: string, tab: FiOsSurgeryTab): string {
  const base = buildFiOsSurgeryBase(tenantId);
  return tab.segment ? `${base}/${tab.segment}` : base;
}

export function buildFiOsSurgeryLegacyHref(tenantId: string, suffix: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/${suffix.replace(/^\/+/, "")}`;
}

export function isFiOsSurgeryConsolidatedPath(pathname: string, tenantBase: string): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === `${base}/surgery` || path.startsWith(`${base}/surgery/`);
}

export function isSurgeryTabActive(
  pathname: string,
  tenantBase: string,
  segment: string
): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!segment) {
    return path === `${base}/surgery` || path === `${base}/surgery/`;
  }
  return path === `${base}/surgery/${segment}` || path.startsWith(`${base}/surgery/${segment}/`);
}

export type FiOsSurgerySidebarSubItem = {
  id: string;
  label: string;
  href: string;
  featureKey?: FiFeatureKey;
};

export function buildSurgerySidebarSubItems(
  tenantId: string,
  opts?: BuildSurgerySidebarSubItemsOptions
): FiOsSurgerySidebarSubItem[] {
  const tid = tenantId.trim();
  const showProcedureDay = opts?.showProcedureDayNav === true;
  const showAdmin = opts?.showSurgeryAdminSurfaces === true;

  const consolidated = FI_OS_SURGERY_TABS.filter((tab) => {
    if (tab.id === "procedure-day" && !showProcedureDay) return false;
    if (tab.id === "cases" && opts?.casesBlocked) return false;
    return true;
  }).map((tab) => ({
    id: tab.navSubItemId,
    label: tab.label,
    href: buildFiOsSurgeryTabHref(tid, tab),
    featureKey: tab.featureKey,
  }));

  const legacy = FI_OS_SURGERY_LEGACY_ROUTES.filter((route) => {
    if (route.id === "procedure-day-board" && !showProcedureDay) return false;
    if (route.id === "cases-worklist" && opts?.casesBlocked) return false;
    return true;
  }).map((route) => ({
    id: route.id,
    label: `${route.label} (direct)`,
    href: buildFiOsSurgeryLegacyHref(tid, route.suffix),
    featureKey:
      route.id === "procedure-day-board"
        ? ("procedure_day" as const)
        : route.id === "cases-worklist"
          ? ("cases" as const)
          : ("surgery_pipeline" as const),
  }));

  const adminLegacy = showAdmin
    ? FI_OS_SURGERY_ADMIN_LEGACY_ROUTES.map((route) => ({
        id: route.id,
        label: `${route.label} (direct)`,
        href: buildFiOsSurgeryLegacyHref(tid, route.suffix),
        featureKey: "surgery_pipeline" as const,
      }))
    : [];

  return [...consolidated, ...legacy, ...adminLegacy];
}

export function surgerySubItemUsesStaffFriendlyLabel(label: string): boolean {
  return !/\bintelligence\b/i.test(label.trim());
}