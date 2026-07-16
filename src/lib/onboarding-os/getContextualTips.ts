/**
 * Contextual + empty-state tip selection for Clinic guide.
 * Operational stats only — never clinical advice.
 */

import { GUIDED_ASSIST_TIPS, getGuidedAssistTipByCode } from "./guidedAssistCatalog";
import type {
  GuidedAssistClinicStats,
  GuidedAssistContextCondition,
  GuidedAssistEmptyStateKey,
  GuidedAssistEmptyStateTourView,
  GuidedAssistTimeOfDay,
  GuidedAssistTipDefinition,
  GuidedAssistTipView,
  GuidedAssistViewerContext,
  GuidedAssistUserPreferences,
} from "./guidedAssistTypes";
import { GUIDED_ASSIST_AREA_LABELS } from "./guidedAssistTypes";
import { expandGuidedAssistPageKeys } from "./guidedAssistPageKeys";

export function resolveTimeOfDay(hourLocal: number | null | undefined): GuidedAssistTimeOfDay {
  if (hourLocal == null || !Number.isFinite(hourLocal)) return "any";
  const h = Math.floor(hourLocal);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "evening";
}

export function conditionMatches(
  condition: GuidedAssistContextCondition | undefined,
  stats: GuidedAssistClinicStats
): boolean {
  if (!condition) return true;
  switch (condition) {
    case "zero_leads":
      return stats.openLeadCount <= 0;
    case "open_leads":
      return stats.openLeadCount > 0;
    case "zero_today_bookings":
      return stats.todayBookingCount <= 0;
    case "today_bookings":
      return stats.todayBookingCount > 0;
    case "open_tasks":
      return stats.openTaskCount > 0;
    case "zero_payment_records":
      return stats.paymentRecordCount <= 0;
    case "zero_open_surgery_cases":
      return stats.openSurgeryCaseCount <= 0;
    default:
      return true;
  }
}

export function timeOfDayMatches(
  required: GuidedAssistTimeOfDay | undefined,
  actual: GuidedAssistTimeOfDay
): boolean {
  if (!required || required === "any") return true;
  return required === actual;
}

/** Map current route + stats → empty-state key, if applicable. */
export function resolveEmptyStateKey(
  pageKey: string,
  stats: GuidedAssistClinicStats
): GuidedAssistEmptyStateKey | null {
  const keys = expandGuidedAssistPageKeys(pageKey);
  const has = (prefix: string) =>
    keys.some((k) => k === prefix || k.startsWith(`${prefix}/`));

  if ((has("crm") || has("leadflow")) && stats.openLeadCount <= 0) return "pipeline_empty";
  if (
    (has("front-desk") || has("reception") || has("tomorrow")) &&
    stats.todayBookingCount <= 0
  ) {
    return "front_desk_empty";
  }
  if ((has("calendar") || has("appointments")) && stats.todayBookingCount <= 0) {
    return "calendar_empty";
  }
  if ((has("financial-os") || has("financial") || has("payments")) && stats.paymentRecordCount <= 0) {
    return "money_empty";
  }
  if (
    (has("surgery") || has("surgery-os") || has("cases") || has("surgery-readiness")) &&
    stats.openSurgeryCaseCount <= 0
  ) {
    return "surgery_empty";
  }
  return null;
}

