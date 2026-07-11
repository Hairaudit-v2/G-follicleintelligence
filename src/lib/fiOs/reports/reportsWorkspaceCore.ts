/**
 * FI-UX-REBUILD D6G-F — consolidated Reports workspace (routes preserved).
 */

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

export const FI_OS_REPORTS_NAV_ID = "reports" as const;

export type FiOsReportsTabId =
  | "overview"
  | "analytics"
  | "quality"
  | "surgery"
  | "performance"
  | "library"
  | "admin";

export type FiOsReportsTab = {
  id: FiOsReportsTabId;
  label: string;
  segment: string;
  navSubItemId: string;
  featureKey: FiFeatureKey;
};

export const FI_OS_REPORTS_TABS: readonly FiOsReportsTab[] = [
  {
    id: "overview",
    label: "Reports overview",
    segment: "",
    navSubItemId: "reports-overview",
    featureKey: "analytics",
  },
  {
    id: "analytics",
    label: "Analytics",
    segment: "analytics",
    navSubItemId: "reports-analytics",
    featureKey: "analytics",
  },
  {
    id: "quality",
    label: "Quality review",
    segment: "quality",
    navSubItemId: "reports-quality",
    featureKey: "audit",
  },
  {
    id: "surgery",
    label: "Surgery review",
    segment: "surgery",
    navSubItemId: "reports-surgery",
    featureKey: "surgery_pipeline",
  },
  {
    id: "performance",
    label: "Clinic performance",
    segment: "performance",
    navSubItemId: "reports-performance",
    featureKey: "settings",
  },
  {
    id: "library",
    label: "Library",
    segment: "library",
    navSubItemId: "reports-library",
    featureKey: "analytics",
  },
  {
    id: "admin",
    label: "Admin audit",
    segment: "admin",
    navSubItemId: "reports-admin",
    featureKey: "analytics",
  },
] as const;

/** Legacy deep-link routes that must remain live (not redirected). */
export const FI_OS_REPORTS_LEGACY_ROUTES = [
  { id: "analytics-legacy", label: "Analytics", suffix: "analytics" },
  { id: "insights-legacy", label: "Insights", suffix: "analytics" },
  { id: "auditos-legacy", label: "Quality review", suffix: "audit" },
  { id: "financial-os-legacy", label: "Revenue & billing", suffix: "financial-os" },
  { id: "payments-inbox-legacy", label: "Payments", suffix: "payments" },
  {
    id: "surgery-intelligence-dashboard",
    label: "Surgery insights",
    suffix: "surgery-os/intelligence",
  },
  { id: "graft-counting-legacy", label: "Graft count review", suffix: "surgery-os/graft-counting" },
] as const;

/** Admin-only legacy routes — omitted from staff More unless admin surfaces are on. */
export const FI_OS_REPORTS_ADMIN_LEGACY_ROUTES = [
  {
    id: "surgery-intelligence-dashboard",
    label: "Surgery insights",
    suffix: "surgery-os/intelligence",
  },
  { id: "graft-counting-legacy", label: "Graft count review", suffix: "surgery-os/graft-counting" },
] as const;

export const FI_OS_REPORTS_HIDDEN_MORE_SUB_ITEM_IDS = new Set([
  "surgery-intelligence-dashboard",
  "graft-counting-legacy",
  "reports-admin",
]);

export type BuildReportsSidebarSubItemsOptions = {
  showAuditOsNav?: boolean;
  showReportsAdminSurfaces?: boolean;
};

export function buildFiOsReportsBase(tenantId: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/reports`;
}

export function buildFiOsReportsTabHref(tenantId: string, tab: FiOsReportsTab): string {
  const base = buildFiOsReportsBase(tenantId);
  return tab.segment ? `${base}/${tab.segment}` : base;
}

export function buildFiOsReportsLegacyHref(tenantId: string, suffix: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/${suffix.replace(/^\/+/, "")}`;
}

export function isFiOsReportsConsolidatedPath(pathname: string, tenantBase: string): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === `${base}/reports` || path.startsWith(`${base}/reports/`);
}

export function isReportsTabActive(
  pathname: string,
  tenantBase: string,
  segment: string
): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!segment) {
    return path === `${base}/reports` || path === `${base}/reports/`;
  }
  return (
    path === `${base}/reports/${segment}` || path.startsWith(`${base}/reports/${segment}/`)
  );
}

export type FiOsReportsSidebarSubItem = {
  id: string;
  label: string;
  href: string;
  featureKey?: FiFeatureKey;
};

export function buildReportsSidebarSubItems(
  tenantId: string,
  opts?: BuildReportsSidebarSubItemsOptions
): FiOsReportsSidebarSubItem[] {
  const tid = tenantId.trim();
  const showAudit = opts?.showAuditOsNav !== false;
  const showAdmin = opts?.showReportsAdminSurfaces === true;

  const consolidated = FI_OS_REPORTS_TABS.filter((tab) => {
    if (tab.id === "quality" && !showAudit) return false;
    if (tab.id === "admin" && !showAdmin) return false;
    return true;
  }).map((tab) => ({
    id: tab.navSubItemId,
    label: tab.label,
    href: buildFiOsReportsTabHref(tid, tab),
    featureKey: tab.featureKey,
  }));

  const legacy = FI_OS_REPORTS_LEGACY_ROUTES.filter((route) => {
    if (route.id === "auditos-legacy" && !showAudit) return false;
    if (
      (route.id === "surgery-intelligence-dashboard" || route.id === "graft-counting-legacy") &&
      !showAdmin
    ) {
      return false;
    }
    return true;
  }).map((route) => ({
    id: route.id,
    label: `${route.label} (direct)`,
    href: buildFiOsReportsLegacyHref(tid, route.suffix),
    featureKey:
      route.id === "auditos-legacy"
        ? ("audit" as const)
        : route.id === "financial-os-legacy" || route.id === "payments-inbox-legacy"
          ? ("settings" as const)
          : route.id === "surgery-intelligence-dashboard" || route.id === "graft-counting-legacy"
            ? ("surgery_pipeline" as const)
            : ("analytics" as const),
  }));

  const adminLegacy = showAdmin
    ? FI_OS_REPORTS_ADMIN_LEGACY_ROUTES.map((route) => ({
        id: route.id,
        label: `${route.label} (direct)`,
        href: buildFiOsReportsLegacyHref(tid, route.suffix),
        featureKey: "analytics" as const,
      }))
    : [];

  return [...consolidated, ...legacy, ...adminLegacy];
}

const REPORTS_MODULE_LANGUAGE_RE =
  /\b(?:intelligence|analytics\s*os|audit\s*os|hair\s*audit|signal\s*learning|bake\s*gate|navigation\s*audit)\b/i;

export function reportsSubItemUsesStaffFriendlyLabel(label: string): boolean {
  return !REPORTS_MODULE_LANGUAGE_RE.test(label.trim());
}