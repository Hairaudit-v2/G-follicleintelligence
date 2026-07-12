/**
 * FI-UX-REBUILD D6G-A — navigation drift audit (read-only).
 * Compares current FI OS nav composition against 1B workflow domains.
 */

import {
  resolveFiOsMinimalNavItems,
  type FiOsMinimalNavItem,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import {
  resolveFiOsQuickCreateItems,
  type ResolvedFiOsQuickCreateItem,
} from "@/src/lib/fiAdmin/fiOsQuickCreateItems";
import {
  resolveFiOsPrimarySidebarItems,
  type FiOsPrimarySidebarItem,
  type FiOsPrimarySidebarSubItem,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  FI_OS_WORKFLOW_GROUP_LABELS,
  workflowGroupForNavItemId,
  type FiOsWorkflowGroupId,
} from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import {
  FI_OS_D6_INTELLIGENCE_NAV_ENTRIES,
  labelHasLegacyModuleLanguage,
  labelHasOsSuffix,
  resolve1BDomainForNavItem,
  type FiOs1BWorkflowDomain,
} from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";

export const NAVIGATION_DRIFT_CLASSIFICATIONS = [
  "aligned",
  "duplicate_surface",
  "legacy_label",
  "wrong_domain",
  "too_granular_primary",
  "admin_only_should_be_more",
  "route_preserve_but_hide",
  "needs_grouping",
  "unknown",
] as const;

export type NavigationDriftClassification = (typeof NAVIGATION_DRIFT_CLASSIFICATIONS)[number];

export const D6_PRIMARY_RAIL_CANDIDATES = [
  "Today",
  "Calendar",
  "Patients",
  "Team",
  "Reports",
  "More",
] as const;

export type D6PrimaryRailCandidate = (typeof D6_PRIMARY_RAIL_CANDIDATES)[number];

export type D6PrimaryRailPlacement =
  | "primary_rail"
  | "grouped_under_more"
  | "grouped_under_team"
  | "grouped_under_reports"
  | "admin_only"
  | "hidden_route_preserved"
  | "not_applicable";

export type FiOsNavigationItemSource =
  | "primary_sidebar"
  | "primary_sub_item"
  | "minimal_rail"
  | "quick_create"
  | "d6_intelligence";

export type FiOsCollectedNavItem = {
  id: string;
  label: string;
  href: string;
  /** Path after `/fi-admin/[tenantId]/` */
  routeSuffix: string;
  source: FiOsNavigationItemSource;
  parentId?: string;
  workflowGroupId?: FiOsWorkflowGroupId;
  workflowGroupLabel?: string;
  disabled?: boolean;
};

export type NavigationDriftItemReport = {
  item: FiOsCollectedNavItem;
  domain1B: FiOs1BWorkflowDomain | null;
  classification: NavigationDriftClassification;
  d6Placement: D6PrimaryRailPlacement;
  reasons: string[];
};

export type NavigationDriftReport = {
  tenantId: string;
  collectedAt: string;
  items: NavigationDriftItemReport[];
  currentNavItemCount: number;
  duplicateDomains: { domain: FiOs1BWorkflowDomain; itemIds: string[] }[];
  legacyLabels: { id: string; label: string; reasons: string[] }[];
  byDomain1B: Record<FiOs1BWorkflowDomain, FiOsCollectedNavItem[]>;
  workflowGroupDrift: {
    itemId: string;
    label: string;
    workflowGroupId: FiOsWorkflowGroupId;
    domain1B: FiOs1BWorkflowDomain | null;
  }[];
  d6PrimaryRailRecommendation: D6PrimaryRailCandidate[];
  itemsForMore: string[];
  hiddenRoutePreserved: string[];
  riskyChanges: string[];
  directRoutesPreserved: string[];
};

export type NavigationDriftSummary = {
  totalItems: number;
  alignedCount: number;
  driftCount: number;
  byClassification: Record<NavigationDriftClassification, number>;
  primaryRailCount: number;
  exceedsPrimaryRailLimit: boolean;
};

const D6_PRIMARY_RAIL_MINIMAL_SLOT_IDS = new Set([
  "today",
  "calendar",
  "patients",
  "team",
  "reports",
  "more",
]);

/** Primary sidebar nav ids represented on the collapsed six-slot rail. */
const D6_PRIMARY_RAIL_NAV_IDS = new Set([
  "dashboard",
  "calendar",
  "patients",
  "team",
  "reports",
]);

const TOO_GRANULAR_PRIMARY_IDS = new Set([
  "pathology-nav",
]);

const ADMIN_MORE_IDS = new Set([
  "auditos",
  "financial-os",
  "payments-inbox",
  "settings",
  "d6-presence",
  "d6-signal-learning",
  "d6-bake",
  "d6-navigation-audit",
  "pathology-email-routes",
]);

const HIDDEN_PRESERVE_IDS = new Set([
  "procedure-day-board",
  "pathology-email-routes",
  "d6-presence",
  "d6-signal-learning",
  "d6-bake",
  "d6-navigation-audit",
  "surgery-intelligence-dashboard",
]);

const DUPLICATE_SURFACE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["surgery-os", "cases-worklist"],
  ["reception-os", "reception-board"],
  ["patient-twin", "patients"],
];

