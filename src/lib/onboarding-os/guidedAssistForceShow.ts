/**
 * Session force-show + debug query helpers for Clinic guide troubleshooting.
 * Cookie is browser-session scoped (no durable preference change).
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

import { isClinicalTodayRole } from "./guidedAssistRoleMode";
import type {
  GuidedAssistDebugInfo,
  GuidedAssistExperienceLevel,
  GuidedAssistRoleGroup,
  GuidedAssistTodayRoleKey,
} from "./guidedAssistTypes";

/** Cookie name — value is tenant UUID when force-show is on. */
export const GUIDED_ASSIST_FORCE_SHOW_COOKIE = "fi_guided_assist_force";

/** Query value for `?debug=guide` (admin troubleshooting). */
export const GUIDED_ASSIST_DEBUG_QUERY_VALUE = "guide";

/** Max age for force-show cookie (8 hours) — clears when browser ends sooner. */
export const GUIDED_ASSIST_FORCE_SHOW_MAX_AGE_SEC = 8 * 60 * 60;

export function isGuidedAssistForceShowCookieActive(
  cookieValue: string | null | undefined,
  tenantId: string
): boolean {
  const raw = String(cookieValue ?? "").trim().toLowerCase();
  const tid = tenantId.trim().toLowerCase();
  if (!raw || !tid) return false;
  return raw === tid || raw === "1" || raw === "true";
}

/** True when search string / query contains debug=guide. */
export function isGuidedAssistDebugQueryActive(
  searchOrQuery: string | null | undefined
): boolean {
  const s = String(searchOrQuery ?? "").trim();
  if (!s) return false;
  try {
    const q = s.startsWith("?") ? s.slice(1) : s.includes("=") || s.includes("&") ? s : "";
    if (q) {
      const params = new URLSearchParams(q);
      if (params.get("debug")?.trim().toLowerCase() === GUIDED_ASSIST_DEBUG_QUERY_VALUE) {
        return true;
      }
    }
  } catch {
    /* fall through */
  }
  return /(?:^|[?&])debug=guide(?:&|$)/i.test(s);
}

export function resolveViewerRoleGroup(
  todayRole: GuidedAssistTodayRoleKey
): GuidedAssistRoleGroup {
  if (isClinicalTodayRole(todayRole)) return "clinical";
  if (todayRole === "finance" || todayRole === "reception" || todayRole === "admin") {
    return "support";
  }
  return "core";
}

export function buildGuidedAssistDebugInfo(input: {
  assistEnabled: boolean;
  userAssistOverride: boolean | null;
  forceShowActive: boolean;
  todayHomeViews: number;
  todayRole: GuidedAssistTodayRoleKey;
  roleModeLabel: string | null;
  experienceLevel: GuidedAssistExperienceLevel;
  isOnboardingPhase: boolean;
  pageKey: string;
  workspaceProfileKey: FiWorkspaceProfileKey | string;
  tenantAdminRole: FiTenantAdminRole | string | null;
  roleFirstActive: boolean;
  tipCount: number;
  nextBestActionCount: number;
}): GuidedAssistDebugInfo {
  const guideVisible = input.assistEnabled || input.forceShowActive;
  return {
    enabled: input.assistEnabled,
    userAssistOverride: input.userAssistOverride,
    forceShowActive: input.forceShowActive,
    guideVisible,
    todayHomeViews: input.todayHomeViews,
    role: input.todayRole,
    roleGroup: resolveViewerRoleGroup(input.todayRole),
    roleMode: input.roleModeLabel,
    experienceLevel: input.experienceLevel,
    clinicSetupComplete: !input.isOnboardingPhase,
    isOnboardingPhase: input.isOnboardingPhase,
    pageKey: input.pageKey,
    workspaceProfileKey: String(input.workspaceProfileKey ?? ""),
    tenantAdminRole: input.tenantAdminRole ? String(input.tenantAdminRole) : null,
    roleFirstActive: input.roleFirstActive,
    tipCount: input.tipCount,
    nextBestActionCount: input.nextBestActionCount,
  };
}
