/**
 * OnboardingOS Phase D — pure guided assist resolution (deterministic, no AI).
 */

import { normalizeFiAdminTenantPathSuffix } from "@/src/config/fiRouteFeatureMap";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

import { GUIDED_ASSIST_NEXT_ACTIONS, GUIDED_ASSIST_TIPS } from "./guidedAssistCatalog";
import type {
  GuidedAssistArea,
  GuidedAssistAreaInsight,
  GuidedAssistNextActionView,
  GuidedAssistResolvedPreferences,
  GuidedAssistRoleScope,
  GuidedAssistSessionPayload,
  GuidedAssistSetupFlags,
  GuidedAssistSnoozedTips,
  GuidedAssistTenantDefaults,
  GuidedAssistTipView,
  GuidedAssistUserPreferences,
  GuidedAssistViewerContext,
} from "./guidedAssistTypes";
import {
  GUIDED_ASSIST_AREA_LABELS,
  GUIDED_ASSIST_SAFETY_NOTICE,
} from "./guidedAssistTypes";

export function resolveGuidedAssistPageKey(pathname: string, tenantBase: string): string {
  return normalizeFiAdminTenantPathSuffix(pathname, tenantBase);
}

export function computeGuidedAssistOnboardingPhase(setupFlags: GuidedAssistSetupFlags): boolean {
  return !(
    setupFlags.organisationCreated &&
    setupFlags.clinicCreated &&
    setupFlags.clinicSettingsComplete &&
    setupFlags.firstCaseCreated
  );
}

export function resolveEffectiveGuidedAssistEnabled(opts: {
  tenantDefaults: GuidedAssistTenantDefaults;
  userPreferences: GuidedAssistUserPreferences;
  isOnboardingPhase: boolean;
}): boolean {
  if (opts.userPreferences.assistEnabled !== null) {
    return opts.userPreferences.assistEnabled;
  }
  if (opts.isOnboardingPhase) {
    return opts.tenantDefaults.defaultEnabledDuringOnboarding;
  }
  return opts.tenantDefaults.defaultAssistEnabled;
}

export function buildGuidedAssistResolvedPreferences(opts: {
  tenantDefaults: GuidedAssistTenantDefaults;
  userPreferences: GuidedAssistUserPreferences;
  isOnboardingPhase: boolean;
}): GuidedAssistResolvedPreferences {
  return {
    assistEnabled: resolveEffectiveGuidedAssistEnabled(opts),
    tenantDefaults: opts.tenantDefaults,
    userPreferences: opts.userPreferences,
    isOnboardingPhase: opts.isOnboardingPhase,
  };
}

function matchesRoleScope(
  scope: GuidedAssistRoleScope,
  workspaceProfileKey: FiWorkspaceProfileKey,
  tenantAdminRole: FiTenantAdminRole | null
): boolean {
  if (scope.anyRole) return true;
  const profiles = scope.workspaceProfiles ?? [];
  const adminRoles = scope.tenantAdminRoles ?? [];
  if (profiles.length === 0 && adminRoles.length === 0) return false;
  if (profiles.includes(workspaceProfileKey)) return true;
  if (tenantAdminRole && adminRoles.includes(tenantAdminRole)) return true;
  return false;
}

function matchesPageKey(pageKey: string, tipPageKey: string, prefix?: boolean): boolean {
  const current = pageKey.trim();
  const target = tipPageKey.trim();
  if (target === "" && (current === "" || current === "dashboard")) return true;
  if (prefix) return current === target || current.startsWith(`${target}/`);
  return current === target;
}

function isTipSnoozed(code: string, snoozed: GuidedAssistSnoozedTips, nowMs: number): boolean {
  const until = snoozed[code];
  if (!until) return false;
  const ts = Date.parse(until);
  if (Number.isNaN(ts)) return false;
  return ts > nowMs;
}

function isTipDismissed(code: string, dismissed: readonly string[]): boolean {
  return dismissed.includes(code);
}

function matchesSetupRequirements(
  requires: Partial<GuidedAssistSetupFlags> | undefined,
  flags: GuidedAssistSetupFlags
): boolean {
  if (!requires) return true;
  for (const [key, expected] of Object.entries(requires) as [keyof GuidedAssistSetupFlags, boolean][]) {
    if (flags[key] !== expected) return false;
  }
  return true;
}

export function selectGuidedAssistTips(
  ctx: GuidedAssistViewerContext,
  prefs: GuidedAssistUserPreferences,
  now: Date = new Date(),
  maxTips = 3
): GuidedAssistTipView[] {
  const nowMs = now.getTime();
  const tenantBase = `/fi-admin/${ctx.tenantId}`;

  const eligible = GUIDED_ASSIST_TIPS.filter((tip) => {
    if (!matchesRoleScope(tip.roleScope, ctx.workspaceProfileKey, ctx.tenantAdminRole)) return false;
    if (!matchesPageKey(ctx.pageKey, tip.pageKey, tip.pageKeyPrefix)) return false;
    if (isTipDismissed(tip.code, prefs.dismissedTipCodes)) return false;
    if (isTipSnoozed(tip.code, prefs.snoozedTips, nowMs)) return false;
    return true;
  })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxTips);

  return eligible.map((tip) => toTipView(tip, tenantBase));
}