function normalizeBase(tenantId: string): string {
  return `/fi-admin/${tenantId.trim().replace(/\/+$/, "")}`;
}

function routeSuffixFromHref(base: string, href: string): string {
  const b = base.replace(/\/+$/, "");
  const h = href.trim();
  if (h === b || h === `${b}/`) return "";
  if (!h.startsWith(b)) return h.replace(/^\/+/, "");
  return h.slice(b.length).replace(/^\/+/, "");
}

function sidebarItemToCollected(
  base: string,
  item: FiOsPrimarySidebarItem,
  workspaceProfile: "default" | "clinic_manager" = "default"
): FiOsCollectedNavItem {
  const groupId = workflowGroupForNavItemId(item.id, workspaceProfile);
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    routeSuffix: routeSuffixFromHref(base, item.href),
    source: "primary_sidebar",
    workflowGroupId: groupId,
    workflowGroupLabel: FI_OS_WORKFLOW_GROUP_LABELS[groupId],
    disabled: item.disabled,
  };
}

function subItemToCollected(
  base: string,
  parent: FiOsPrimarySidebarItem,
  sub: FiOsPrimarySidebarSubItem,
  workspaceProfile: "default" | "clinic_manager" = "default"
): FiOsCollectedNavItem {
  const groupId = workflowGroupForNavItemId(parent.id, workspaceProfile);
  return {
    id: sub.id,
    label: sub.label,
    href: sub.href,
    routeSuffix: routeSuffixFromHref(base, sub.href),
    source: "primary_sub_item",
    parentId: parent.id,
    workflowGroupId: groupId,
    workflowGroupLabel: FI_OS_WORKFLOW_GROUP_LABELS[groupId],
  };
}

function minimalItemToCollected(base: string, item: FiOsMinimalNavItem): FiOsCollectedNavItem | null {
  if (item.kind === "action") {
    return {
      id: item.id,
      label: item.label,
      href: "#",
      routeSuffix: "",
      source: "minimal_rail",
    };
  }
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    routeSuffix: routeSuffixFromHref(base, item.href),
    source: "minimal_rail",
    disabled: item.disabled,
  };
}

function quickCreateToCollected(
  base: string,
  item: ResolvedFiOsQuickCreateItem
): FiOsCollectedNavItem {
  const suffix = item.href.startsWith(base)
    ? routeSuffixFromHref(base, item.href)
    : item.href.replace(/^\/+/, "");
  return {
    id: `quick-create-${item.id}`,
    label: item.label,
    href: item.href,
    routeSuffix: suffix,
    source: "quick_create",
    disabled: !item.enabled,
  };
}

