/**
 * FI-UX-REBUILD D6G-E — consolidated Team workspace (routes preserved).
 */

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

export const FI_OS_TEAM_NAV_ID = "team" as const;

export type FiOsTeamTabId =
  | "overview"
  | "staff"
  | "roster"
  | "onboarding"
  | "compliance"
  | "training"
  | "identity";

export type FiOsTeamTab = {
  id: FiOsTeamTabId;
  label: string;
  segment: string;
  navSubItemId: string;
  featureKey: FiFeatureKey;
};

export const FI_OS_TEAM_TABS: readonly FiOsTeamTab[] = [
  {
    id: "overview",
    label: "Team overview",
    segment: "",
    navSubItemId: "team-overview",
    featureKey: "staff",
  },
  {
    id: "staff",
    label: "Staff directory",
    segment: "staff",
    navSubItemId: "team-staff",
    featureKey: "staff",
  },
  {
    id: "roster",
    label: "Roster",
    segment: "roster",
    navSubItemId: "team-roster",
    featureKey: "staff",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    segment: "onboarding",
    navSubItemId: "team-onboarding",
    featureKey: "staff",
  },
  {
    id: "compliance",
    label: "Compliance",
    segment: "compliance",
    navSubItemId: "team-compliance",
    featureKey: "staff",
  },
  {
    id: "training",
    label: "Training",
    segment: "training",
    navSubItemId: "team-training",
    featureKey: "staff",
  },
  {
    id: "identity",
    label: "Identity & access",
    segment: "identity",
    navSubItemId: "team-identity",
    featureKey: "staff",
  },
] as const;

/** Legacy deep-link routes that must remain live (not redirected). */
export const FI_OS_TEAM_LEGACY_ROUTES = [
  { id: "workforce-os-hub", label: "Workforce hub", suffix: "workforce-os" },
  { id: "hr-os-dashboard", label: "HR dashboard", suffix: "hr-os" },
  { id: "staff-directory-legacy", label: "Staff directory", suffix: "staff" },
  { id: "onboarding-centre", label: "Onboarding", suffix: "hr-os/onboarding" },
  { id: "roster-command-legacy", label: "Roster", suffix: "workforce-os/roster" },
  { id: "compliance-legacy", label: "Compliance", suffix: "hr-os/compliance" },
  { id: "certifications-legacy", label: "Certifications", suffix: "hr-os/certifications" },
  { id: "credentials-legacy", label: "Credentials", suffix: "hr-os/credentials" },
  { id: "academyos", label: "Academy", suffix: "academy" },
] as const;

/** Admin-only legacy routes — omitted from staff More unless admin surfaces are on. */
export const FI_OS_TEAM_ADMIN_LEGACY_ROUTES = [
  {
    id: "staff-identity-audit",
    label: "Identity readiness audit",
    suffix: "workforce-os/staff-identity-audit",
  },
  { id: "staff-access-legacy", label: "Staff access", suffix: "workforce-os/staff-access" },
  { id: "hr-task-map-legacy", label: "Access task map", suffix: "workforce-os/hr-task-map" },
  { id: "hr-os-sync-health", label: "Sync health", suffix: "hr-os/sync-health" },
] as const;

export const FI_OS_TEAM_HIDDEN_MORE_SUB_ITEM_IDS = new Set([
  "staff-identity-audit",
  "staff-access-legacy",
  "hr-task-map-legacy",
  "hr-os-sync-health",
  "roster-command-legacy",
]);

export type BuildTeamSidebarSubItemsOptions = {
  showHrOsNav?: boolean;
  /** When set, overrides showHrOsNav for consolidated tab filtering. */
  visibleTabIds?: readonly FiOsTeamTabId[];
  showTeamAdminSurfaces?: boolean;
};

export function buildFiOsTeamBase(tenantId: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/team`;
}

export function buildFiOsTeamTabHref(tenantId: string, tab: FiOsTeamTab): string {
  const base = buildFiOsTeamBase(tenantId);
  return tab.segment ? `${base}/${tab.segment}` : base;
}

export function buildFiOsTeamLegacyHref(tenantId: string, suffix: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/${suffix.replace(/^\/+/, "")}`;
}

export function isFiOsTeamConsolidatedPath(pathname: string, tenantBase: string): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === `${base}/team` || path.startsWith(`${base}/team/`);
}

export function isTeamTabActive(
  pathname: string,
  tenantBase: string,
  segment: string
): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!segment) {
    return path === `${base}/team` || path === `${base}/team/`;
  }
  return path === `${base}/team/${segment}` || path.startsWith(`${base}/team/${segment}/`);
}

export type FiOsTeamSidebarSubItem = {
  id: string;
  label: string;
  href: string;
  featureKey?: FiFeatureKey;
};

export function buildTeamSidebarSubItems(
  tenantId: string,
  opts?: BuildTeamSidebarSubItemsOptions
): FiOsTeamSidebarSubItem[] {
  const tid = tenantId.trim();
  const showAdmin = opts?.showTeamAdminSurfaces === true;

  const consolidated = FI_OS_TEAM_TABS.filter((tab) => {
    if (opts?.visibleTabIds) {
      return opts.visibleTabIds.includes(tab.id);
    }
    if (tab.id === "overview" || tab.id === "staff") return true;
    return opts?.showHrOsNav === true;
  }).map((tab) => ({
    id: tab.navSubItemId,
    label: tab.label,
    href: buildFiOsTeamTabHref(tid, tab),
    featureKey: tab.featureKey,
  }));

  const legacy = FI_OS_TEAM_LEGACY_ROUTES.map((route) => ({
    id: route.id,
    label: `${route.label} (direct)`,
    href: buildFiOsTeamLegacyHref(tid, route.suffix),
    featureKey: (route.id === "academyos" ? "academy" : "staff") as FiFeatureKey,
  }));

  const adminLegacy = showAdmin
    ? FI_OS_TEAM_ADMIN_LEGACY_ROUTES.map((route) => ({
        id: route.id,
        label: `${route.label} (direct)`,
        href: buildFiOsTeamLegacyHref(tid, route.suffix),
        featureKey: "staff" as const,
      }))
    : [];

  return [...consolidated, ...legacy, ...adminLegacy];
}

const TEAM_MODULE_LANGUAGE_RE =
  /\b(?:hr\s*os|workforce\s*os|identity\s*audit|academy\s*os|access\s*centre|onboarding\s*centre)\b/i;

export function teamSubItemUsesStaffFriendlyLabel(label: string): boolean {
  return !TEAM_MODULE_LANGUAGE_RE.test(label.trim());
}