function tipToView(tip: GuidedAssistTipDefinition, tenantBase: string): GuidedAssistTipView {
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
 * Contextual tips: time-of-day + operational conditions, page-aware, role-aware.
 * Does not include empty-state tour roots (those are separate).
 */
export function getContextualTips(input: {
  ctx: Pick<
    GuidedAssistViewerContext,
    "tenantId" | "pageKey" | "workspaceProfileKey" | "tenantAdminRole"
  >;
  prefs: Pick<GuidedAssistUserPreferences, "dismissedTipCodes" | "snoozedTips">;
  stats: GuidedAssistClinicStats;
  timeOfDay: GuidedAssistTimeOfDay;
  nowMs?: number;
  maxTips?: number;
}): GuidedAssistTipView[] {
  const maxTips = input.maxTips ?? 2;
  const tenantBase = `/fi-admin/${input.ctx.tenantId.trim()}`;
  const nowMs = input.nowMs ?? Date.now();
  const dismissed = new Set(input.prefs.dismissedTipCodes);
  const pageKeys = expandGuidedAssistPageKeys(input.ctx.pageKey);

  const eligible = GUIDED_ASSIST_TIPS.filter((tip) => {
    if (!tip.contextTriggers) return false;
    if (tip.emptyStateKey) return false;
    if (dismissed.has(tip.code)) return false;
    const snoozeUntil = input.prefs.snoozedTips[tip.code];
    if (snoozeUntil && Date.parse(snoozeUntil) > nowMs) return false;

    // Page match (Today empty pageKey for home-only contextual tips)
    const tipPage = tip.pageKey.trim();
    if (tipPage === "") {
      if (!(pageKeys.includes("") || pageKeys.includes("dashboard"))) return false;
    } else {
      const pageOk = pageKeys.some((k) =>
        tip.pageKeyPrefix ? k === tipPage || k.startsWith(`${tipPage}/`) : k === tipPage
      );
      if (!pageOk) return false;
    }

    // Role: reuse anyRole / profiles via simplified check
    const scope = tip.roleScope;
    if (!scope.anyRole) {
      const profiles = scope.workspaceProfiles ?? [];
      const admins = scope.tenantAdminRoles ?? [];
      const profileOk =
        profiles.length === 0 ||
        profiles.includes(input.ctx.workspaceProfileKey);
      const adminOk =
        admins.length === 0 ||
        (input.ctx.tenantAdminRole != null && admins.includes(input.ctx.tenantAdminRole));
      if (profiles.length === 0 && admins.length === 0) return false;
      if (!profileOk && !adminOk) return false;
    }

    if (!timeOfDayMatches(tip.contextTriggers.timeOfDay, input.timeOfDay)) return false;
    if (!conditionMatches(tip.contextTriggers.condition, input.stats)) return false;
    return true;
  }).sort((a, b) => a.priority - b.priority);

  return eligible.slice(0, maxTips).map((tip) => {
    const view = tipToView(tip, tenantBase);
    return { ...view, body: interpolateStats(view.body, input.stats) };
  });
}

/** Build empty-state tour offer for the current route, if any. */
export function getEmptyStateTour(input: {
  pageKey: string;
  stats: GuidedAssistClinicStats;
  tenantId: string;
  dismissedTipCodes?: readonly string[];
}): GuidedAssistEmptyStateTourView | null {
  const key = resolveEmptyStateKey(input.pageKey, input.stats);
  if (!key) return null;

  const root = GUIDED_ASSIST_TIPS.find((t) => t.emptyStateKey === key);
  if (!root || !root.tourSteps?.length) return null;
  if (input.dismissedTipCodes?.includes(root.code)) return null;

  const tenantBase = `/fi-admin/${input.tenantId.trim()}`;
  const steps: GuidedAssistTipView[] = [];
  for (const code of root.tourSteps) {
    const step = getGuidedAssistTipByCode(code);
    if (!step) continue;
    steps.push(tipToView(step, tenantBase));
  }
  if (steps.length === 0) return null;

  return {
    emptyStateKey: key,
    rootTipCode: root.code,
    title: root.title,
    body: root.body,
    steps,
  };
}

/**
 * Merge role-first / catalog tips with contextual tips (dedupe by code).
 * Contextual tips are prepended when present (time-sensitive operational nudges).
 */
export function mergeContextualTips(
  contextual: readonly GuidedAssistTipView[],
  base: readonly GuidedAssistTipView[],
  maxTips = 3
): GuidedAssistTipView[] {
  const seen = new Set<string>();
  const out: GuidedAssistTipView[] = [];
  for (const tip of [...contextual, ...base]) {
    if (seen.has(tip.code)) continue;
    seen.add(tip.code);
    out.push(tip);
    if (out.length >= maxTips) break;
  }
  return out;
}