export function selectGuidedAssistNextAction(
  ctx: GuidedAssistViewerContext,
  tenantBase?: string
): GuidedAssistNextActionView | null {
  const base = tenantBase ?? `/fi-admin/${ctx.tenantId}`;

  const match = GUIDED_ASSIST_NEXT_ACTIONS.filter((action) => {
    if (!matchesRoleScope(action.roleScope, ctx.workspaceProfileKey, ctx.tenantAdminRole)) return false;
    if (!matchesSetupRequirements(action.requiresSetupFlags, ctx.setupFlags)) return false;
    return true;
  }).sort((a, b) => a.priority - b.priority)[0];

  if (!match) return null;

  return {
    code: match.code,
    area: match.area,
    areaLabel: GUIDED_ASSIST_AREA_LABELS[match.area],
    title: match.title,
    description: match.description,
    href: `${base}/${match.hrefSuffix.replace(/^\/+/, "")}`,
  };
}

function toTipView(
  tip: (typeof GUIDED_ASSIST_TIPS)[number],
  tenantBase: string
): GuidedAssistTipView {
  return {
    code: tip.code,
    area: tip.area,
    areaLabel: GUIDED_ASSIST_AREA_LABELS[tip.area],
    title: tip.title,
    body: tip.body,
    dismissible: tip.dismissible,
    snoozeHours: tip.snoozeHours ?? null,
    actionLabel: tip.actionLabel ?? null,
    actionHref: tip.actionHrefSuffix ? `${tenantBase}/${tip.actionHrefSuffix.replace(/^\/+/, "")}` : null,
  };
}

export function buildGuidedAssistSessionPayload(opts: {
  ctx: GuidedAssistViewerContext;
  resolved: GuidedAssistResolvedPreferences;
  userPreferences: GuidedAssistUserPreferences;
  maxTips?: number;
}): GuidedAssistSessionPayload {
  const tips = opts.resolved.assistEnabled
    ? selectGuidedAssistTips(opts.ctx, opts.userPreferences, new Date(), opts.maxTips ?? 3)
    : [];
  const nextAction = opts.resolved.assistEnabled ? selectGuidedAssistNextAction(opts.ctx) : null;

  return {
    assistEnabled: opts.resolved.assistEnabled,
    isOnboardingPhase: opts.resolved.isOnboardingPhase,
    pageKey: opts.ctx.pageKey,
    tips,
    nextAction,
    safetyNotice: GUIDED_ASSIST_SAFETY_NOTICE,
  };
}

export function parseDismissedTipCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

