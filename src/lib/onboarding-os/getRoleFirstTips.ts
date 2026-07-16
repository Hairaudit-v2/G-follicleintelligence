/**
 * Role-first tips for the Today (home) page — first N exposures per user/tenant.
 * Pure helper; catalog remains the single source of tip content.
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

import { GUIDED_ASSIST_TIPS } from "./guidedAssistCatalog";
import {
  compareTipsByRoleGroupAndPriority,
  isClinicalTodayRole,
} from "./guidedAssistRoleMode";
import type {
  GuidedAssistTipDefinition,
  GuidedAssistTodayRoleKey,
  GuidedAssistTipView,
} from "./guidedAssistTypes";
import { GUIDED_ASSIST_AREA_LABELS, GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT } from "./guidedAssistTypes";

export { GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT };

/** True when the viewer is on tenant Today / home (empty page key). */
export function isGuidedAssistTodayPage(pageKey: string): boolean {
  const p = pageKey.trim();
  return p === "" || p === "dashboard";
}

/**
 * Map FI workspace profile + optional tenant admin role → simplified Today role tag.
 */
export function mapViewerToGuidedAssistTodayRole(input: {
  workspaceProfileKey: FiWorkspaceProfileKey | null | undefined;
  tenantAdminRole?: FiTenantAdminRole | null;
}): GuidedAssistTodayRoleKey {
  const admin = String(input.tenantAdminRole ?? "")
    .trim()
    .toLowerCase();
  if (admin === "finance_admin") return "finance";
  if (admin === "clinic_admin" || admin === "operations_admin") return "admin";

  const profile = String(input.workspaceProfileKey ?? "")
    .trim()
    .toLowerCase();
  if (profile === "reception") return "reception";
  if (profile === "consultant") return "consultant";
  if (profile === "doctor" || profile === "surgeon") return "doctor";
  if (profile === "nurse") return "nurse";
  if (profile === "director" || profile === "clinic_manager" || profile === "platform_admin") {
    return "admin";
  }
  if (profile === "academy_trainer") return "admin";
  if (profile === "auditor") return "admin";
  return "all";
}

export function shouldUseRoleFirstTips(input: {
  pageKey: string;
  todayHomeViews: number;
  viewLimit?: number;
}): boolean {
  if (!isGuidedAssistTodayPage(input.pageKey)) return false;
  const limit = input.viewLimit ?? GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT;
  const views = Math.max(0, Math.floor(Number(input.todayHomeViews) || 0));
  return views < limit;
}

function tipMatchesTodayRole(
  tip: GuidedAssistTipDefinition,
  role: GuidedAssistTodayRoleKey
): boolean {
  const roles = tip.roles;
  if (!roles || roles.length === 0) return false;
  if (roles.includes("all")) return true;
  return roles.includes(role);
}

function isTodayTip(tip: GuidedAssistTipDefinition): boolean {
  const pk = tip.pageKey.trim();
  return pk === "" || pk === "dashboard";
}

/**
 * Role-first tips from the catalog for Today, filtered by simplified role and sorted
 * by priority ascending (lower = shown first — same as catalog).
 */
export function getRoleFirstTips(input: {
  todayRole: GuidedAssistTodayRoleKey;
  tenantId: string;
  dismissedTipCodes?: readonly string[];
  maxTips?: number;
}): GuidedAssistTipView[] {
  const dismissed = new Set(input.dismissedTipCodes ?? []);
  const tenantBase = `/fi-admin/${input.tenantId.trim()}`;
  const maxTips = input.maxTips ?? 3;

  const preferClinical = isClinicalTodayRole(input.todayRole);
  const eligible = GUIDED_ASSIST_TIPS.filter((tip) => {
    if (!isTodayTip(tip)) return false;
    if (tip.emptyStateKey) return false;
    if (tip.contextTriggers) return false;
    if (tip.isNextBestAction) return false;
    if (tip.tourSteps?.length) return false;
    if (!tipMatchesTodayRole(tip, input.todayRole)) return false;
    if (dismissed.has(tip.code)) return false;
    return true;
  }).sort((a, b) => compareTipsByRoleGroupAndPriority(a, b, preferClinical));

  return eligible.slice(0, maxTips).map((tip) => ({
    code: tip.code,
    area: tip.area,
    areaLabel: GUIDED_ASSIST_AREA_LABELS[tip.area],
    title: tip.title,
    body: tip.body,
    dismissible: tip.dismissible,
    snoozeHours: tip.snoozeHours ?? null,
    actionLabel: tip.actionLabel ?? null,
    actionHref: tip.actionHrefSuffix
      ? `${tenantBase}/${tip.actionHrefSuffix.replace(/^\/+/, "")}`
      : null,
    isNextBestAction: false,
    suggestionSource: "catalog" as const,
  }));
}

/**
 * Merge role-first tips ahead of normal catalog tips (dedupe by code).
 */
export function mergeRoleFirstTipsWithCatalog(
  roleFirst: readonly GuidedAssistTipView[],
  catalog: readonly GuidedAssistTipView[],
  maxTips = 3
): GuidedAssistTipView[] {
  const seen = new Set<string>();
  const out: GuidedAssistTipView[] = [];
  for (const tip of [...roleFirst, ...catalog]) {
    if (seen.has(tip.code)) continue;
    seen.add(tip.code);
    out.push(tip);
    if (out.length >= maxTips) break;
  }
  return out;
}
