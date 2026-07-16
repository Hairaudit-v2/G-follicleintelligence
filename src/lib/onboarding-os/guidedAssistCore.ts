/**
 * OnboardingOS Phase D — pure guided assist resolution (deterministic, no AI).
 */

import { normalizeFiAdminTenantPathSuffix } from "@/src/config/fiRouteFeatureMap";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

import { GUIDED_ASSIST_NEXT_ACTIONS, GUIDED_ASSIST_TIPS } from "./guidedAssistCatalog";
import {
  getContextualTips,
  getEmptyStateTour,
  mergeContextualTips,
  resolveTimeOfDay,
} from "./getContextualTips";
import {
  getRoleFirstTips,
  mapViewerToGuidedAssistTodayRole,
  mergeRoleFirstTipsWithCatalog,
  shouldUseRoleFirstTips,
} from "./getRoleFirstTips";
import {
  filterTipsByExperienceLevel,
  getRuleBasedNextBestActions,
  inferGuidedAssistExperienceLevel,
} from "./getTieredAndContextualTips";
import { getClinicalQuickActions } from "./getClinicalQuickActions";
import { emptyEngagementSnapshot, formatStreakMessage } from "./guidedAssistEngagementCore";
import { buildGuidedAssistDebugInfo } from "./guidedAssistForceShow";
import { expandGuidedAssistPageKeys } from "./guidedAssistPageKeys";
import {
  buildGuidedAssistRoleModeLabel,
  compareTipsByRoleGroupAndPriority,
  isClinicalTodayRole,
  isClinicalWorkspaceProfile,
} from "./guidedAssistRoleMode";
import {
  GUIDED_ASSIST_WHATS_NEW_VERSION,
  shouldShowGuidedAssistWhatsNew,
} from "./guidedAssistWhatsNew";
import type {
  GuidedAssistArea,
  GuidedAssistAreaInsight,
  GuidedAssistClinicStats,
  GuidedAssistEngagementSnapshot,
  GuidedAssistExperienceLevel,
  GuidedAssistHealthSnapshot,
  GuidedAssistNextActionView,
  GuidedAssistQuickActionView,
  GuidedAssistResolvedPreferences,
  GuidedAssistRoleScope,
  GuidedAssistSessionPayload,
  GuidedAssistSetupFlags,
  GuidedAssistSnoozedTips,
  GuidedAssistTenantDefaults,
  GuidedAssistTipView,
  GuidedAssistTodayRoleKey,
  GuidedAssistUserPreferences,
  GuidedAssistViewerContext,
} from "./guidedAssistTypes";
import {
  GUIDED_ASSIST_AREA_LABELS,
  GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT,
  GUIDED_ASSIST_SAFETY_NOTICE,
} from "./guidedAssistTypes";

