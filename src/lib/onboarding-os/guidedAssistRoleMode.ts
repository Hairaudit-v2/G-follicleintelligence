/**
 * Warm role-mode labels + clinical prioritisation for Clinic guide tips.
 * Tone: helpful colleague navigating a new system — never clinical advice.
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

import type {
  GuidedAssistRoleGroup,
  GuidedAssistTipDefinition,
  GuidedAssistTodayRoleKey,
} from "./guidedAssistTypes";

export function resolveTipRoleGroup(tip: Pick<GuidedAssistTipDefinition, "roleGroup">): GuidedAssistRoleGroup {
  return tip.roleGroup ?? "core";
}

/** Clinical day-to-day profiles: doctor, surgeon, nurse, consultant. */
export function isClinicalWorkspaceProfile(
  workspaceProfileKey: FiWorkspaceProfileKey | null | undefined
): boolean {
  const p = String(workspaceProfileKey ?? "")
    .trim()
    .toLowerCase();
  return p === "doctor" || p === "surgeon" || p === "nurse" || p === "consultant";
}

export function isClinicalTodayRole(role: GuidedAssistTodayRoleKey | null | undefined): boolean {
  return role === "doctor" || role === "nurse" || role === "consultant";
}

/**
 * Sort weight for tip lists (lower = show first).
 * Clinical viewers: clinical → core → support.
 * Everyone else: core/support share the same band (then catalog priority),
 * with specialised clinical depth last so day-of desk tips stay on top.
 */
export function roleGroupSortWeight(
  tip: Pick<GuidedAssistTipDefinition, "roleGroup">,
  preferClinical: boolean
): number {
  const g = resolveTipRoleGroup(tip);
  if (preferClinical) {
    if (g === "clinical") return 0;
    if (g === "core") return 1;
    return 2; // support
  }
  if (g === "clinical") return 2;
  return 0; // core + support — rank by tip.priority next
}

export function compareTipsByRoleGroupAndPriority(
  a: GuidedAssistTipDefinition,
  b: GuidedAssistTipDefinition,
  preferClinical: boolean
): number {
  const wa = roleGroupSortWeight(a, preferClinical);
  const wb = roleGroupSortWeight(b, preferClinical);
  if (wa !== wb) return wa - wb;
  return a.priority - b.priority || a.code.localeCompare(b.code);
}

/**
 * Short, warm mode line for the widget header.
 * Mentions navigating the system; never diagnoses or advises treatment.
 */
export function buildGuidedAssistRoleModeLabel(input: {
  todayRole: GuidedAssistTodayRoleKey;
  workspaceProfileKey?: FiWorkspaceProfileKey | null;
  tenantAdminRole?: FiTenantAdminRole | null;
  assistEnabled?: boolean;
}): string {
  const role = input.todayRole;
  switch (role) {
    case "doctor":
      return "Doctor Mode — here to help with patient flow today";
    case "nurse":
      return "Nurse Mode — here to help you move smoothly through the day";
    case "consultant":
      return "Consultant Mode — let’s keep enquiries and consults on track";
    case "reception":
      return "Front desk Mode — let’s keep today’s board calm and clear";
    case "finance":
      return "Finance Mode — here to help you navigate Money with confidence";
    case "admin":
      return "Admin Mode — setup, team, and day-of ops, one step at a time";
    default:
      return "Clinic guide — a friendly hand while you learn the system";
  }
}

/** Expanded panel intro line (optional detail under the mode label). */
export function buildGuidedAssistWarmIntro(input: {
  todayRole: GuidedAssistTodayRoleKey;
  isOnboardingPhase: boolean;
}): string {
  if (input.isOnboardingPhase) {
    return "No worries if this is new — we’ll point you to the next operational step only. Never clinical advice.";
  }
  if (isClinicalTodayRole(input.todayRole)) {
    return "You’re not alone in this system. These tips help with navigation, forms, imaging links, and prep — your clinical judgement stays yours.";
  }
  return "Think of this as a helpful colleague beside you — short steps to work faster, with no clinical advice.";
}
