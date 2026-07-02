/**
 * FI-UX-REBUILD D6F — pure runtime validation helpers for the D6 Today signal layer.
 */

import type { PresenceSummary } from "@/src/lib/fiOs/presence/presenceTypes";
import type { TodayFeedBucket, TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import { shouldSkipDuplicateRevisionTick } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalSyncCore";
import type { WorkspaceSignalPayload } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalRegistry";
import { classifyTodaySignalPriority } from "@/src/lib/fiOs/todaySignal/todaySignalPriority";
import { sanitizeSignalLearningMetadata } from "@/src/lib/fiOs/todaySignal/todaySignalLearning";
import type {
  TodaySignalRolloutFlagsDetected,
  TodaySignalValidationCheckResult,
  TodaySignalValidationStatus,
} from "@/src/lib/fiOs/todaySignal/todaySignalValidationRegistry";

export const TODAY_FEED_BUCKETS: readonly TodayFeedBucket[] = [
  "right_now",
  "up_next",
  "coming_up",
];

export const FORBIDDEN_CLIENT_PAYLOAD_KEYS: readonly string[] = [
  "patientName",
  "displayName",
  "amount",
  "pathologyText",
  "clinicalNotes",
  "consultationNotes",
  "personLabel",
  "priorityReasons",
  "metadata",
] as const;

export const PRESENCE_BANNED_WORDS: readonly string[] = [
  "absent",
  "late",
  "failed",
  "not working",
  "no-show",
] as const;

export const WORKSPACE_SIGNAL_COUNT_WARN_THRESHOLD = 50;
export const VALIDATION_LOADER_BUDGET_MS = 500;
export const RUNTIME_VALIDATION_BUDGET_MS = 50;
export const REVISION_PAYLOAD_WARN_BYTES = 16_384;

export type TodaySignalRuntimeValidationInput = {
  tenantId: string;
  feedItems: readonly TodayFeedItem[];
  workspaceSignals: readonly WorkspaceSignalPayload[];
  presenceSummary: PresenceSummary | null;
  clientFacingPayloads: readonly unknown[];
  learningEnabled: boolean;
  learningObservationCount: number;
  learningMetadataSamples: readonly Record<string, unknown>[];
  rolloutFlags: TodaySignalRolloutFlagsDetected;
  revisionEndpointAvailable: boolean;
  revisionPayloadSizeBytes: number;
  loaderElapsedMs?: number;
};

function result(
  checkId: string,
  domain: TodaySignalValidationCheckResult["domain"],
  status: TodaySignalValidationStatus,
  message?: string
): TodaySignalValidationCheckResult {
  return { checkId, domain, status, message };
}

function isActionableFeedItem(item: TodayFeedItem): boolean {
  return Boolean(item.actionHint?.trim()) || item.severity !== "normal" || !item.autoResolves;
}

function collectForbiddenKeyHits(
  value: unknown,
  forbidden: ReadonlySet<string>,
  hits: string[] = []
): string[] {
  if (value === null || value === undefined) return hits;

  if (Array.isArray(value)) {
    for (const entry of value) collectForbiddenKeyHits(entry, forbidden, hits);
    return hits;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (forbidden.has(key)) hits.push(key);
      collectForbiddenKeyHits(nested, forbidden, hits);
    }
  }

  return hits;
}

function textContainsBannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of PRESENCE_BANNED_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

export function validateTodayFeedSafety(
  items: readonly TodayFeedItem[]
): TodaySignalValidationCheckResult[] {
  const results: TodaySignalValidationCheckResult[] = [];
  const bucketSet = new Set(TODAY_FEED_BUCKETS);

  let missingId = false;
  let missingHref = false;
  let invalidBucket = false;
  let invalidScore = false;
  let bandMismatch = false;

  for (const item of items) {
    if (!item.id?.trim()) missingId = true;
    if (isActionableFeedItem(item) && !item.href?.trim()) missingHref = true;
    if (!bucketSet.has(item.bucket)) invalidBucket = true;
    if (!Number.isFinite(item.priorityScore) || item.priorityScore < 0 || item.priorityScore > 100) {
      invalidScore = true;
    }
    if (item.priorityBand) {
      const expected = classifyTodaySignalPriority(item.priorityScore);
      if (expected !== item.priorityBand) bandMismatch = true;
    }
  }

  results.push(
    result(
      "feed.missing_id",
      "refresh_behaviour",
      missingId ? "fail" : items.length === 0 ? "not_applicable" : "pass"
    ),
    result(
      "feed.missing_href",
      "refresh_behaviour",
      missingHref ? "fail" : items.length === 0 ? "not_applicable" : "pass"
    ),
    result(
      "feed.invalid_bucket",
      "refresh_behaviour",
      invalidBucket ? "fail" : items.length === 0 ? "not_applicable" : "pass"
    ),
    result(
      "feed.invalid_priority_score",
      "priority_scoring",
      invalidScore ? "fail" : items.length === 0 ? "not_applicable" : "pass"
    ),
    result(
      "feed.priority_band_mismatch",
      "priority_scoring",
      bandMismatch ? "fail" : items.length === 0 ? "not_applicable" : "pass"
    )
  );

  return results;
}

