import "server-only";

import { buildTodayFeedWithPresence } from "@/src/lib/fiOs/todayFeedDerive";
import { loadPresenceSnapshotForTenant } from "@/src/lib/fiOs/presence/presenceEngine.server";
import {
  isTodaySignalRevisionPollEnabled,
  isTodayRealtimeEnabledForTenant,
} from "@/src/lib/fiOs/todaySignal/todayRealtimePlan";
import { computeTodaySignalRevision } from "@/src/lib/fiOs/todaySignal/todaySignalEngine";
import {
  isTodaySignalLearningEnabledForTenant,
  loadTodaySignalLearningSummary,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearning.server";
import { flattenTodayFeedItems } from "@/src/lib/fiOs/todaySignal/todaySignalLearning";
import {
  buildLearningMetadataSamples,
  runTodaySignalRuntimeValidationChecks,
  type TodaySignalRuntimeValidationInput,
} from "@/src/lib/fiOs/todaySignal/todaySignalRuntimeValidation";
import {
  buildTodaySignalValidationWarnings,
  classifyTodaySignalValidationStatus,
  recommendTodaySignalValidationNextAction,
  summarizeTodaySignalValidationResults,
  type TodaySignalRolloutFlagsDetected,
  type TodaySignalValidationCounts,
  type TodaySignalValidationReport,
} from "@/src/lib/fiOs/todaySignal/todaySignalValidationRegistry";
import { isTodaySurfaceEnabledForTenant } from "@/src/lib/fiOs/todaySurfaceRollout.server";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { deriveWorkspaceSignalsFromOperationalDashboard } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalRegistry.server";
import { isWorkspaceSignalSyncEnabledForTenant } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalSyncRollout.server";

export type TodaySignalValidationLoadOptions = {
  now?: Date;
  includeLearningSummary?: boolean;
};

export type TodaySignalValidationInputs = {
  tenantId: string;
  feedItems: ReturnType<typeof flattenTodayFeedItems>;
  workspaceSignals: ReturnType<typeof deriveWorkspaceSignalsFromOperationalDashboard>;
  presenceSummary: Awaited<ReturnType<typeof loadPresenceSnapshotForTenant>> | null;
  revision: string;
  revisionPayloadSizeBytes: number;
  rolloutFlags: TodaySignalRolloutFlagsDetected;
  counts: TodaySignalValidationCounts;
  clientFacingPayloads: unknown[];
  learningObservationCount: number;
  learningMetadataSamples: Record<string, unknown>[];
};

export type TodaySignalBakePageModel = {
  report: TodaySignalValidationReport;
};

function detectRolloutFlags(tenantId: string): TodaySignalRolloutFlagsDetected {
  const todaySurface = isTodaySurfaceEnabledForTenant(tenantId);
  return {
    todaySurface,
    revisionPolling: isTodaySignalRevisionPollEnabled(),
    realtimeEnabled: isTodayRealtimeEnabledForTenant(tenantId),
    signalLearning: isTodaySignalLearningEnabledForTenant(tenantId),
    workspaceSignalSync: isWorkspaceSignalSyncEnabledForTenant(tenantId),
    presenceEngine: todaySurface,
  };
}

export async function loadTodaySignalValidationInputs(
  tenantId: string,
  options: TodaySignalValidationLoadOptions = {}
): Promise<TodaySignalValidationInputs> {
  const tid = tenantId.trim();
  const now = options.now ?? new Date();
  const rolloutFlags = detectRolloutFlags(tid);

  const dashboard = await loadTenantOperationalDashboard(tid, { includeReceptionBoard: true });
  const base = `/fi-admin/${tid}`;

  const { feed, presence } = buildTodayFeedWithPresence({
    base,
    dashboard,
    showCrmNav: true,
    now,
  });

  const feedItems = flattenTodayFeedItems(feed);
  const workspaceSignals = deriveWorkspaceSignalsFromOperationalDashboard({
    receptionBoard: dashboard.receptionBoard,
    staleLeads: dashboard.staleLeads,
    entityAttention: dashboard.entityAttention,
    timestamp: now.toISOString(),
  });

  const revision = computeTodaySignalRevision(dashboard);
  const revisionPayloadSizeBytes = Buffer.byteLength(
    JSON.stringify({ revision, workspaceSignals }),
    "utf8"
  );

  const learningEnabled = rolloutFlags.signalLearning;
  let learningObservationCount = 0;
  if (learningEnabled && options.includeLearningSummary !== false) {
    try {
      const fromIso = new Date(now.getTime() - 7 * 86_400_000).toISOString();
      const summary = await loadTodaySignalLearningSummary(tid, {
        fromIso,
        toIso: now.toISOString(),
      });
      learningObservationCount = summary.observationCount;
    } catch {
      learningObservationCount = 0;
    }
  }

  const presenceSummary =
    rolloutFlags.presenceEngine && presence
      ? presence
      : await loadPresenceSnapshotForTenant(tid, { dashboard, now }).catch(() => null);

  const clientFacingPayloads: unknown[] = [
    { revision },
    workspaceSignals.map((signal) => ({
      signalType: signal.signalType,
      targetRefs: signal.targetRefs,
      timestamp: signal.timestamp,
      reasonLabel: signal.reasonLabel,
    })),
    {
      operationalStatus: presenceSummary?.operationalStatus ?? null,
      escalationHints: presenceSummary?.escalationHints ?? [],
    },
  ];

  const revisionEndpointAvailable = rolloutFlags.revisionPolling || rolloutFlags.realtimeEnabled;

  const counts: TodaySignalValidationCounts = {
    todayFeedItemCount: feedItems.length,
    workspaceSignalCount: workspaceSignals.length,
    presenceSnapshotCount: presenceSummary?.snapshots.length ?? 0,
    learningEnabled,
    revisionEndpointAvailable,
  };

  return {
    tenantId: tid,
    feedItems,
    workspaceSignals,
    presenceSummary,
    revision,
    revisionPayloadSizeBytes,
    rolloutFlags,
    counts,
    clientFacingPayloads,
    learningObservationCount,
    learningMetadataSamples: buildLearningMetadataSamples(feedItems),
  };
}

export function runTodaySignalValidationChecks(
  input: TodaySignalValidationInputs & { loaderElapsedMs?: number }
): TodaySignalValidationReport {
  const checkResults = runTodaySignalRuntimeValidationChecks({
    tenantId: input.tenantId,
    feedItems: input.feedItems,
    workspaceSignals: input.workspaceSignals,
    presenceSummary: input.presenceSummary,
    clientFacingPayloads: input.clientFacingPayloads,
    learningEnabled: input.rolloutFlags.signalLearning,
    learningObservationCount: input.learningObservationCount,
    learningMetadataSamples: input.learningMetadataSamples,
    rolloutFlags: input.rolloutFlags,
    revisionEndpointAvailable: input.counts.revisionEndpointAvailable,
    revisionPayloadSizeBytes: input.revisionPayloadSizeBytes,
    loaderElapsedMs: input.loaderElapsedMs,
  } satisfies TodaySignalRuntimeValidationInput);

  const overallStatus = classifyTodaySignalValidationStatus(checkResults);
  const warnings = buildTodaySignalValidationWarnings({
    results: checkResults,
    rolloutFlags: input.rolloutFlags,
    counts: input.counts,
  });

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    rolloutFlags: input.rolloutFlags,
    counts: input.counts,
    domains: summarizeTodaySignalValidationResults(checkResults),
    warnings,
    recommendedNextAction: recommendTodaySignalValidationNextAction(
      overallStatus,
      input.rolloutFlags,
      checkResults
    ),
    loaderElapsedMs: input.loaderElapsedMs ?? 0,
  };
}