export function parseSnoozedTips(raw: unknown): GuidedAssistSnoozedTips {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: GuidedAssistSnoozedTips = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const k = key.trim();
    const v = String(value ?? "").trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export function buildSnoozeUntilIso(hours: number, now: Date = new Date()): string {
  const h = Math.max(1, Math.min(hours, 168));
  return new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();
}

export function validateGuidedAssistSnoozeHours(hours: number | null | undefined): number {
  if (hours == null || Number.isNaN(hours)) return 24;
  return Math.max(1, Math.min(Math.floor(hours), 168));
}

const GUIDANCE_REVIEW_MIN_SHOWN = 2;
const GUIDANCE_REVIEW_DISMISS_RATE = 0.4;

export function summarizeGuidedAssistUsageEvents(
  tenantId: string,
  events: readonly {
    fi_user_id: string | null;
    event_kind: string;
    guidance_area: string | null;
    guidance_code: string | null;
  }[],
  _windowDays: number
): {
  totalEvents: number;
  uniqueUsers: number;
  assistEnabledUsers: number;
  assistDisabledUsers: number;
  tipsShown: number;
  tipsDismissed: number;
  tipsSnoozed: number;
  nextActionsClicked: number;
  topTips: { guidanceCode: string; count: number }[];
  eventsByArea: { guidanceArea: GuidedAssistArea; count: number }[];
  topReliedTips: { guidanceCode: string; shownCount: number; dismissedCount: number }[];
  topDismissedTips: { guidanceCode: string; count: number }[];
  areaInsights: GuidedAssistAreaInsight[];
  modulesNeedingGuidanceReview: GuidedAssistArea[];
  reliantUsers: { fiUserId: string; tipsShown: number }[];
} {
  void tenantId;
  void _windowDays;

  const userIds = new Set<string>();
  const enabledUsers = new Set<string>();
  const disabledUsers = new Set<string>();
  const tipCounts = new Map<string, number>();
  const shownByTip = new Map<string, number>();
  const dismissedByTip = new Map<string, number>();
  const areaCounts = new Map<GuidedAssistArea, number>();
  const shownByArea = new Map<GuidedAssistArea, number>();
  const dismissedByArea = new Map<GuidedAssistArea, number>();
  const snoozedByArea = new Map<GuidedAssistArea, number>();
  const userShownCounts = new Map<string, number>();

  let tipsShown = 0;
  let tipsDismissed = 0;
  let tipsSnoozed = 0;
  let nextActionsClicked = 0;

  for (const e of events) {
    if (e.fi_user_id) userIds.add(e.fi_user_id);
    const kind = e.event_kind.trim();
    if (kind === "assist_enabled" && e.fi_user_id) enabledUsers.add(e.fi_user_id);
    if (kind === "assist_disabled" && e.fi_user_id) disabledUsers.add(e.fi_user_id);
    if (kind === "tip_shown") {
      tipsShown += 1;
      if (e.fi_user_id) userShownCounts.set(e.fi_user_id, (userShownCounts.get(e.fi_user_id) ?? 0) + 1);
      if (e.guidance_code) shownByTip.set(e.guidance_code, (shownByTip.get(e.guidance_code) ?? 0) + 1);
    }
    if (kind === "tip_dismissed") {
      tipsDismissed += 1;
      if (e.guidance_code) dismissedByTip.set(e.guidance_code, (dismissedByTip.get(e.guidance_code) ?? 0) + 1);
    }
    if (kind === "tip_snoozed") tipsSnoozed += 1;
    if (kind === "next_action_clicked") nextActionsClicked += 1;
    if (e.guidance_code && (kind === "tip_shown" || kind === "tip_dismissed" || kind === "tip_snoozed")) {
      tipCounts.set(e.guidance_code, (tipCounts.get(e.guidance_code) ?? 0) + 1);
    }
    if (e.guidance_area && e.guidance_area in GUIDED_ASSIST_AREA_LABELS) {
      const area = e.guidance_area as GuidedAssistArea;
      areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
      if (kind === "tip_shown") shownByArea.set(area, (shownByArea.get(area) ?? 0) + 1);
      if (kind === "tip_dismissed") dismissedByArea.set(area, (dismissedByArea.get(area) ?? 0) + 1);
      if (kind === "tip_snoozed") snoozedByArea.set(area, (snoozedByArea.get(area) ?? 0) + 1);
    }
  }

  const topTips = [...tipCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([guidanceCode, count]) => ({ guidanceCode, count }));

  const eventsByArea = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([guidanceArea, count]) => ({ guidanceArea, count }));

  const topReliedTips = [...shownByTip.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([guidanceCode, shownCount]) => ({
      guidanceCode,
      shownCount,
      dismissedCount: dismissedByTip.get(guidanceCode) ?? 0,
    }));

  const topDismissedTips = [...dismissedByTip.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([guidanceCode, count]) => ({ guidanceCode, count }));

  const areaInsightAreas = new Set<GuidedAssistArea>([
    ...shownByArea.keys(),
    ...dismissedByArea.keys(),
    ...snoozedByArea.keys(),
  ]);

  const areaInsights = [...areaInsightAreas]
    .map((guidanceArea) => {
      const areaShown = shownByArea.get(guidanceArea) ?? 0;
      const areaDismissed = dismissedByArea.get(guidanceArea) ?? 0;
      const areaSnoozed = snoozedByArea.get(guidanceArea) ?? 0;
      const dismissRate = areaShown > 0 ? areaDismissed / areaShown : 0;
      return {
        guidanceArea,
        tipsShown: areaShown,
        tipsDismissed: areaDismissed,
        tipsSnoozed: areaSnoozed,
        dismissRate,
        needsGuidanceReview: areaShown >= GUIDANCE_REVIEW_MIN_SHOWN && dismissRate >= GUIDANCE_REVIEW_DISMISS_RATE,
      };
    })
    .sort((a, b) => b.dismissRate - a.dismissRate || b.tipsShown - a.tipsShown);

  const modulesNeedingGuidanceReview = areaInsights
    .filter((row) => row.needsGuidanceReview)
    .map((row) => row.guidanceArea);

  const reliantUsers = [...userShownCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([fiUserId, tipsShownCount]) => ({ fiUserId, tipsShown: tipsShownCount }));

  return {
    totalEvents: events.length,
    uniqueUsers: userIds.size,
    assistEnabledUsers: enabledUsers.size,
    assistDisabledUsers: disabledUsers.size,
    tipsShown,
    tipsDismissed,
    tipsSnoozed,
    nextActionsClicked,
    topTips,
    eventsByArea,
    topReliedTips,
    topDismissedTips,
    areaInsights,
    modulesNeedingGuidanceReview,
    reliantUsers,
  };
}

export function buildGuidedAssistSetupFlagsFromChecklist(checklist: {
  organisationCreated: boolean;
  clinicCreated: boolean;
  clinicSettingsComplete: boolean;
  firstCaseCreated: boolean;
}): GuidedAssistSetupFlags {
  return {
    organisationCreated: checklist.organisationCreated,
    clinicCreated: checklist.clinicCreated,
    clinicSettingsComplete: checklist.clinicSettingsComplete,
    firstCaseCreated: checklist.firstCaseCreated,
  };
}