export type CollectFiOsNavigationModelOptions = {
  /** Include quick-create palette entries (command palette nav). */
  includeQuickCreate?: boolean;
  /** Workspace profile for workflow group assignment. */
  workspaceProfile?: "default" | "clinic_manager";
};

/**
 * Collects the current FI OS navigation catalog from canonical config sources.
 * Uses permissive visibility flags so the audit sees the full item catalog.
 */
export function collectFiOsCurrentNavigationModel(
  tenantId: string,
  options?: CollectFiOsNavigationModelOptions
): FiOsCollectedNavItem[] {
  const tid = tenantId.trim();
  const base = normalizeBase(tid);
  const profile = options?.workspaceProfile ?? "default";

  const sidebar = resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true
  );

  const items: FiOsCollectedNavItem[] = [];
  for (const row of sidebar) {
    items.push(sidebarItemToCollected(base, row, profile));
    for (const sub of row.subItems ?? []) {
      items.push(subItemToCollected(base, row, sub, profile));
    }
  }

  const minimal = resolveFiOsMinimalNavItems(base, sidebar);
  for (const m of minimal) {
    const collected = minimalItemToCollected(base, m);
    if (collected) items.push(collected);
  }

  for (const d6 of FI_OS_D6_INTELLIGENCE_NAV_ENTRIES) {
    items.push({
      id: d6.id,
      label: d6.label,
      href: `${base}/${d6.routeSuffix}`,
      routeSuffix: d6.routeSuffix,
      source: "d6_intelligence",
      workflowGroupId: "REPORTS",
      workflowGroupLabel: FI_OS_WORKFLOW_GROUP_LABELS.REPORTS,
    });
  }

  if (options?.includeQuickCreate !== false) {
    const quick = resolveFiOsQuickCreateItems(base, true, true);
    for (const q of quick) {
      items.push(quickCreateToCollected(base, q));
    }
  }

  return items;
}

export function mapCurrentNavItemTo1BDomain(item: FiOsCollectedNavItem): FiOs1BWorkflowDomain | null {
  return resolve1BDomainForNavItem({
    id: item.id,
    label: item.label,
    routeSuffix: item.routeSuffix,
  });
}

function workflowGroupExpectsDomain(groupId: FiOsWorkflowGroupId): FiOs1BWorkflowDomain | null {
  switch (groupId) {
    case "FRONT_DESK":
      return "Front Desk";
    case "PIPELINE":
      return "Pipeline";
    case "PATIENTS":
      return "Patients";
    case "CLINICAL":
      return "Clinical";
    case "SURGERY":
      return "Surgery";
    case "FINANCE":
      return "Finance";
    case "REPORTS":
      return "Reports";
    case "TEAM":
      return "Team";
    case "SETTINGS":
      return "Settings";
    default:
      return null;
  }
}

function resolveD6Placement(
  item: FiOsCollectedNavItem,
  domain1B: FiOs1BWorkflowDomain | null
): D6PrimaryRailPlacement {
  if (item.source === "minimal_rail" && D6_PRIMARY_RAIL_MINIMAL_SLOT_IDS.has(item.id)) {
    return "primary_rail";
  }
  if (item.source === "primary_sidebar" && D6_PRIMARY_RAIL_NAV_IDS.has(item.id)) {
    return "primary_rail";
  }
  if (ADMIN_MORE_IDS.has(item.id) || item.source === "d6_intelligence") return "admin_only";
  if (HIDDEN_PRESERVE_IDS.has(item.id)) return "hidden_route_preserved";
  if (domain1B === "Team" || item.workflowGroupId === "TEAM") return "grouped_under_team";
  if (domain1B === "Reports" || item.workflowGroupId === "REPORTS") {
    return "grouped_under_reports";
  }
  if (item.source === "primary_sub_item") return "grouped_under_more";
  return "grouped_under_more";
}

