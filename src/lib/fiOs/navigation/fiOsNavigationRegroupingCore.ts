/**
 * FI-UX-REBUILD D6G-B — 1B-aligned navigation regrouping (routes preserved).
 */

import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { FI_OS_D6_INTELLIGENCE_NAV_ENTRIES } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";
import { FI_OS_FRONT_DESK_LEGACY_ROUTES } from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import { FI_OS_SURGERY_HIDDEN_MORE_SUB_ITEM_IDS } from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";
import { FI_OS_SURGERY_LEGACY_ROUTES } from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";
import { FI_OS_REPORTS_HIDDEN_MORE_SUB_ITEM_IDS } from "@/src/lib/fiOs/reports/reportsWorkspaceCore";
import { FI_OS_REPORTS_LEGACY_ROUTES } from "@/src/lib/fiOs/reports/reportsWorkspaceCore";
import { FI_OS_SETTINGS_HIDDEN_MORE_SUB_ITEM_IDS } from "@/src/lib/fiOs/settings/settingsWorkspaceCore";
import { FI_OS_TEAM_HIDDEN_MORE_SUB_ITEM_IDS } from "@/src/lib/fiOs/team/teamWorkspaceCore";
import { FI_OS_TEAM_LEGACY_ROUTES } from "@/src/lib/fiOs/team/teamWorkspaceCore";

/**
 * Six-slot collapsed primary rail link ids (More is an action).
 * FI-TRUST-LANDING-AND-SPINE-1: Front desk on rail for frontline day work;
 * Reports moves to More only (still linked from Reports hub).
 */
export const FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS = [
  "today",
  "calendar",
  "patients",
  "front-desk",
  "team",
  "more",
] as const;

export type FiOsD6gPrimaryRailSlotId = (typeof FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS)[number];

/** Primary sidebar nav ids represented on the collapsed rail. */
export const FI_OS_D6G_PRIMARY_RAIL_NAV_IDS = new Set([
  "dashboard",
  "calendar",
  "patients",
  "front-desk",
  "team",
]);

/** 1B workflow sections for the All areas / More drawer (no module-language buckets). */
export const FI_OS_D6G_WORKFLOW_GROUP_IDS = [
  "FRONT_DESK",
  "PIPELINE",
  "PATIENTS",
  "CLINICAL",
  "SURGERY",
  "FINANCE",
  "REPORTS",
  "TEAM",
  "SETTINGS",
] as const;

export type FiOsD6gWorkflowGroupId = (typeof FI_OS_D6G_WORKFLOW_GROUP_IDS)[number];

export const FI_OS_D6G_WORKFLOW_GROUP_LABELS: Record<FiOsD6gWorkflowGroupId, string> = {
  FRONT_DESK: "Front desk",
  PIPELINE: "Pipeline",
  PATIENTS: "Patients",
  CLINICAL: "Clinical",
  SURGERY: "Surgery",
  FINANCE: "Finance",
  REPORTS: "Reports",
  TEAM: "Team",
  SETTINGS: "Settings",
};

/** Default 1B drawer bucket per primary nav id. */
export const FI_OS_D6G_SIDEBAR_ITEM_GROUP: Record<string, FiOsD6gWorkflowGroupId> = {
  dashboard: "PATIENTS",
  calendar: "FRONT_DESK",
  "front-desk": "FRONT_DESK",
  "operations-centre": "FRONT_DESK",
  "reception-os": "FRONT_DESK",
  "reception-board": "FRONT_DESK",
  "reception-board-command": "FRONT_DESK",
  "tomorrow-board": "FRONT_DESK",
  "pilot-control": "FRONT_DESK",
  patients: "PATIENTS",
  "patient-twin": "PATIENTS",
  crm: "PIPELINE",
  consultations: "CLINICAL",
  surgery: "SURGERY",
  cases: "SURGERY",
  "surgery-os": "SURGERY",
  "doctor-workspace": "CLINICAL",
  prescriptions: "CLINICAL",
  "pathology-nav": "CLINICAL",
  "payments-inbox": "FINANCE",
  "financial-os": "FINANCE",
  reports: "REPORTS",
  analytics: "REPORTS",
  auditos: "REPORTS",
  "analytics-legacy": "REPORTS",
  "auditos-legacy": "REPORTS",
  "insights-legacy": "REPORTS",
  "financial-os-legacy": "REPORTS",
  "payments-inbox-legacy": "REPORTS",
  "d6-presence": "SETTINGS",
  "d6-signal-learning": "SETTINGS",
  "d6-bake": "SETTINGS",
  "d6-navigation-audit": "SETTINGS",
  team: "TEAM",
  academyos: "TEAM",
  staff: "TEAM",
  "onboarding-centre": "TEAM",
  "hr-os": "TEAM",
  "workforce-os-hub": "TEAM",
  "hr-os-dashboard": "TEAM",
  "staff-directory-legacy": "TEAM",
  "roster-command-legacy": "TEAM",
  "compliance-legacy": "TEAM",
  "certifications-legacy": "TEAM",
  "credentials-legacy": "TEAM",
  "staff-identity-audit": "TEAM",
  "staff-access-legacy": "TEAM",
  "hr-task-map-legacy": "TEAM",
  "hr-os-sync-health": "TEAM",
  settings: "SETTINGS",
};

