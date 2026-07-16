/**
 * Pure engagement helpers for Clinic guide (streak, weekly progress, copy).
 * Warm, supportive colleague tone — no clinical language, no over-gamification.
 */

import { getGuidedAssistTipByCode } from "./guidedAssistCatalog";
import type {
  GuidedAssistEngagementSnapshot,
  GuidedAssistProgressSummary,
  GuidedAssistStreakState,
  GuidedAssistTeamHighlight,
} from "./guidedAssistTypes";
import { GUIDED_ASSIST_WEEKLY_PROGRESS_GOAL } from "./guidedAssistTypes";

/** Parse YYYY-MM-DD as UTC noon to avoid DST edge cases on day diffs. */
export function parseGuideCalendarDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

export function formatGuideCalendarDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole calendar days between two YYYY-MM-DD strings (b - a). */
export function calendarDaysBetween(aYmd: string, bYmd: string): number | null {
  const a = parseGuideCalendarDate(aYmd);
  const b = parseGuideCalendarDate(bYmd);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Update streak when the user engages on `todayYmd` (clinic-local date).
 * - Same day → unchanged
 * - Yesterday → +1
 * - Gap or first time → 1
 */
export function computeEngagementStreakUpdate(input: {
  currentStreakDays: number;
  lastActiveDateYmd: string | null;
  todayYmd: string;
}): GuidedAssistStreakState {
  const current = Math.max(0, Math.floor(Number(input.currentStreakDays) || 0));
  const today = input.todayYmd.trim();
  const last = input.lastActiveDateYmd?.trim() || null;

  if (!last) {
    return {
      streakDays: 1,
      lastActiveDateYmd: today,
      updated: true,
      message: formatStreakMessage(1),
    };
  }

  if (last === today) {
    const days = current > 0 ? current : 1;
    return {
      streakDays: days,
      lastActiveDateYmd: last,
      updated: false,
      message: formatStreakMessage(days),
    };
  }

  const delta = calendarDaysBetween(last, today);
  if (delta === 1) {
    const next = Math.min(3650, current + 1);
    return {
      streakDays: next,
      lastActiveDateYmd: today,
      updated: true,
      message: formatStreakMessage(next),
    };
  }

  // Missed a day (or clock skew) — restart at 1, still encouraging
  return {
    streakDays: 1,
    lastActiveDateYmd: today,
    updated: true,
    message: formatStreakMessage(1),
  };
}

/**
 * Warm streak copy — supportive colleague, not game points.
 * Shown from day 1 so new staff still get encouragement.
 */
export function formatStreakMessage(streakDays: number): string | null {
  const n = Math.floor(streakDays);
  if (n < 1) return null;
  if (n === 1) return "Nice work opening the guide today — you've got this";
  if (n === 2) return "2-day streak — keep building the habit";
  if (n === 3) return "3-day streak — keep it going!";
  if (n < 7) return `${n}-day streak — you're getting the hang of this`;
  if (n === 7) return "7-day streak — lovely consistency";
  if (n % 7 === 0) return `${n}-day streak — keep the momentum going`;
  return `${n}-day streak — keep it going`;
}

export function buildWeeklyProgressSummary(input: {
  completedCount: number;
  goal?: number;
  /** Prefer onboarding-style label while setup incomplete. */
  isOnboardingPhase?: boolean;
}): GuidedAssistProgressSummary {
  const goal = Math.max(1, Math.floor(input.goal ?? GUIDED_ASSIST_WEEKLY_PROGRESS_GOAL));
  const completed = Math.max(0, Math.floor(input.completedCount));
  const capped = Math.min(completed, goal);
  const percent = Math.min(100, Math.round((capped / goal) * 100));
  const isComplete = completed >= goal;

  const label = isComplete
    ? `All ${goal} weekly tips explored — nice work today`
    : `${capped} of ${goal} tips explored this week`;

  const percentLabel = input.isOnboardingPhase
    ? `Onboarding progress: ${percent}%`
    : `Weekly progress: ${percent}%`;

  return {
    completedCount: completed,
    goalCount: goal,
    percent,
    label,
    percentLabel,
    isComplete,
  };
}

export function resolveTeamHighlightFromCounts(
  counts: readonly { guidanceCode: string; count: number }[]
): GuidedAssistTeamHighlight | null {
  const top = [...counts].sort(
    (a, b) => b.count - a.count || a.guidanceCode.localeCompare(b.guidanceCode)
  )[0];
  if (!top || top.count < 1) return null;
  const tip = getGuidedAssistTipByCode(top.guidanceCode);
  const title = tip?.title?.trim() || top.guidanceCode.replace(/_/g, " ");
  return {
    tipCode: top.guidanceCode,
    tipTitle: title,
    useCount: top.count,
    label: `Most used tip this week: ${title}`,
  };
}

export function emptyEngagementSnapshot(): GuidedAssistEngagementSnapshot {
  return {
    streakDays: 0,
    streakMessage: null,
    progress: buildWeeklyProgressSummary({ completedCount: 0 }),
    teamHighlight: null,
    feedbackByTipCode: {},
  };
}
