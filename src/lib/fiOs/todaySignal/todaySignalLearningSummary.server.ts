import "server-only";

import {
  buildTodaySignalLearningSummaryView,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary";
import {
  isTodaySignalLearningEnabledForTenant,
  loadTodaySignalLearningSummary,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearning.server";

import type {
  TodaySignalLearningPageModel,
  TodaySignalLearningSummaryLoadOptions,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary";

function buildRange(opts: TodaySignalLearningSummaryLoadOptions): {
  fromIso: string;
  toIso: string;
  rangeDays: number;
} {
  const rangeDays = Math.max(1, opts.rangeDays ?? 7);
  const now = opts.now ?? new Date();
  const toIso = now.toISOString();
  const from = new Date(now.getTime() - rangeDays * 86_400_000);
  return { fromIso: from.toISOString(), toIso, rangeDays };
}

export async function loadTodaySignalLearningSummaryForTenant(
  tenantId: string,
  options: TodaySignalLearningSummaryLoadOptions = {}
): Promise<TodaySignalLearningPageModel> {
  const tid = tenantId.trim();
  if (!isTodaySignalLearningEnabledForTenant(tid)) {
    return { status: "disabled" };
  }

  const { fromIso, toIso, rangeDays } = buildRange(options);
  const summary = await loadTodaySignalLearningSummary(
    tid,
    { fromIso, toIso },
    {
      criticalUnresolvedThresholdSeconds: options.criticalThresholdSeconds ?? 3600,
      recurrenceExpectationCount: options.recurringThreshold ?? 3,
    }
  );

  if (summary.observationCount === 0) {
    return { status: "empty", rangeDays };
  }

  const view = buildTodaySignalLearningSummaryView(summary, {
    rangeDays,
    recurringThreshold: options.recurringThreshold,
  });

  return { status: "ready", view };
}

export {
  assertTodaySignalLearningViewPrivacy,
  buildSignalLearningCards,
  buildSignalLearningWarnings,
  buildTodaySignalLearningSummaryView,
  classifySignalLearningHealth,
  formatSignalLearningDuration,
  safeRoleLabel,
  safeSignalTypeLabel,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary";

export type {
  TodaySignalLearningPageModel,
  TodaySignalLearningSummaryLoadOptions,
  TodaySignalLearningSummaryView,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary";