export function buildTodaySignalValidationSummary(
  report: TodaySignalValidationReport
): Pick<
  TodaySignalValidationReport,
  "overallStatus" | "warnings" | "recommendedNextAction" | "counts" | "rolloutFlags"
> {
  return {
    overallStatus: report.overallStatus,
    warnings: report.warnings,
    recommendedNextAction: report.recommendedNextAction,
    counts: report.counts,
    rolloutFlags: report.rolloutFlags,
  };
}

export async function loadTodaySignalValidationReport(
  tenantId: string,
  options: TodaySignalValidationLoadOptions = {}
): Promise<TodaySignalValidationReport> {
  const started = performance.now();
  const inputs = await loadTodaySignalValidationInputs(tenantId, options);
  const loaderElapsedMs = performance.now() - started;
  return runTodaySignalValidationChecks({ ...inputs, loaderElapsedMs });
}

export async function loadTodaySignalBakePageModel(
  tenantId: string,
  options: TodaySignalValidationLoadOptions = {}
): Promise<TodaySignalBakePageModel> {
  const report = await loadTodaySignalValidationReport(tenantId, options);
  return { report };
}

export type {
  TodaySignalValidationReport,
  TodaySignalRolloutFlagsDetected,
  TodaySignalValidationCounts,
  TodaySignalValidationOverallStatus,
} from "@/src/lib/fiOs/todaySignal/todaySignalValidationRegistry";