export function validateTodayFeedPrivacy(
  payloads: readonly unknown[]
): TodaySignalValidationCheckResult[] {
  if (payloads.length === 0) {
    return [
      result("privacy.forbidden_keys", "privacy_safety", "not_applicable", "No client payloads supplied."),
    ];
  }

  const forbidden = new Set(FORBIDDEN_CLIENT_PAYLOAD_KEYS);
  const hits = new Set<string>();
  for (const payload of payloads) {
    for (const key of collectForbiddenKeyHits(payload, forbidden)) hits.add(key);
  }

  return [
    result(
      "privacy.forbidden_keys",
      "privacy_safety",
      hits.size > 0 ? "fail" : "pass",
      hits.size > 0 ? `Forbidden keys detected: ${[...hits].join(", ")}` : undefined
    ),
  ];
}

export function validatePresenceSafety(
  summary: PresenceSummary | null
): TodaySignalValidationCheckResult[] {
  if (!summary) {
    return [
      result("presence.actor_id_exposed", "presence_context", "not_applicable"),
      result("presence.banned_wording", "presence_context", "not_applicable"),
    ];
  }

  const serialized = JSON.stringify({
    operationalStatus: summary.operationalStatus,
    snapshots: summary.snapshots.map((snapshot) => ({
      safeLabel: snapshot.safeLabel,
      reasonLabel: snapshot.reasonLabel,
      state: snapshot.state,
      signalKind: snapshot.signalKind,
      confidence: snapshot.confidence,
    })),
    escalationHints: summary.escalationHints,
  });

  const actorIdExposed = serialized.includes('"actorId"') || serialized.includes("actorId");

  const textParts = [
    summary.operationalStatus.headline,
    summary.operationalStatus.subline ?? "",
    ...summary.operationalStatus.chips.map((chip) => chip.label),
    ...summary.snapshots.flatMap((snapshot) => [snapshot.safeLabel, snapshot.reasonLabel]),
  ];

  let bannedWord: string | null = null;
  for (const part of textParts) {
    bannedWord = textContainsBannedWord(part);
    if (bannedWord) break;
  }

  return [
    result(
      "presence.actor_id_exposed",
      "presence_context",
      actorIdExposed ? "fail" : "pass"
    ),
    result(
      "presence.banned_wording",
      "presence_context",
      bannedWord ? "fail" : "pass",
      bannedWord ? `Banned wording detected: "${bannedWord}"` : undefined
    ),
  ];
}

