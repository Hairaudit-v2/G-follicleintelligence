import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";

/** Workspace personas that may see the `staff_intelligence_summary` home widget (Stage 3.75). */
export const FI_STAFF_INTELLIGENCE_HOME_WIDGET_PROFILES: readonly FiWorkspaceProfileKey[] = [
  "director",
  "clinic_manager",
  "platform_admin",
];

const WIDGET_PROFILE_SET = new Set<string>(FI_STAFF_INTELLIGENCE_HOME_WIDGET_PROFILES);

export function isStaffIntelligenceHomeWidgetAllowedForWorkspace(profile: FiWorkspaceProfileKey | null | undefined): boolean {
  if (!profile) return false;
  return WIDGET_PROFILE_SET.has(profile);
}
