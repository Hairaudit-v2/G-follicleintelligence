import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

/** Workflow rail groups (UI only; routes unchanged). */
export const FI_OS_WORKFLOW_GROUP_IDS = [
  "HOME",
  "TODAY",
  "PATIENT_JOURNEY",
  "CLINICAL",
  "INTELLIGENCE",
  "TEAM",
  "SYSTEM",
] as const;

export type FiOsWorkflowGroupId = (typeof FI_OS_WORKFLOW_GROUP_IDS)[number];

export const FI_OS_WORKFLOW_GROUP_LABELS: Record<FiOsWorkflowGroupId, string> = {
  HOME: "Home",
  TODAY: "Today",
  PATIENT_JOURNEY: "Patient journey",
  CLINICAL: "Clinical",
  INTELLIGENCE: "Intelligence",
  TEAM: "Team",
  SYSTEM: "System",
};

/** Default workflow bucket per primary nav id (before persona tweaks). */
export const FI_OS_SIDEBAR_ITEM_DEFAULT_GROUP: Record<string, FiOsWorkflowGroupId> = {
  dashboard: "HOME",
  calendar: "TODAY",
  "operations-centre": "TODAY",
  "reception-board": "TODAY",
  "tomorrow-board": "TODAY",
  crm: "PATIENT_JOURNEY",
  "follow-up-queue": "PATIENT_JOURNEY",
  consultations: "PATIENT_JOURNEY",
  patients: "PATIENT_JOURNEY",
  cases: "PATIENT_JOURNEY",
  "doctor-workspace": "CLINICAL",
  prescriptions: "CLINICAL",
  "pathology-nav": "CLINICAL",
  "patient-twin": "INTELLIGENCE",
  auditos: "INTELLIGENCE",
  analytics: "INTELLIGENCE",
  academyos: "TEAM",
  staff: "TEAM",
  settings: "SYSTEM",
};

/** Persona-specific overrides only (never removes access — Stage 2 still filters rows). */
const PROFILE_GROUP_OVERRIDES: Partial<Record<FiWorkspaceProfileKey, Partial<Record<string, FiOsWorkflowGroupId>>>> = {
  surgeon: { "patient-twin": "CLINICAL" },
  doctor: { "patient-twin": "CLINICAL" },
  nurse: { "patient-twin": "CLINICAL" },
};

/** Preferred order of items inside each group (subset may be hidden). */
const GROUP_MEMBER_ORDER: Record<FiOsWorkflowGroupId, readonly string[]> = {
  HOME: ["dashboard"],
  TODAY: ["calendar", "operations-centre", "reception-board", "tomorrow-board"],
  PATIENT_JOURNEY: ["crm", "follow-up-queue", "consultations", "patients", "cases"],
  CLINICAL: ["doctor-workspace", "prescriptions", "pathology-nav", "patient-twin"],
  INTELLIGENCE: ["patient-twin", "auditos", "analytics"],
  TEAM: ["academyos", "staff"],
  SYSTEM: ["settings"],
};

export function workflowGroupForNavItemId(
  itemId: string,
  workspaceProfile: FiWorkspaceProfileKey | null | undefined
): FiOsWorkflowGroupId {
  const p = workspaceProfile && isFiWorkspaceProfileKey(workspaceProfile) ? workspaceProfile : "default";
  const override = PROFILE_GROUP_OVERRIDES[p]?.[itemId];
  if (override) return override;
  return FI_OS_SIDEBAR_ITEM_DEFAULT_GROUP[itemId] ?? "INTELLIGENCE";
}

/**
 * Reorders workflow groups for sidebar emphasis (Stage UI activation).
 * Feature access still removes individual rows; empty groups are dropped later.
 */
export function orderedWorkflowGroupsForWorkspace(workspaceProfile: FiWorkspaceProfileKey | null | undefined): FiOsWorkflowGroupId[] {
  const p = workspaceProfile && isFiWorkspaceProfileKey(workspaceProfile) ? workspaceProfile : "default";
  const base = [...FI_OS_WORKFLOW_GROUP_IDS];
  let ordered: FiOsWorkflowGroupId[];
  switch (p) {
    case "consultant":
      ordered = ["HOME", "PATIENT_JOURNEY", "TODAY", "CLINICAL", "INTELLIGENCE", "TEAM", "SYSTEM"];
      break;
    case "surgeon":
      ordered = ["HOME", "CLINICAL", "TODAY", "PATIENT_JOURNEY", "INTELLIGENCE", "TEAM", "SYSTEM"];
      break;
    case "doctor":
      ordered = ["HOME", "CLINICAL", "TODAY", "PATIENT_JOURNEY", "INTELLIGENCE", "TEAM", "SYSTEM"];
      break;
    case "nurse":
      ordered = ["HOME", "TODAY", "CLINICAL", "PATIENT_JOURNEY", "INTELLIGENCE", "TEAM", "SYSTEM"];
      break;
    case "reception":
      ordered = ["HOME", "TODAY", "PATIENT_JOURNEY", "CLINICAL", "INTELLIGENCE", "TEAM", "SYSTEM"];
      break;
    case "director":
    case "platform_admin":
      ordered = ["HOME", "INTELLIGENCE", "TODAY", "PATIENT_JOURNEY", "CLINICAL", "TEAM", "SYSTEM"];
      break;
    case "clinic_manager":
      ordered = ["HOME", "TODAY", "INTELLIGENCE", "PATIENT_JOURNEY", "CLINICAL", "TEAM", "SYSTEM"];
      break;
    default:
      ordered = base;
      break;
  }
  return ordered.filter((g, i) => ordered.indexOf(g) === i);
}

export type FiOsSidebarWorkflowSection = {
  groupId: FiOsWorkflowGroupId;
  title: string;
  items: FiOsPrimarySidebarItem[];
};

function sortItemsByGroupOrder(groupId: FiOsWorkflowGroupId, items: FiOsPrimarySidebarItem[]): FiOsPrimarySidebarItem[] {
  const order = GROUP_MEMBER_ORDER[groupId];
  const idx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? 999 : i;
  };
  return [...items].sort((a, b) => idx(a.id) - idx(b.id) || a.label.localeCompare(b.label));
}

/**
 * Groups filtered sidebar items into workflow sections; omits sections with zero visible rows.
 */
export function buildFiOsSidebarWorkflowSections(
  items: FiOsPrimarySidebarItem[],
  workspaceProfile: FiWorkspaceProfileKey | null | undefined
): FiOsSidebarWorkflowSection[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  const groupOrder = orderedWorkflowGroupsForWorkspace(workspaceProfile);
  const out: FiOsSidebarWorkflowSection[] = [];

  for (const groupId of groupOrder) {
    const bucket: FiOsPrimarySidebarItem[] = [];
    for (const it of items) {
      if (workflowGroupForNavItemId(it.id, workspaceProfile) !== groupId) continue;
      if (!byId.has(it.id)) continue;
      bucket.push(it);
    }
    const sorted = sortItemsByGroupOrder(groupId, bucket);
    if (sorted.length === 0) continue;
    out.push({ groupId, title: FI_OS_WORKFLOW_GROUP_LABELS[groupId], items: sorted });
  }
  return out;
}