export function validateWorkspaceSyncSafety(input: {
  signals: readonly WorkspaceSignalPayload[];
  syncEnabled: boolean;
}): TodaySignalValidationCheckResult[] {
  const { signals, syncEnabled } = input;

  if (!syncEnabled) {
    return [
      result("workspace.calendar_mapping", "workspace_sync", "not_applicable"),
      result("workspace.phi_payload", "workspace_sync", "not_applicable"),
      result("workspace.count_bounded", "workspace_sync", "not_applicable"),
      result("workspace.refresh_dedupe", "workspace_sync", "not_applicable"),
    ];
  }

  const forbidden = new Set(FORBIDDEN_CLIENT_PAYLOAD_KEYS);
  const phiHits = new Set<string>();
  let calendarMapping = false;

  for (const signal of signals) {
    for (const key of collectForbiddenKeyHits(signal, forbidden)) phiHits.add(key);
    for (const ref of signal.targetRefs) {
      if (String(ref.kind) === "calendar") calendarMapping = true;
    }
    if (signal.reasonLabel.toLowerCase().includes("calendar")) calendarMapping = true;
  }

  const dedupeActive = shouldSkipDuplicateRevisionTick("abc", "abc") === true;

  return [
    result(
      "workspace.calendar_mapping",
      "workspace_sync",
      calendarMapping ? "fail" : "pass"
    ),
    result(
      "workspace.phi_payload",
      "workspace_sync",
      phiHits.size > 0 ? "fail" : "pass",
      phiHits.size > 0 ? `Forbidden keys in workspace signals: ${[...phiHits].join(", ")}` : undefined
    ),
    result(
      "workspace.count_bounded",
      "workspace_sync",
      signals.length > WORKSPACE_SIGNAL_COUNT_WARN_THRESHOLD
        ? "watch"
        : "pass",
      signals.length > WORKSPACE_SIGNAL_COUNT_WARN_THRESHOLD
        ? `Workspace signal count ${signals.length} exceeds ${WORKSPACE_SIGNAL_COUNT_WARN_THRESHOLD}.`
        : undefined
    ),
    result(
      "workspace.refresh_dedupe",
      "workspace_sync",
      dedupeActive ? "pass" : "watch",
      dedupeActive ? undefined : "Revision dedupe helper did not confirm duplicate skip behaviour."
    ),
  ];
}

export function validateLearningSafety(input: {
  enabled: boolean;
  observationCount: number;
  metadataSamples: readonly Record<string, unknown>[];
}): TodaySignalValidationCheckResult[] {
  if (!input.enabled) {
    return [
      result(
        "learning.disabled_clean",
        "signal_learning",
        "pass",
        "Signal learning is disabled for this tenant."
      ),
      result("learning.metadata_sanitized", "signal_learning", "not_applicable"),
    ];
  }

  const forbidden = new Set([
    ...FORBIDDEN_CLIENT_PAYLOAD_KEYS,
    "personLabel",
    "actionLabel",
    "detailLine",
    "href",
    "patientLabel",
    "displayName",
    "email",
    "phone",
    "clinicalInterpretation",
  ]);

  const hits = new Set<string>();
  for (const sample of input.metadataSamples) {
    for (const key of collectForbiddenKeyHits(sample, forbidden)) hits.add(key);
  }

  return [
    result(
      "learning.disabled_clean",
      "signal_learning",
      input.observationCount === 0 ? "watch" : "pass",
      input.observationCount === 0
        ? "Signal learning is enabled but has limited observations."
        : undefined
    ),
    result(
      "learning.metadata_sanitized",
      "signal_learning",
      hits.size > 0 ? "fail" : "pass",
      hits.size > 0 ? `Learning metadata contains blocked keys: ${[...hits].join(", ")}` : undefined
    ),
  ];
}

export function validateRolloutSafety(
  flags: TodaySignalRolloutFlagsDetected,
  revisionEndpointAvailable: boolean
): TodaySignalValidationCheckResult[] {
  let independentStatus: TodaySignalValidationStatus = "pass";
  let independentMessage: string | undefined;
  if (!flags.todaySurface) {
    independentStatus = "not_applicable";
    independentMessage = "Today surface is off; sub-capabilities are inactive.";
  }

  let rolloutStatus: TodaySignalValidationStatus = "pass";
  if (flags.workspaceSignalSync && !flags.todaySurface) rolloutStatus = "watch";
  if (flags.signalLearning && !flags.todaySurface) rolloutStatus = "watch";

  let realtimeStatus: TodaySignalValidationStatus = "pass";
  let realtimeMessage: string | undefined;
  if (!flags.realtimeEnabled && revisionEndpointAvailable) {
    realtimeStatus = "watch";
    realtimeMessage = "Realtime is disabled; polling fallback is active.";
  } else if (!flags.realtimeEnabled && !revisionEndpointAvailable && flags.todaySurface) {
    realtimeStatus = "watch";
    realtimeMessage = "Neither Realtime nor revision polling is enabled.";
  } else if (flags.realtimeEnabled && !revisionEndpointAvailable) {
    realtimeStatus = "watch";
    realtimeMessage = "Realtime is enabled without revision polling fallback.";
  }

  return [
    result(
      "rollout.independent_fail_soft",
      "rollout_flag_consistency",
      independentStatus,
      independentMessage
    ),
    result(
      "rollout.realtime_polling_fallback",
      "rollout_flag_consistency",
      realtimeStatus,
      realtimeMessage
    ),
    result(
      "rollout.flag_consistency",
      "rollout_flag_consistency",
      rolloutStatus,
      rolloutStatus === "watch"
        ? "Some D6 capabilities are enabled without the Today surface."
        : undefined
    ),
  ];
}

