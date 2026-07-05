/**
 * FI-UX-REBUILD D6G-B — 1B-aligned navigation regrouping (routes preserved).
 */

import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { FI_OS_D6_INTELLIGENCE_NAV_ENTRIES } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";
import { FI_OS_SURGERY_HIDDEN_MORE_SUB_ITEM_IDS } from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";
import { FI_OS_TEAM_HIDDEN_MORE_SUB_ITEM_IDS } from "@/src/lib/fiOs/team/teamWorkspaceCore";

/** Six-slot collapsed primary rail link ids (More is an action). */
export const FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS = [
  "today",
  "calendar",
  "patients",
  "team",
  "reports",
  "more",
] as const;

export type FiOsD6gPrimaryRailSlotId = (typeof FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS)[number];

/** Primary sidebar nav ids represented on the collapsed rail. */
export const FI_OS_D6G_PRIMARY_RAIL_NAV_IDS = new Set([
  "dashboard",
  "calendar",
  "patients",
  "team",
  "analytics",
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
  patients: "PATIENTS",
  "patient-twin": "PATIENTS",
  crm: "PIPELINE",
  "follow-up-queue": "PIPELINE",
  consultations: "PIPELINE",
  surgery: "SURGERY",
  cases: "SURGERY",
  "surgery-os": "SURGERY",
  "doctor-workspace": "CLINICAL",
  prescriptions: "CLINICAL",
  "pathology-nav": "CLINICAL",
  "payments-inbox": "FINANCE",
  "financial-os": "FINANCE",
  analytics: "REPORTS",
  auditos: "REPORTS",
  "d6-presence": "REPORTS",
  "d6-signal-learning": "REPORTS",
  "d6-bake": "REPORTS",
  "d6-navigation-audit": "REPORTS",
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
  "front-desk-reception-operations": "FRONT_DESK",
  "front-desk-clinic-flow": "FRONT_DESK",
  "front-desk-reception-board": "FRONT_DESK",
  "front-desk-tomorrow": "FRONT_DESK",
  "team-overview": "TEAM",
  "team-staff": "TEAM",
  "team-roster": "TEAM",
  "team-onboarding": "TEAM",
  "team-compliance": "TEAM",
  "team-training": "TEAM",
  "team-identity": "TEAM",
};

/** Sub-items hidden from More drawer (routes remain live). */
export const FI_OS_HIDDEN_MORE_SUB_ITEM_IDS = new Set([
  "pathology-email-routes",
  ...FI_OS_SURGERY_HIDDEN_MORE_SUB_ITEM_IDS,
  ...FI_OS_TEAM_HIDDEN_MORE_SUB_ITEM_IDS,
]);

/** D6 admin route ids — shown in Reports when admin surfaces are allowed. */
export const FI_OS_D6_ADMIN_MORE_NAV_IDS = new Set(
  FI_OS_D6_INTELLIGENCE_NAV_ENTRIES.map((e) => e.id)
);

const GROUP_MEMBER_ORDER: Record<FiOsD6gWorkflowGroupId, readonly string[]> = {
  FRONT_DESK: ["front-desk"],
  PIPELINE: ["crm", "follow-up-queue", "consultations"],
  PATIENTS: ["patient-twin"],
  CLINICAL: ["doctor-workspace", "prescriptions", "pathology-nav"],
  SURGERY: ["surgery"],
  FINANCE: ["payments-inbox", "financial-os"],
  REPORTS: ["analytics", "auditos", "d6-presence", "d6-signal-learning", "d6-bake", "d6-navigation-audit"],
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
  return FI_OS_D6G_SIDEBAR_ITEM_GROUP[itemId.trim()] ?? "SETTINGS";
}

export function orderedD6gWorkflowGroups(
  workspaceProfile: string | null | undefined
): FiOsD6gWorkflowGroupId[] {
  const p = workspaceProfile?.trim() || "default";
  switch (p) {
    case "reception":
      return ["FRONT_DESK", "PIPELINE", "PATIENTS", "CLINICAL", "SURGERY", "TEAM", "FINANCE", "REPORTS", "SETTINGS"];
    case "surgeon":
    case "doctor":
      return ["SURGERY", "CLINICAL", "FRONT_DESK", "PIPELINE", "PATIENTS", "TEAM", "FINANCE", "REPORTS", "SETTINGS"];
    case "consultant":
      return ["PIPELINE", "PATIENTS", "CLINICAL", "FRONT_DESK", "SURGERY", "TEAM", "FINANCE", "REPORTS", "SETTINGS"];
    case "director":
    case "platform_admin":
    case "clinic_manager":
      return ["REPORTS", "FRONT_DESK", "PIPELINE", "SURGERY", "CLINICAL", "PATIENTS", "TEAM", "FINANCE", "SETTINGS"];
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

export function filterSubItemsForMoreDrawer(
  item: FiOsPrimarySidebarItem,
  opts: {
    showProcedureDayNav?: boolean;
    showNavigationAdminSurfaces?: boolean;
    showSurgeryAdminSurfaces?: boolean;
    showTeamAdminSurfaces?: boolean;
  }
): FiOsPrimarySidebarItem {
  const subs = item.subItems;
  if (!subs?.length) return item;

  const filtered = subs.filter((sub) => {
    if (FI_OS_HIDDEN_MORE_SUB_ITEM_IDS.has(sub.id)) {
      if (sub.id === "procedure-day-board" && opts.showProcedureDayNav) return true;
      if (
        (sub.id === "surgery-intelligence-dashboard" || sub.id === "graft-counting-legacy") &&
        opts.showSurgeryAdminSurfaces
      ) {
        return true;
      }
      if (
        (sub.id === "staff-identity-audit" ||
          sub.id === "staff-access-legacy" ||
          sub.id === "hr-task-map-legacy" ||
          sub.id === "hr-os-sync-health") &&
        opts.showTeamAdminSurfaces
      ) {
        return true;
      }
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
    case "team":
      return sidebarItems.find((i) => i.id === "team") ?? null;
    case "reports":
      return sidebarItems.find((i) => i.id === "analytics") ?? null;
    default:
      return null;
  }
}