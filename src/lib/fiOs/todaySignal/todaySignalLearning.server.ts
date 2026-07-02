import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import {
  deriveSignalObservationSnapshot,
  reconcileSignalObservations,
  summarizeSignalLearning,
  type TodaySignalLearningSummary,
  type TodaySignalLearningSummaryRange,
  type TodaySignalObservation,
  type TodaySignalObservationContext,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearning";

type TodaySignalObservationRow = {
  id: string;
  tenant_id: string;
  signal_key: string;
  entity_kind: string | null;
  entity_id: string | null;
  signal_type: string;
  priority_band: string | null;
  priority_score: number | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by_role: string | null;
  resolved_by_user_id: string | null;
  occurrence_count: number;
  resolution_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function isTodaySignalLearningEnabledForTenant(_tenantId: string): boolean {
  const flag = process.env.FI_TODAY_SIGNAL_LEARNING_ENABLED?.trim().toLowerCase();
  if (flag === "false") return false;
  if (flag === "true") return true;

  const allowlist = process.env.FI_TODAY_SIGNAL_LEARNING_TENANT_IDS?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (allowlist?.length) {
    return allowlist.includes(_tenantId.trim());
  }

  return false;
}

function rowToObservation(row: TodaySignalObservationRow): TodaySignalObservation {
  return {
    signalKey: row.signal_key,
    entityKind: row.entity_kind ?? undefined,
    entityId: row.entity_id ?? undefined,
    signalType: row.signal_type as TodaySignalObservation["signalType"],
    priorityBand: (row.priority_band ?? undefined) as TodaySignalObservation["priorityBand"],
    priorityScore: row.priority_score ?? undefined,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedByRole: row.resolved_by_role ?? undefined,
    resolvedByUserId: row.resolved_by_user_id ?? undefined,
    occurrenceCount: row.occurrence_count,
    resolutionSeconds: row.resolution_seconds ?? undefined,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
  };
}

async function loadOpenTodaySignalObservations(tenantId: string): Promise<TodaySignalObservation[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_today_signal_observations")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("resolved_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => rowToObservation(row as TodaySignalObservationRow));
}

async function loadTodaySignalObservationsInRange(
  tenantId: string,
  range: TodaySignalLearningSummaryRange
): Promise<TodaySignalObservation[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_today_signal_observations")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("last_seen_at", range.fromIso)
    .lte("last_seen_at", range.toIso);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => rowToObservation(row as TodaySignalObservationRow));
}

/**
 * Observe the current Today feed snapshot and reconcile open signal observations.
 * Never throws — learning must not break Today surface rendering.
 */
export async function recordTodaySignalObservationSnapshot(
  tenantId: string,
  items: readonly TodayFeedItem[],
  context: TodaySignalObservationContext = {}
): Promise<void> {
  try {
    const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
    const nowIso = context.nowIso ?? new Date().toISOString();
    const ctx = { ...context, nowIso };

    const current = deriveSignalObservationSnapshot(items, ctx);
    const previous = await loadOpenTodaySignalObservations(tid);
    const { created, updated, resolved } = reconcileSignalObservations(previous, current, ctx);

    const supabase = supabaseAdmin();

    if (created.length > 0) {
      const { error } = await supabase.from("fi_today_signal_observations").insert(
        created.map((row) => ({
          tenant_id: tid,
          signal_key: row.signalKey,
          entity_kind: row.entityKind ?? null,
          entity_id: row.entityId ?? null,
          signal_type: row.signalType,
          priority_band: row.priorityBand ?? null,
          priority_score: row.priorityScore ?? null,
          first_seen_at: row.firstSeenAt,
          last_seen_at: row.lastSeenAt,
          occurrence_count: row.occurrenceCount,
          metadata: row.metadata,
        }))
      );
      if (error) throw new Error(error.message);
    }

    for (const row of updated) {
      const { error } = await supabase
        .from("fi_today_signal_observations")
        .update({
          last_seen_at: row.lastSeenAt,
          occurrence_count: row.occurrenceCount,
          priority_band: row.priorityBand ?? null,
          priority_score: row.priorityScore ?? null,
          metadata: row.metadata,
          updated_at: nowIso,
        })
        .eq("tenant_id", tid)
        .eq("signal_key", row.signalKey)
        .is("resolved_at", null);
      if (error) throw new Error(error.message);
    }

    for (const row of resolved) {
      const { error } = await supabase
        .from("fi_today_signal_observations")
        .update({
          resolved_at: row.resolvedAt ?? null,
          resolved_by_role: row.resolvedByRole ?? null,
          resolved_by_user_id: row.resolvedByUserId ?? null,
          resolution_seconds: row.resolutionSeconds ?? null,
          updated_at: nowIso,
        })
        .eq("tenant_id", tid)
        .eq("signal_key", row.signalKey)
        .is("resolved_at", null);
      if (error) throw new Error(error.message);
    }

    if (
      process.env.FI_TODAY_SIGNAL_LEARNING_DEBUG?.trim().toLowerCase() === "true" &&
      (created.length > 0 || updated.length > 0 || resolved.length > 0)
    ) {
      // eslint-disable-next-line no-console -- internal D6B.5 debug surface only.
      console.info("[today-signal-learning] snapshot recorded", {
        tenantId: tid,
        created: created.length,
        updated: updated.length,
        resolved: resolved.length,
      });
    }
  } catch (e) {
    console.error(
      "[recordTodaySignalObservationSnapshot]",
      e instanceof Error ? e.message : "unknown error"
    );
  }
}

/** Fire-and-forget wrapper for Today derivation hooks. */
export function recordTodaySignalObservationSnapshotSafe(
  tenantId: string,
  items: readonly TodayFeedItem[],
  context: TodaySignalObservationContext = {}
): void {
  if (!isTodaySignalLearningEnabledForTenant(tenantId)) return;
  void recordTodaySignalObservationSnapshot(tenantId, items, context);
}

export async function loadTodaySignalLearningSummary(
  tenantId: string,
  range: TodaySignalLearningSummaryRange,
  opts: {
    criticalUnresolvedThresholdSeconds?: number;
    recurrenceExpectationCount?: number;
    nowIso?: string;
  } = {}
): Promise<TodaySignalLearningSummary> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const observations = await loadTodaySignalObservationsInRange(tid, range);
  return summarizeSignalLearning(observations, { range, ...opts });
}
