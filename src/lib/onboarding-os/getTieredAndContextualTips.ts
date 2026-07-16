/**
 * Experience-tier filtering + rule-based Next Best Action for Clinic guide.
 * Operational only — never clinical advice.
 *
 * Future AI: see docs/audits/fi-guided-assist-ai-nba-edge-notes.md
 */

import { GUIDED_ASSIST_TIPS } from "./guidedAssistCatalog";
import {
  conditionMatches,
  getContextualTips,
  mergeContextualTips,
  timeOfDayMatches,
} from "./getContextualTips";
import type {
  GuidedAssistClinicStats,
  GuidedAssistExperienceLevel,
  GuidedAssistTimeOfDay,
  GuidedAssistTipDefinition,
  GuidedAssistTipView,
  GuidedAssistTodayRoleKey,
  GuidedAssistUserPreferences,
  GuidedAssistViewerContext,
} from "./guidedAssistTypes";
import {
  GUIDED_ASSIST_ADVANCED_MIN_VIEWS,
  GUIDED_ASSIST_AREA_LABELS,
  GUIDED_ASSIST_NOVICE_MAX_DAYS,
  GUIDED_ASSIST_NOVICE_MAX_VIEWS,
} from "./guidedAssistTypes";
import { expandGuidedAssistPageKeys } from "./guidedAssistPageKeys";

export function inferGuidedAssistExperienceLevel(input: {
  todayHomeViews: number;
  guideStartedAtIso: string | null;
  experienceLevelOverride: GuidedAssistExperienceLevel | null;
  now?: Date;
}): GuidedAssistExperienceLevel {
  if (input.experienceLevelOverride) return input.experienceLevelOverride;

  const now = input.now ?? new Date();
  const views = Math.max(0, Math.floor(Number(input.todayHomeViews) || 0));
  let ageDays = 0;
  if (input.guideStartedAtIso) {
    const t = Date.parse(input.guideStartedAtIso);
    if (Number.isFinite(t)) {
      ageDays = Math.max(0, Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000)));
    }
  }

  if (ageDays < GUIDED_ASSIST_NOVICE_MAX_DAYS && views < GUIDED_ASSIST_NOVICE_MAX_VIEWS) {
    return "novice";
  }
  if (views >= GUIDED_ASSIST_ADVANCED_MIN_VIEWS || ageDays >= 180) {
    return "advanced";
  }
  return "intermediate";
}

export function tipMatchesExperienceLevel(
  tip: GuidedAssistTipDefinition,
  level: GuidedAssistExperienceLevel
): boolean {
  if (!tip.experienceLevel || tip.experienceLevel.length === 0) return true;
  return tip.experienceLevel.includes(level);
}

function tipToView(
  tip: GuidedAssistTipDefinition,
  tenantBase: string,
  source: GuidedAssistTipView["suggestionSource"]
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
    suggestionSource: source,
  };
}

function interpolateStats(body: string, stats: GuidedAssistClinicStats): string {
  return body
    .replace(/\{\{openLeadCount\}\}/g, String(stats.openLeadCount))
    .replace(/\{\{todayBookingCount\}\}/g, String(stats.todayBookingCount))
    .replace(/\{\{openTaskCount\}\}/g, String(stats.openTaskCount))
    .replace(/\{\{openSurgeryCaseCount\}\}/g, String(stats.openSurgeryCaseCount));
}

/**
 * Filter catalog tips by experience tier (does not replace page/role selection).
 */
export function filterTipsByExperienceLevel(
  tips: readonly GuidedAssistTipView[],
  level: GuidedAssistExperienceLevel
): GuidedAssistTipView[] {
  const allowedCodes = new Set(
    GUIDED_ASSIST_TIPS.filter((t) => tipMatchesExperienceLevel(t, level)).map((t) => t.code)
  );
  // Tips without catalog row (shouldn't happen) or allowed codes pass through
  return tips.filter((t) => {
    const def = GUIDED_ASSIST_TIPS.find((d) => d.code === t.code);
    if (!def) return true;
    return allowedCodes.has(t.code);
  });
}

/**
 * Rule-based Next Best Actions (1–2 tips).
 * Deterministic; AI Edge Function can append later with suggestionSource: ai_nba.
 */