/** Sub-item ids grouped with their workflow section (parent may be on primary rail). */
export const FI_OS_D6G_SUB_ITEM_GROUP: Record<string, FiOsD6gWorkflowGroupId> = {
  "leadflow-dashboard": "PIPELINE",
  "crm-workspace": "PIPELINE",
  "consultation-conversion-board": "PIPELINE",
  "cases-worklist": "SURGERY",
  "surgery-os-command-centre": "SURGERY",
  "surgery-readiness-board": "SURGERY",
  "procedure-day-board": "SURGERY",
  "surgery-intelligence-dashboard": "SURGERY",
  "graft-counting-legacy": "SURGERY",
  "surgery-command": "SURGERY",
  "surgery-cases": "SURGERY",
  "surgery-procedure-day": "SURGERY",
  "surgery-review": "SURGERY",
  "pathology-inbox": "CLINICAL",
  "pathology-email-routes": "SETTINGS",
  "front-desk-today": "FRONT_DESK",
  "front-desk-tomorrow": "FRONT_DESK",
  "front-desk-messages": "FRONT_DESK",
  "front-desk-reception-operations": "FRONT_DESK",
  "front-desk-clinic-flow": "FRONT_DESK",
  "front-desk-reception-board": "FRONT_DESK",
  "team-overview": "TEAM",
  "team-staff": "TEAM",
  "team-roster": "TEAM",
  "team-onboarding": "TEAM",
  "team-compliance": "TEAM",
  "team-training": "TEAM",
  "team-identity": "TEAM",
  "reports-overview": "REPORTS",
  "reports-analytics": "REPORTS",
  "reports-quality": "REPORTS",
  "reports-surgery": "REPORTS",
  "reports-performance": "REPORTS",
  "reports-admin": "REPORTS",
};

/** S4.5E — legacy pipeline routes redirect to /crm; hidden from staff More drawer until S11 retirement. */
export const FI_OS_PIPELINE_LEGACY_MORE_SUB_ITEM_IDS = new Set([
  "leadflow-dashboard",
  "crm-workspace",
  "consultation-conversion-board",
]);

/** Sub-items hidden from More drawer (routes remain live). */
export const FI_OS_HIDDEN_MORE_SUB_ITEM_IDS = new Set([
  "pathology-email-routes",
  ...FI_OS_PIPELINE_LEGACY_MORE_SUB_ITEM_IDS,
  ...FI_OS_SURGERY_HIDDEN_MORE_SUB_ITEM_IDS,
  ...FI_OS_TEAM_HIDDEN_MORE_SUB_ITEM_IDS,
  ...FI_OS_REPORTS_HIDDEN_MORE_SUB_ITEM_IDS,
  ...FI_OS_SETTINGS_HIDDEN_MORE_SUB_ITEM_IDS,
]);

/** Legacy deep-link sub-item ids — hidden from staff More drawer; admin may see them. */
export const FI_OS_LEGACY_MORE_SUB_ITEM_IDS: ReadonlySet<string> = new Set([
  ...FI_OS_FRONT_DESK_LEGACY_ROUTES.map((r) => r.id),
  ...FI_OS_SURGERY_LEGACY_ROUTES.map((r) => r.id),
  ...FI_OS_TEAM_LEGACY_ROUTES.map((r) => r.id),
  ...FI_OS_REPORTS_LEGACY_ROUTES.map((r) => r.id),
]);