export function classifyNavigationDrift(
  item: FiOsCollectedNavItem,
  allItems: readonly FiOsCollectedNavItem[]
): NavigationDriftItemReport {
  const domain1B = mapCurrentNavItemTo1BDomain(item);
  const reasons: string[] = [];
  let classification: NavigationDriftClassification = "aligned";

  if (labelHasLegacyModuleLanguage(item.label)) {
    classification = "legacy_label";
    reasons.push(`Label "${item.label}" uses module/OS language`);
  }
  if (labelHasOsSuffix(item.label) && classification === "aligned") {
    classification = "legacy_label";
    reasons.push(`Label "${item.label}" contains an OS suffix`);
  }

  const expectedGroupDomain = item.workflowGroupId
    ? workflowGroupExpectsDomain(item.workflowGroupId)
    : null;
  if (
    expectedGroupDomain &&
    domain1B &&
    domain1B !== expectedGroupDomain &&
    !(item.workflowGroupId === "PATIENTS" && domain1B === "Today") &&
    !(item.workflowGroupId === "FRONT_DESK" && domain1B === "Calendar")
  ) {
    if (classification === "aligned") classification = "wrong_domain";
    reasons.push(
      `Mapped to ${domain1B} but drawer group ${item.workflowGroupLabel} implies ${expectedGroupDomain}`
    );
  }

  if (TOO_GRANULAR_PRIMARY_IDS.has(item.id) && item.source === "primary_sidebar") {
    if (classification === "aligned") classification = "too_granular_primary";
    reasons.push("Should be a tab inside a single workflow front door, not a sidebar row");
  }

  if (ADMIN_MORE_IDS.has(item.id)) {
    if (classification === "aligned") classification = "admin_only_should_be_more";
    reasons.push("Admin or operator surface — belongs under More, not primary staff rail");
  }

  if (HIDDEN_PRESERVE_IDS.has(item.id)) {
    if (classification === "aligned") classification = "route_preserve_but_hide";
    reasons.push("Route must stay reachable but should not appear on primary staff nav");
  }

  const hrefCounts = new Map<string, string[]>();
  for (const other of allItems) {
    if (other.href === "#" || !other.href.trim()) continue;
    const list = hrefCounts.get(other.href) ?? [];
    list.push(other.id);
    hrefCounts.set(other.href, list);
  }
  const sameHrefIds = hrefCounts.get(item.href) ?? [];
  if (sameHrefIds.length > 1 && item.source === "primary_sidebar") {
    classification = "duplicate_surface";
    reasons.push(`Shares href with: ${sameHrefIds.filter((id) => id !== item.id).join(", ")}`);
  }

  for (const [a, b] of DUPLICATE_SURFACE_PAIRS) {
    if (item.id === a || item.id === b) {
      const partner = item.id === a ? b : a;
      if (allItems.some((x) => x.id === partner)) {
        classification = "duplicate_surface";
        reasons.push(`Overlaps companion surface "${partner}"`);
      }
    }
  }

  if (!domain1B && classification === "aligned") {
    classification = "unknown";
    reasons.push("No 1B domain mapping");
  }

  const d6Placement = resolveD6Placement(item, domain1B);

  return {
    item,
    domain1B,
    classification,
    d6Placement,
    reasons,
  };
}