export { expandGuidedAssistPageKeys } from "./guidedAssistPageKeys";

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
  const target = tipPageKey.trim();
  const expanded = expandGuidedAssistPageKeys(pageKey);

  for (const current of expanded) {
    if (target === "" && (current === "" || current === "dashboard")) return true;
    if (prefix) {
      if (current === target || current.startsWith(`${target}/`)) return true;
    } else if (current === target) {
      return true;
    }
  }

  // Tip prefix match against the raw path (nested routes).
  const raw = pageKey.trim();
  if (prefix && (raw === target || raw.startsWith(`${target}/`))) return true;
  if (!prefix && raw === target) return true;
  return false;
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
  for (const [key, expected] of Object.entries(requires) as [
    keyof GuidedAssistSetupFlags,
    boolean,
  ][]) {
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

  const tourStepCodes = new Set(
    GUIDED_ASSIST_TIPS.flatMap((t) => (t.tourSteps?.length ? [...t.tourSteps] : []))
  );

  const preferClinical =
    isClinicalWorkspaceProfile(ctx.workspaceProfileKey) ||
    isClinicalTodayRole(
      mapViewerToGuidedAssistTodayRole({
        workspaceProfileKey: ctx.workspaceProfileKey,
        tenantAdminRole: ctx.tenantAdminRole,
      })
    );

  const eligible = GUIDED_ASSIST_TIPS.filter((tip) => {
    // Empty-state tour roots are offered via emptyStateTour (Tour me), not the tip list.
    if (tip.emptyStateKey) return false;
    // Tour step tips only appear inside an active tour.
    if (tourStepCodes.has(tip.code)) return false;
    // Contextual tips are selected separately (time/condition).
    if (tip.contextTriggers) return false;
    // Next-best-action tips are selected via getRuleBasedNextBestActions.
    if (tip.isNextBestAction) return false;
    if (!matchesRoleScope(tip.roleScope, ctx.workspaceProfileKey, ctx.tenantAdminRole))
      return false;
    if (!matchesPageKey(ctx.pageKey, tip.pageKey, tip.pageKeyPrefix)) return false;
    if (isTipDismissed(tip.code, prefs.dismissedTipCodes)) return false;
    if (isTipSnoozed(tip.code, prefs.snoozedTips, nowMs)) return false;
    return true;
  })
    .sort((a, b) => compareTipsByRoleGroupAndPriority(a, b, preferClinical))
    .slice(0, maxTips);

  return eligible.map((tip) => toTipView(tip, tenantBase));
}