/** Staff-facing More drawer labels that expose legacy module/direct surfaces. */
const FI_OS_STAFF_HIDDEN_MORE_DRAWER_LABEL_RE =
  /\b(direct|engine|signal learning|intelligence validation|navigation drift audit|navigation audit|priority tuning|arrival confirmation|surgery insights|graft count review|identity audit|identity readiness)\b/i;

export function isStaffHiddenMoreDrawerLabel(label: string): boolean {
  return FI_OS_STAFF_HIDDEN_MORE_DRAWER_LABEL_RE.test(label.trim());
}

export function moreDrawerAdminSurfacesEnabled(opts: {
  showNavigationAdminSurfaces?: boolean;
  showSurgeryAdminSurfaces?: boolean;
  showTeamAdminSurfaces?: boolean;
  showReportsAdminSurfaces?: boolean;
  showSettingsAdminSurfaces?: boolean;
}): boolean {
  return (
    opts.showNavigationAdminSurfaces === true ||
    opts.showSurgeryAdminSurfaces === true ||
    opts.showTeamAdminSurfaces === true ||
    opts.showReportsAdminSurfaces === true ||
    opts.showSettingsAdminSurfaces === true
  );
}

/** D6 admin route ids — shown in Reports when admin surfaces are allowed. */
export const FI_OS_D6_ADMIN_MORE_NAV_IDS = new Set(
  FI_OS_D6_INTELLIGENCE_NAV_ENTRIES.map((e) => e.id)
);

const GROUP_MEMBER_ORDER: Record<FiOsD6gWorkflowGroupId, readonly string[]> = {
  FRONT_DESK: ["front-desk"],
  PIPELINE: ["crm"],
  PATIENTS: ["patient-twin"],
  CLINICAL: ["doctor-workspace", "consultations", "prescriptions", "pathology-nav"],
  SURGERY: ["surgery"],
  /** Money is the single finance door; Take payment is a sub-link when payments enabled. */
  FINANCE: ["financial-os", "payments-inbox"],
  REPORTS: ["reports"],
  TEAM: ["team"],
  SETTINGS: ["settings"],
};

export function isPrimaryRailNavId(navId: string): boolean {
  return FI_OS_D6G_PRIMARY_RAIL_NAV_IDS.has(navId.trim());
}

export function workflowGroupForD6gNavItemId(
  itemId: string,
  subItemId?: string | null
): FiOsD6gWorkflowGroupId {
  const sub = subItemId?.trim();
  if (sub && FI_OS_D6G_SUB_ITEM_GROUP[sub]) {
    return FI_OS_D6G_SUB_ITEM_GROUP[sub];
  }
  const id = itemId.trim();
  if (FI_OS_D6G_SIDEBAR_ITEM_GROUP[id]) {
    return FI_OS_D6G_SIDEBAR_ITEM_GROUP[id];
  }
  if (FI_OS_D6G_SUB_ITEM_GROUP[id]) {
    return FI_OS_D6G_SUB_ITEM_GROUP[id];
  }
  return "SETTINGS";
}

export function orderedD6gWorkflowGroups(
  workspaceProfile: string | null | undefined
): FiOsD6gWorkflowGroupId[] {
  const p = workspaceProfile?.trim() || "default";
  switch (p) {
    case "reception":
      return [
        "FRONT_DESK",
        "PIPELINE",
        "PATIENTS",
        "CLINICAL",
        "SURGERY",
        "TEAM",
        "FINANCE",
        "REPORTS",
        "SETTINGS",
      ];
    case "surgeon":
    case "doctor":
      return [
        "SURGERY",
        "CLINICAL",
        "FRONT_DESK",
        "PIPELINE",
        "PATIENTS",
        "TEAM",
        "FINANCE",
        "REPORTS",
        "SETTINGS",
      ];
    case "consultant":
      return [
        "PIPELINE",
        "PATIENTS",
        "CLINICAL",
        "FRONT_DESK",
        "SURGERY",
        "TEAM",
        "FINANCE",
        "REPORTS",
        "SETTINGS",
      ];
    case "director":
    case "platform_admin":
    case "clinic_manager":
      return [
        "REPORTS",
        "FRONT_DESK",
        "PIPELINE",
        "SURGERY",
        "CLINICAL",
        "PATIENTS",
        "TEAM",
        "FINANCE",
        "SETTINGS",
      ];
    default:
      return [...FI_OS_D6G_WORKFLOW_GROUP_IDS];
  }
}