export function getRuleBasedNextBestActions(input: {
  tenantId: string;
  pageKey: string;
  todayRole: GuidedAssistTodayRoleKey;
  experienceLevel: GuidedAssistExperienceLevel;
  stats: GuidedAssistClinicStats;
  timeOfDay: GuidedAssistTimeOfDay;
  dismissedTipCodes?: readonly string[];
  maxActions?: number;
}): GuidedAssistTipView[] {
  const maxActions = input.maxActions ?? 2;
  const dismissed = new Set(input.dismissedTipCodes ?? []);
  const tenantBase = `/fi-admin/${input.tenantId.trim()}`;
  const pageKeys = expandGuidedAssistPageKeys(input.pageKey);
  const isToday = pageKeys.includes("") || pageKeys.includes("dashboard");

  // Prefer Today hub for NBA; still allow on pipeline / front-desk for load signals.
  const pageOk =
    isToday ||
    pageKeys.some(
      (k) =>
        k === "crm" ||
        k.startsWith("crm/") ||
        k === "front-desk" ||
        k.startsWith("front-desk/") ||
        k === "leadflow" ||
        k.startsWith("leadflow/")
    );

  if (!pageOk) return [];

  const candidates = GUIDED_ASSIST_TIPS.filter((tip) => {
    if (!tip.isNextBestAction || tip.nextBestActionPriority == null) return false;
    if (dismissed.has(tip.code)) return false;
    if (!tipMatchesExperienceLevel(tip, input.experienceLevel)) return false;
    if (tip.roles?.length && !tip.roles.includes("all") && !tip.roles.includes(input.todayRole)) {
      return false;
    }
    // Page: empty = Today (and optionally load hubs); otherwise must match pageKey.
    const tipPage = tip.pageKey.trim();
    if (tipPage === "") {
      if (!isToday) return false;
    } else {
      const pageMatch = pageKeys.some((k) =>
        tip.pageKeyPrefix ? k === tipPage || k.startsWith(`${tipPage}/`) : k === tipPage
      );
      if (!pageMatch) return false;
    }

    if (tip.contextTriggers) {
      if (!timeOfDayMatches(tip.contextTriggers.timeOfDay, input.timeOfDay)) return false;
      if (!conditionMatches(tip.contextTriggers.condition, input.stats)) return false;
    }
    return true;
  }).sort(
    (a, b) =>
      (a.nextBestActionPriority ?? 99) - (b.nextBestActionPriority ?? 99) ||
      a.priority - b.priority
  );

  return candidates.slice(0, maxActions).map((tip) => {
    const view = tipToView(tip, tenantBase, "rule_nba");
    return {
      ...view,
      body: interpolateStats(view.body, input.stats),
      isNextBestAction: true,
      suggestionSource: "rule_nba" as const,
    };
  });
}

/**
 * Compose tier-filtered catalog tips + contextual + optional NBA merge for display list.
 * NBA tips are returned separately for the widget badge row; also optionally prepended.
 */
export function getTieredAndContextualTips(input: {
  ctx: GuidedAssistViewerContext;
  prefs: GuidedAssistUserPreferences;
  stats: GuidedAssistClinicStats;
  timeOfDay: GuidedAssistTimeOfDay;
  experienceLevel: GuidedAssistExperienceLevel;
  todayRole: GuidedAssistTodayRoleKey;
  baseTips: readonly GuidedAssistTipView[];
  maxTips?: number;
  nowMs?: number;
}): {
  tips: GuidedAssistTipView[];
  nextBestActions: GuidedAssistTipView[];
  experienceLevel: GuidedAssistExperienceLevel;
} {
  const maxTips = input.maxTips ?? 3;
  const tieredBase = filterTipsByExperienceLevel(input.baseTips, input.experienceLevel);

  const contextual = getContextualTips({
    ctx: input.ctx,
    prefs: input.prefs,
    stats: input.stats,
    timeOfDay: input.timeOfDay,
    nowMs: input.nowMs,
    maxTips: 2,
  }).filter((t) => {
    const def = GUIDED_ASSIST_TIPS.find((d) => d.code === t.code);
    return !def || tipMatchesExperienceLevel(def, input.experienceLevel);
  });

  const tips = mergeContextualTips(contextual, tieredBase, maxTips);

  const nextBestActions = getRuleBasedNextBestActions({
    tenantId: input.ctx.tenantId,
    pageKey: input.ctx.pageKey,
    todayRole: input.todayRole,
    experienceLevel: input.experienceLevel,
    stats: input.stats,
    timeOfDay: input.timeOfDay,
    dismissedTipCodes: input.prefs.dismissedTipCodes,
    maxActions: 2,
  });

  return {
    tips,
    nextBestActions,
    experienceLevel: input.experienceLevel,
  };
}

/**
 * Safety lint for tip bodies (unit-test helper). Rejects clinical language patterns.
 * Allows disclaimers such as “not medical advice” / “does not diagnose”.
 */
export function tipBodyIsOperationallySafe(body: string): boolean {
  const text = body.replace(
    /\b(not|never|no|without)\s+(clinical|medical|patient[- ]specific)?\s*(advice|diagnos\w*|prescri\w*|treatment recommendations?)\b/gi,
    " "
  );
  return !/\b(diagnos(?:e|is|tic)|prescri(?:be|ption)|dosage|treatment plan|medical advice|pathology interpretation)\b/i.test(
    text
  );
}