export function selectGuidedAssistNextAction(
  ctx: GuidedAssistViewerContext,
  tenantBase?: string
): GuidedAssistNextActionView | null {
  const base = tenantBase ?? `/fi-admin/${ctx.tenantId}`;

  const match = GUIDED_ASSIST_NEXT_ACTIONS.filter((action) => {
    if (!matchesRoleScope(action.roleScope, ctx.workspaceProfileKey, ctx.tenantAdminRole))
      return false;
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
  tenantBase: string,
  suggestionSource: GuidedAssistTipView["suggestionSource"] = "catalog"
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
    actionHref: tip.actionHrefSuffix
      ? `${tenantBase}/${tip.actionHrefSuffix.replace(/^\/+/, "")}`
      : null,
    emptyStateKey: tip.emptyStateKey ?? null,
    tourStepCodes: tip.tourSteps?.length ? [...tip.tourSteps] : null,
    isNextBestAction: Boolean(tip.isNextBestAction),
    suggestionSource,
  };
}

export function emptyGuidedAssistClinicStats(): GuidedAssistClinicStats {
  return {
    openLeadCount: 0,
    todayBookingCount: 0,
    openTaskCount: 0,
    openSurgeryCaseCount: 0,
    paymentRecordCount: 0,
    hourLocal: null,
  };
}

export function buildGuidedAssistSessionPayload(opts: {
  ctx: GuidedAssistViewerContext;
  resolved: GuidedAssistResolvedPreferences;
  userPreferences: GuidedAssistUserPreferences;
  maxTips?: number;
  roleFirstViewLimit?: number;
  clinicStats?: GuidedAssistClinicStats | null;
  now?: Date;
  /** Optional preloaded engagement (streak, progress, feedback, team highlight). */
  engagement?: GuidedAssistEngagementSnapshot | null;
  /**
   * Admin session force-show — loads tips even when preference is off.
   * Does not mutate stored assist_enabled.
   */
  forceShowActive?: boolean;
  /** Include debugInfo on payload (admins or debug query). */
  includeDebugInfo?: boolean;
}): GuidedAssistSessionPayload {
  const maxTips = opts.maxTips ?? 3;
  const roleFirstViewLimit = opts.roleFirstViewLimit ?? GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT;
  const todayHomeViews = Math.max(0, Math.floor(Number(opts.userPreferences.todayHomeViews) || 0));
  const todayRole = mapViewerToGuidedAssistTodayRole({
    workspaceProfileKey: opts.ctx.workspaceProfileKey,
    tenantAdminRole: opts.ctx.tenantAdminRole,
  });
  const stats = opts.clinicStats ?? emptyGuidedAssistClinicStats();
  const now = opts.now ?? new Date();
  const timeOfDay = resolveTimeOfDay(stats.hourLocal);
  const forceShowActive = Boolean(opts.forceShowActive);
  /** Preference on, or admin force-show for troubleshooting. */
  const guideVisible = opts.resolved.assistEnabled || forceShowActive;

  const experienceLevel: GuidedAssistExperienceLevel = inferGuidedAssistExperienceLevel({
    todayHomeViews,
    guideStartedAtIso: opts.userPreferences.guideStartedAtIso,
    experienceLevelOverride: opts.userPreferences.experienceLevelOverride,
    now,
  });

  const roleFirstActive =
    guideVisible &&
    shouldUseRoleFirstTips({
      pageKey: opts.ctx.pageKey,
      todayHomeViews,
      viewLimit: roleFirstViewLimit,
    });

  let tips: GuidedAssistTipView[] = [];
  let nextBestActions: GuidedAssistTipView[] = [];
  let emptyStateTour = null as GuidedAssistSessionPayload["emptyStateTour"];

  if (guideVisible) {
    const catalogTips = filterTipsByExperienceLevel(
      selectGuidedAssistTips(opts.ctx, opts.userPreferences, now, maxTips + 2),
      experienceLevel
    );
    if (roleFirstActive) {
      const roleTips = filterTipsByExperienceLevel(
        getRoleFirstTips({
          todayRole,
          tenantId: opts.ctx.tenantId,
          dismissedTipCodes: opts.userPreferences.dismissedTipCodes,
          maxTips: maxTips + 2,
        }),
        experienceLevel
      );
      tips = mergeRoleFirstTipsWithCatalog(roleTips, catalogTips, maxTips);
    } else {
      tips = catalogTips.slice(0, maxTips);
    }

    const contextual = getContextualTips({
      ctx: opts.ctx,
      prefs: opts.userPreferences,
      stats,
      timeOfDay,
      nowMs: now.getTime(),
      maxTips: 2,
    }).filter((t) => {
      const def = GUIDED_ASSIST_TIPS.find((d) => d.code === t.code);
      if (!def) return true;
      return !def.experienceLevel?.length || def.experienceLevel.includes(experienceLevel);
    });
    tips = mergeContextualTips(contextual, tips, maxTips);

    nextBestActions = getRuleBasedNextBestActions({
      tenantId: opts.ctx.tenantId,
      pageKey: opts.ctx.pageKey,
      todayRole,
      experienceLevel,
      stats,
      timeOfDay,
      dismissedTipCodes: opts.userPreferences.dismissedTipCodes,
      maxActions: 2,
    });

    emptyStateTour = getEmptyStateTour({
      pageKey: opts.ctx.pageKey,
      stats,
      tenantId: opts.ctx.tenantId,
      dismissedTipCodes: opts.userPreferences.dismissedTipCodes,
    });
  }

  const nextAction = guideVisible ? selectGuidedAssistNextAction(opts.ctx) : null;
  const clinicalQuickActions: GuidedAssistQuickActionView[] = guideVisible
    ? getClinicalQuickActions({
        tenantId: opts.ctx.tenantId,
        todayRole,
        pageKey: opts.ctx.pageKey,
        stats,
        timeOfDay,
        maxActions: 3,
      })
    : [];
  const tenantBase = `/fi-admin/${opts.ctx.tenantId.trim()}`;
  const settingsHref = `${tenantBase}/settings/clinic-guide`;
  const canManageTenantDefaults =
    opts.ctx.tenantAdminRole === "clinic_admin" ||
    opts.ctx.tenantAdminRole === "operations_admin";

  const streakDays = Math.max(
    0,
    Math.floor(Number(opts.userPreferences.engagementStreakDays) || 0)
  );
  const engagement: GuidedAssistEngagementSnapshot = opts.engagement ?? {
    ...emptyEngagementSnapshot(),
    streakDays,
    streakMessage: formatStreakMessage(streakDays),
  };

  // Always surface a warm role mode label (helps clinical staff feel supported).
  const roleModeLabel = buildGuidedAssistRoleModeLabel({
    todayRole,
    workspaceProfileKey: opts.ctx.workspaceProfileKey,
    tenantAdminRole: opts.ctx.tenantAdminRole,
    assistEnabled: opts.resolved.assistEnabled || forceShowActive,
  });

  const debugInfo = buildGuidedAssistDebugInfo({
    assistEnabled: opts.resolved.assistEnabled,
    userAssistOverride: opts.userPreferences.assistEnabled,
    forceShowActive,
    todayHomeViews,
    todayRole,
    roleModeLabel,
    experienceLevel,
    isOnboardingPhase: opts.resolved.isOnboardingPhase,
    pageKey: opts.ctx.pageKey,
    workspaceProfileKey: opts.ctx.workspaceProfileKey,
    tenantAdminRole: opts.ctx.tenantAdminRole,
    roleFirstActive,
    tipCount: tips.length,
    nextBestActionCount: nextBestActions.length,
  });

  return {
    assistEnabled: opts.resolved.assistEnabled,
    isOnboardingPhase: opts.resolved.isOnboardingPhase,
    pageKey: opts.ctx.pageKey,
    tips,
    nextAction,
    safetyNotice: GUIDED_ASSIST_SAFETY_NOTICE,
    roleFirstActive,
    todayRole,
    roleModeLabel,
    todayHomeViews,
    roleFirstViewLimit,
    // Only advance real preference counters when genuinely enabled (not force-show alone).
    shouldIncrementTodayHomeViews:
      opts.resolved.assistEnabled && roleFirstActive && tips.length > 0,
    emptyStateTour,
    clinicStats: stats,
    timeOfDay,
    experienceLevel,
    nextBestActions,
    clinicalQuickActions,
    // Re-enable chrome when preference is off (even if force-show is temporarily on).
    showReenableChrome: !opts.resolved.assistEnabled && !forceShowActive,
    settingsHref,
    userAssistOverride: opts.userPreferences.assistEnabled,
    canManageTenantDefaults,
    engagement,
    forceShowActive,
    guideVisible,
    debugInfo: opts.includeDebugInfo || canManageTenantDefaults || forceShowActive ? debugInfo : null,
    showWhatsNew:
      guideVisible && shouldShowGuidedAssistWhatsNew(opts.userPreferences.whatsNewSeenVersion),
    whatsNewVersion: GUIDED_ASSIST_WHATS_NEW_VERSION,
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
      if (e.fi_user_id)
        userShownCounts.set(e.fi_user_id, (userShownCounts.get(e.fi_user_id) ?? 0) + 1);
      if (e.guidance_code)
        shownByTip.set(e.guidance_code, (shownByTip.get(e.guidance_code) ?? 0) + 1);
    }
    if (kind === "tip_dismissed") {
      tipsDismissed += 1;
      if (e.guidance_code)
        dismissedByTip.set(e.guidance_code, (dismissedByTip.get(e.guidance_code) ?? 0) + 1);
    }
    if (kind === "tip_snoozed") tipsSnoozed += 1;
    if (kind === "next_action_clicked") nextActionsClicked += 1;
    if (
      e.guidance_code &&
      (kind === "tip_shown" || kind === "tip_dismissed" || kind === "tip_snoozed")
    ) {
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
        needsGuidanceReview:
          areaShown >= GUIDANCE_REVIEW_MIN_SHOWN && dismissRate >= GUIDANCE_REVIEW_DISMISS_RATE,
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

function previewText(raw: string | null | undefined, max = 110): string {
  const t = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function withBarPercent<T extends { count: number }>(
  rows: T[]
): (T & { barPercent: number })[] {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return rows.map((r) => ({
    ...r,
    barPercent: max > 0 ? Math.max(6, Math.round((r.count / max) * 100)) : 0,
  }));
}

/** Whether a tip code is relevant for a Today role filter (catalog roles + "all"). */
export function tipCodeMatchesHealthRole(
  code: string,
  role: GuidedAssistTodayRoleKey | "all",
  tipRoles?: readonly GuidedAssistTodayRoleKey[] | null
): boolean {
  if (role === "all") return true;
  const roles = tipRoles ?? GUIDED_ASSIST_TIPS.find((t) => t.code === code)?.roles ?? null;
  if (!roles || roles.length === 0) return true; // unscoped catalog tips count for all
  if (roles.includes("all")) return true;
  return roles.includes(role);
}

function eventMatchesHealthRole(
  ev: {
    guidance_code: string | null;
    detail?: Record<string, unknown> | null;
  },
  role: GuidedAssistTodayRoleKey | "all"
): boolean {
  if (role === "all") return true;
  const detail = ev.detail && typeof ev.detail === "object" ? ev.detail : null;
  const detailRole =
    detail && detail.todayRole != null ? String(detail.todayRole).trim() : "";
  if (detailRole) {
    return detailRole === role || detailRole === "all";
  }
  const code = ev.guidance_code ? String(ev.guidance_code).trim() : "";
  if (!code) return true;
  return tipCodeMatchesHealthRole(code, role);
}

/**
 * Pure “Guide Health” aggregation for admin Settings (tenant-scoped inputs only).
 * Resolves tip/action titles via optional label lookups (catalog SSOT).
 */
export function summarizeGuidedAssistHealthMetrics(opts: {
  tenantId: string;
  windowDays: number;
  roleFilter?: GuidedAssistTodayRoleKey | "all";
  usersWithGuideOn: number;
  usersWithPreferenceRow: number;
  events: readonly {
    event_kind: string;
    guidance_code: string | null;
    detail?: Record<string, unknown> | null;
  }[];
  feedback: readonly { tip_code: string; helpful: boolean }[];
  tipTitle?: (code: string) => string;
  tipPreview?: (code: string) => string;
  quickActionTitle?: (code: string) => string;
  quickActionPreview?: (code: string) => string;
  topLimit?: number;
}): GuidedAssistHealthSnapshot {
  const tipTitle = opts.tipTitle ?? ((c: string) => c);
  const tipPreview =
    opts.tipPreview ??
    ((c: string) => previewText(GUIDED_ASSIST_TIPS.find((t) => t.code === c)?.body));
  const qaTitle = opts.quickActionTitle ?? ((c: string) => c);
  const qaPreview = opts.quickActionPreview ?? ((_c: string) => "");
  const roleFilter = opts.roleFilter ?? "all";
  const topLimit = Math.max(1, Math.min(opts.topLimit ?? 5, 10));

  const tipShown = new Map<string, number>();
  const qaClicked = new Map<string, number>();
  let tipsShown = 0;
  let quickActionsClicked = 0;
  let toursCompleted = 0;

  for (const ev of opts.events) {
    if (!eventMatchesHealthRole(ev, roleFilter)) continue;
    const kind = String(ev.event_kind ?? "");
    const code = ev.guidance_code ? String(ev.guidance_code).trim() : "";
    if (kind === "tip_shown") {
      tipsShown += 1;
      if (code) tipShown.set(code, (tipShown.get(code) ?? 0) + 1);
    }
    if (kind === "quick_action_clicked" || (kind === "next_action_clicked" && code.startsWith("qa_"))) {
      quickActionsClicked += 1;
      const qaCode =
        code ||
        (ev.detail && typeof ev.detail === "object" && typeof ev.detail.code === "string"
          ? String(ev.detail.code)
          : "");
      if (qaCode) qaClicked.set(qaCode, (qaClicked.get(qaCode) ?? 0) + 1);
    }
    if (kind === "tour_completed") toursCompleted += 1;
  }

  let thumbsUp = 0;
  let thumbsDown = 0;
  const downByTip = new Map<string, number>();
  const upByTip = new Map<string, number>();
  for (const row of opts.feedback) {
    const code = String(row.tip_code ?? "").trim();
    if (!code) continue;
    if (!tipCodeMatchesHealthRole(code, roleFilter)) continue;
    if (row.helpful) {
      thumbsUp += 1;
      upByTip.set(code, (upByTip.get(code) ?? 0) + 1);
    } else {
      thumbsDown += 1;
      downByTip.set(code, (downByTip.get(code) ?? 0) + 1);
    }
  }

  const totalVotes = thumbsUp + thumbsDown;
  const usersWithPreferenceRow = Math.max(0, opts.usersWithPreferenceRow);
  const usersWithGuideOn = Math.max(0, opts.usersWithGuideOn);
  const adoptionRate =
    usersWithPreferenceRow > 0 ? Math.min(1, usersWithGuideOn / usersWithPreferenceRow) : 0;

  const topTips = withBarPercent(
    [...tipShown.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topLimit)
      .map(([code, count]) => ({
        code,
        title: tipTitle(code),
        preview: previewText(tipPreview(code)),
        count,
      }))
  );

  const topQuickActions = withBarPercent(
    [...qaClicked.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topLimit)
      .map(([code, count]) => ({
        code,
        title: qaTitle(code),
        preview: previewText(qaPreview(code)),
        count,
      }))
  );

  const painPoints = withBarPercent(
    [...downByTip.entries()]
      .sort((a, b) => b[1] - a[1] || (upByTip.get(a[0]) ?? 0) - (upByTip.get(b[0]) ?? 0))
      .slice(0, topLimit)
      .map(([code, thumbsDownCount]) => ({
        code,
        title: tipTitle(code),
        preview: previewText(tipPreview(code)),
        thumbsDown: thumbsDownCount,
        thumbsUp: upByTip.get(code) ?? 0,
        count: thumbsDownCount,
      }))
  ).map(({ count: _c, ...rest }) => rest);

  return {
    tenantId: opts.tenantId.trim(),
    windowDays: opts.windowDays,
    roleFilter,
    adoptionRate,
    usersWithGuideOn,
    usersWithPreferenceRow,
    tipsShown,
    thumbsUp,
    thumbsDown,
    thumbsUpRate: totalVotes > 0 ? thumbsUp / totalVotes : 0,
    quickActionsClicked,
    toursCompleted,
    topTips,
    topQuickActions,
    painPoints,
  };
}

/** Escape a CSV field (RFC-ish). */
export function escapeCsvField(value: string | number | boolean | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build CSV for admin export (events + feedback rows). */
export function buildGuidedAssistHealthExportCsv(opts: {
  events: readonly {
    occurred_at?: string | null;
    event_kind: string;
    guidance_code: string | null;
    guidance_area?: string | null;
    page_key?: string | null;
    detail?: Record<string, unknown> | null;
  }[];
  feedback: readonly {
    tip_code: string;
    helpful: boolean;
    comment?: string | null;
    page_key?: string | null;
    updated_at?: string | null;
  }[];
}): string {
  const lines: string[] = [];
  lines.push(
    ["section", "occurred_at", "kind_or_helpful", "code", "area_or_page", "extra"].join(",")
  );
  for (const ev of opts.events) {
    const detailRole =
      ev.detail && typeof ev.detail === "object" && ev.detail.todayRole != null
        ? String(ev.detail.todayRole)
        : "";
    lines.push(
      [
        escapeCsvField("event"),
        escapeCsvField(ev.occurred_at ?? ""),
        escapeCsvField(ev.event_kind),
        escapeCsvField(ev.guidance_code),
        escapeCsvField(ev.guidance_area ?? ev.page_key ?? ""),
        escapeCsvField(detailRole),
      ].join(",")
    );
  }
  for (const fb of opts.feedback) {
    lines.push(
      [
        escapeCsvField("feedback"),
        escapeCsvField(fb.updated_at ?? ""),
        escapeCsvField(fb.helpful ? "helpful" : "unhelpful"),
        escapeCsvField(fb.tip_code),
        escapeCsvField(fb.page_key ?? ""),
        escapeCsvField(fb.comment ?? ""),
      ].join(",")
    );
  }
  return lines.join("\n");
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