export function sortNavItemsForD6gGroup(
  groupId: FiOsD6gWorkflowGroupId,
  items: FiOsPrimarySidebarItem[]
): FiOsPrimarySidebarItem[] {
  const order = GROUP_MEMBER_ORDER[groupId];
  const idx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? 999 : i;
  };
  return [...items].sort((a, b) => idx(a.id) - idx(b.id) || a.label.localeCompare(b.label));
}

function shouldShowHiddenMoreSubItem(
  subId: string,
  opts: {
    showProcedureDayNav?: boolean;
    showNavigationAdminSurfaces?: boolean;
    showSurgeryAdminSurfaces?: boolean;
    showTeamAdminSurfaces?: boolean;
    showReportsAdminSurfaces?: boolean;
    showSettingsAdminSurfaces?: boolean;
  }
): boolean {
  if (subId === "procedure-day-board" && opts.showProcedureDayNav) return true;
  if (
    (subId === "surgery-intelligence-dashboard" || subId === "graft-counting-legacy") &&
    (opts.showSurgeryAdminSurfaces || opts.showReportsAdminSurfaces)
  ) {
    return true;
  }
  if (
    (subId === "staff-identity-audit" ||
      subId === "staff-access-legacy" ||
      subId === "hr-task-map-legacy" ||
      subId === "hr-os-sync-health") &&
    opts.showTeamAdminSurfaces
  ) {
    return true;
  }
  if (subId === "reports-admin" && opts.showReportsAdminSurfaces) {
    return true;
  }
  if (
    (subId === "d6-presence" ||
      subId === "d6-signal-learning" ||
      subId === "d6-bake" ||
      subId === "d6-navigation-audit") &&
    (opts.showReportsAdminSurfaces ||
      opts.showNavigationAdminSurfaces ||
      opts.showSettingsAdminSurfaces)
  ) {
    return true;
  }
  return false;
}

export function filterSubItemsForMoreDrawer(
  item: FiOsPrimarySidebarItem,
  opts: {
    showProcedureDayNav?: boolean;
    showNavigationAdminSurfaces?: boolean;
    showSurgeryAdminSurfaces?: boolean;
    showTeamAdminSurfaces?: boolean;
    showReportsAdminSurfaces?: boolean;
    showSettingsAdminSurfaces?: boolean;
  }
): FiOsPrimarySidebarItem {
  const subs = item.subItems;
  if (!subs?.length) return item;

  const adminSurfaces = moreDrawerAdminSurfacesEnabled(opts);

  const filtered = subs.filter((sub) => {
    if (FI_OS_HIDDEN_MORE_SUB_ITEM_IDS.has(sub.id)) {
      return shouldShowHiddenMoreSubItem(sub.id, opts);
    }
    if (FI_OS_LEGACY_MORE_SUB_ITEM_IDS.has(sub.id)) {
      return adminSurfaces;
    }
    if (!adminSurfaces && isStaffHiddenMoreDrawerLabel(sub.label)) {
      return false;
    }
    if (sub.id === "surgery-procedure-day" && !opts.showProcedureDayNav) return false;
    return true;
  });

  if (filtered.length === subs.length) return item;
  return { ...item, subItems: filtered.length ? filtered : undefined };
}

export function buildD6AdminSidebarItems(base: string): FiOsPrimarySidebarItem[] {
  const b = base.replace(/\/+$/, "") || "";
  return FI_OS_D6_INTELLIGENCE_NAV_ENTRIES.map((entry) => ({
    id: entry.id,
    label: entry.label.replace(/D6 intelligence bake/i, "Intelligence validation"),
    shortLabel: entry.label.slice(0, 6),
    href: `${b}/${entry.routeSuffix}`,
    disabled: false,
  }));
}

export function resolvePrimaryRailSidebarTarget(
  slotId: FiOsD6gPrimaryRailSlotId,
  sidebarItems: readonly FiOsPrimarySidebarItem[]
): FiOsPrimarySidebarItem | null {
  switch (slotId) {
    case "today":
      return sidebarItems.find((i) => i.id === "dashboard") ?? null;
    case "calendar":
      return sidebarItems.find((i) => i.id === "calendar") ?? null;
    case "patients":
      return sidebarItems.find((i) => i.id === "patients") ?? null;
    case "front-desk":
      return sidebarItems.find((i) => i.id === "front-desk") ?? null;
    case "team":
      return sidebarItems.find((i) => i.id === "team") ?? null;
    default:
      return null;
  }
}