export function validateTenantIsolation(input: {
  tenantId: string;
  presenceSummary: PresenceSummary | null;
}): TodaySignalValidationCheckResult[] {
  if (!input.presenceSummary) {
    return [result("tenant.isolation", "tenant_isolation", "not_applicable")];
  }

  const tid = input.tenantId.trim().toLowerCase();
  const mismatches =
    input.presenceSummary.tenantId.trim().toLowerCase() !== tid ||
    input.presenceSummary.snapshots.some(
      (snapshot) => snapshot.tenantId.trim().toLowerCase() !== tid
    );

  return [
    result(
      "tenant.isolation",
      "tenant_isolation",
      mismatches ? "fail" : "pass",
      mismatches ? "Presence snapshots include a mismatched tenant id." : undefined
    ),
  ];
}

export function validatePerformanceBudget(input: {
  loaderElapsedMs: number;
  workspaceSignalCount: number;
  revisionPayloadSizeBytes: number;
}): TodaySignalValidationCheckResult[] {
  return [
    result(
      "performance.validation_loader_budget",
      "performance_budget",
      input.loaderElapsedMs > VALIDATION_LOADER_BUDGET_MS ? "watch" : "pass",
      input.loaderElapsedMs > VALIDATION_LOADER_BUDGET_MS
        ? `Validation loader took ${Math.round(input.loaderElapsedMs)}ms (target ${VALIDATION_LOADER_BUDGET_MS}ms).`
        : undefined
    ),
    result(
      "performance.workspace_signal_count",
      "performance_budget",
      input.workspaceSignalCount > WORKSPACE_SIGNAL_COUNT_WARN_THRESHOLD ? "watch" : "pass",
      input.workspaceSignalCount > WORKSPACE_SIGNAL_COUNT_WARN_THRESHOLD
        ? `Workspace signal count ${input.workspaceSignalCount} exceeds ${WORKSPACE_SIGNAL_COUNT_WARN_THRESHOLD}.`
        : undefined
    ),
    result(
      "performance.revision_payload_size",
      "performance_budget",
      input.revisionPayloadSizeBytes > REVISION_PAYLOAD_WARN_BYTES ? "watch" : "pass",
      input.revisionPayloadSizeBytes > REVISION_PAYLOAD_WARN_BYTES
        ? `Revision payload is ${input.revisionPayloadSizeBytes} bytes.`
        : undefined
    ),
  ];
}

export function buildLearningMetadataSamples(
  feedItems: readonly TodayFeedItem[]
): Record<string, unknown>[] {
  return feedItems.slice(0, 12).map((item) => sanitizeSignalLearningMetadata(item));
}

export function runTodaySignalRuntimeValidationChecks(
  input: TodaySignalRuntimeValidationInput
): TodaySignalValidationCheckResult[] {
  const results = [
    ...validateTodayFeedSafety(input.feedItems),
    ...validateTodayFeedPrivacy(input.clientFacingPayloads),
    ...validatePresenceSafety(input.presenceSummary),
    ...validateWorkspaceSyncSafety({
      signals: input.workspaceSignals,
      syncEnabled: input.rolloutFlags.workspaceSignalSync,
    }),
    ...validateLearningSafety({
      enabled: input.learningEnabled,
      observationCount: input.learningObservationCount,
      metadataSamples: input.learningMetadataSamples,
    }),
    ...validateRolloutSafety(input.rolloutFlags, input.revisionEndpointAvailable),
    ...validateTenantIsolation({
      tenantId: input.tenantId,
      presenceSummary: input.presenceSummary,
    }),
    ...validatePerformanceBudget({
      loaderElapsedMs: input.loaderElapsedMs ?? 0,
      workspaceSignalCount: input.workspaceSignals.length,
      revisionPayloadSizeBytes: input.revisionPayloadSizeBytes,
    }),
  ];

  return results;
}