export function buildNavigationDriftReport(
  tenantId: string,
  options?: CollectFiOsNavigationModelOptions
): NavigationDriftReport {
  const items = collectFiOsCurrentNavigationModel(tenantId, options);
  const reports = items.map((item) => classifyNavigationDrift(item, items));

  const byDomain1B = {} as Record<FiOs1BWorkflowDomain, FiOsCollectedNavItem[]>;
  for (const domain of [
    "Today",
    "Calendar",
    "Front Desk",
    "Patients",
    "Pipeline",
    "Clinical",
    "Surgery",
    "Finance",
    "Team",
    "Reports",
    "Settings",
  ] as const) {
    byDomain1B[domain] = [];
  }
  for (const r of reports) {
    if (r.domain1B) byDomain1B[r.domain1B].push(r.item);
  }

  const duplicateDomains: NavigationDriftReport["duplicateDomains"] = [];
  for (const [domain, rows] of Object.entries(byDomain1B) as [
    FiOs1BWorkflowDomain,
    FiOsCollectedNavItem[],
  ][]) {
    const primaryIds = rows
      .filter((r) => r.source === "primary_sidebar")
      .map((r) => r.id);
    if (primaryIds.length > 1) {
      duplicateDomains.push({ domain, itemIds: primaryIds });
    }
  }

  const legacyLabels = reports
    .filter((r) => r.classification === "legacy_label" || labelHasLegacyModuleLanguage(r.item.label))
    .map((r) => ({
      id: r.item.id,
      label: r.item.label,
      reasons: r.reasons,
    }));

  const workflowGroupDrift = reports
    .filter(
      (r) =>
        r.item.workflowGroupId &&
        r.domain1B &&
        r.classification === "wrong_domain"
    )
    .map((r) => ({
      itemId: r.item.id,
      label: r.item.label,
      workflowGroupId: r.item.workflowGroupId!,
      domain1B: r.domain1B,
    }));

  const d6PrimaryRailRecommendation: D6PrimaryRailCandidate[] = [...D6_PRIMARY_RAIL_CANDIDATES];

  const itemsForMore = reports
    .filter((r) => r.d6Placement === "grouped_under_more" && r.item.source === "primary_sidebar")
    .map((r) => r.item.id);

  const hiddenRoutePreserved = reports
    .filter((r) => r.d6Placement === "hidden_route_preserved")
    .map((r) => r.item.id);

  const directRoutesPreserved = items
    .filter((i) => i.href !== "#")
    .map((i) => i.href);

  const riskyChanges = [
    "Do not remove Calendar route or minimal-rail Calendar link — calendar internals are out of scope.",
    "Surgery consolidated under /surgery — legacy /surgery-os, /cases, /procedure-day, and /surgery-os/intelligence routes must stay live.",
    "Front desk consolidated under /front-desk — legacy /operations, /reception-os, /reception, /reception-board, /tomorrow routes must stay live.",
    "D6 intelligence routes (/intelligence/*) are admin-only — keep URLs when hiding from staff nav.",
    "Team consolidated under /team — legacy /workforce-os, /hr-os, /staff, and Academy routes must stay live.",
    "Reports consolidated under /reports — legacy /analytics, /audit, /intelligence/*, and surgery review routes must stay live.",
    "Collapsed primary rail is six slots — do not add module-language labels to the rail.",
  ];

  return {
    tenantId: tenantId.trim(),
    collectedAt: new Date().toISOString(),
    items: reports,
    currentNavItemCount: items.length,
    duplicateDomains,
    legacyLabels,
    byDomain1B,
    workflowGroupDrift,
    d6PrimaryRailRecommendation,
    itemsForMore,
    hiddenRoutePreserved,
    riskyChanges,
    directRoutesPreserved,
  };
}

export function summarizeNavigationDrift(report: NavigationDriftReport): NavigationDriftSummary {
  const byClassification = {} as Record<NavigationDriftClassification, number>;
  for (const c of NAVIGATION_DRIFT_CLASSIFICATIONS) {
    byClassification[c] = 0;
  }
  let alignedCount = 0;
  for (const row of report.items) {
    byClassification[row.classification] += 1;
    if (row.classification === "aligned") alignedCount += 1;
  }

  const primaryRailCount = report.items.filter((r) => r.d6Placement === "primary_rail").length;

  return {
    totalItems: report.items.length,
    alignedCount,
    driftCount: report.items.length - alignedCount,
    byClassification,
    primaryRailCount,
    exceedsPrimaryRailLimit: report.d6PrimaryRailRecommendation.length > 6,
  };
}