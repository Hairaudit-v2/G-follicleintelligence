import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  isEnqueueShadowEventNameAllowlisted,
  isGovernedPrivacyFilterSafeForShadowEnqueue,
} from "./governedReplayAllowlist";
import { canExecuteGovernedReplayRun } from "./governedReplayEnv";
import type { IntelligenceEventLogReplayFilters } from "./intelligenceEventLogReplayTypes";
import type {
  FiIntelligenceReplayRunMode,
  FiIntelligenceReplayRunRow,
} from "./intelligenceReplayRunTypes";
import { filtersFromReplayRunRow } from "./intelligenceReplayRunTypes";
import { replayIntelligenceEventLogs } from "./replayIntelligenceEventLogs.server";

export type IntelligenceReplayRunServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; warnings?: string[] };

export type CreateReplayRunDraftInput = {
  filters: IntelligenceEventLogReplayFilters;
  mode: FiIntelligenceReplayRunMode;
  requestedBy?: string | null;
  supabaseClientForTests?: SupabaseClient;
  omitPlatformAdminAssertForOperatorCli?: boolean;
  env?: Record<string, string | undefined>;
  nodeEnv?: string;
};

function assertAdmin(omit?: boolean): Promise<void> {
  if (omit) return Promise.resolve();
  return import("@/src/lib/fiOs/fiOsPlatformSystemGate.server").then((m) =>
    m.assertFiPlatformAdminSystemAccess()
  );
}

function validateDraftPolicies(
  mode: FiIntelligenceReplayRunMode,
  filters: IntelligenceEventLogReplayFilters
): IntelligenceReplayRunServiceResult<void> {
  if (mode === "enqueue_shadow") {
    if (!isEnqueueShadowEventNameAllowlisted(filters.event_name ?? null)) {
      return {
        ok: false,
        code: "enqueue_shadow_event_not_allowlisted",
        message:
          "enqueue_shadow requires an allow-listed event_name (see GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST) present in intelligence-core.",
      };
    }
    if (!filters.privacy_level || !filters.privacy_level.trim()) {
      return {
        ok: false,
        code: "enqueue_shadow_privacy_required",
        message:
          "enqueue_shadow requires an explicit privacy_level filter that excludes operational_clinical risk tier.",
      };
    }
    if (!isGovernedPrivacyFilterSafeForShadowEnqueue(filters.privacy_level)) {
      return {
        ok: false,
        code: "enqueue_shadow_privacy_blocked",
        message: "operational_clinical is not permitted for governed enqueue_shadow replay runs.",
      };
    }
  }

  return { ok: true, data: undefined };
}

export async function createReplayRunDraft(
  input: CreateReplayRunDraftInput
): Promise<IntelligenceReplayRunServiceResult<{ id: string }>> {
  await assertAdmin(input.omitPlatformAdminAssertForOperatorCli);

  const policy = validateDraftPolicies(input.mode, input.filters);
  if (!policy.ok) return policy;

  const supabase = input.supabaseClientForTests ?? supabaseAdmin();
  const row = {
    requested_by: input.requestedBy ?? null,
    approval_status: "draft" as const,
    replay_mode: input.mode,
    event_name: input.filters.event_name ?? null,
    source: input.filters.source ?? null,
    status_filter: input.filters.status ?? null,
    privacy_level: input.filters.privacy_level ?? null,
    since: input.filters.since ?? null,
    until: input.filters.until ?? null,
    correlation_id: input.filters.correlation_id ?? null,
    limit_count: input.filters.limit ?? 25,
  };

  const { data, error } = await supabase
    .from("fi_intelligence_replay_runs")
    .insert(row)
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, code: "insert_failed", message: error?.message ?? "insert_failed" };
  }
  return { ok: true, data: { id: data.id as string } };
}

export async function submitReplayRunForApproval(
  runId: string,
  actorId: string | null,
  options?: {
    supabaseClientForTests?: SupabaseClient;
    omitPlatformAdminAssertForOperatorCli?: boolean;
  }
): Promise<IntelligenceReplayRunServiceResult<{ id: string }>> {
  await assertAdmin(options?.omitPlatformAdminAssertForOperatorCli);

  const supabase = options?.supabaseClientForTests ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_intelligence_replay_runs")
    .select("id, approval_status, summary")
    .eq("id", runId)
    .maybeSingle();

  if (loadErr || !existing) {
    return { ok: false, code: "not_found", message: loadErr?.message ?? "run not found" };
  }
  if (existing.approval_status !== "draft") {
    return {
      ok: false,
      code: "invalid_state",
      message: `expected draft, got ${existing.approval_status}`,
    };
  }

  const prevSummary =
    existing.summary && typeof existing.summary === "object" && !Array.isArray(existing.summary)
      ? (existing.summary as Record<string, unknown>)
      : {};
  const patch: Record<string, unknown> = {
    approval_status: "pending_approval",
    summary: {
      ...prevSummary,
      submitted_by: actorId,
      submitted_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("fi_intelligence_replay_runs")
    .update(patch)
    .eq("id", runId);

  if (error) {
    return { ok: false, code: "update_failed", message: error.message };
  }
  return { ok: true, data: { id: runId } };
}

export async function approveReplayRun(
  runId: string,
  actorId: string | null,
  options?: {
    supabaseClientForTests?: SupabaseClient;
    omitPlatformAdminAssertForOperatorCli?: boolean;
  }
): Promise<IntelligenceReplayRunServiceResult<{ id: string }>> {
  await assertAdmin(options?.omitPlatformAdminAssertForOperatorCli);

  const supabase = options?.supabaseClientForTests ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_intelligence_replay_runs")
    .select("id, approval_status")
    .eq("id", runId)
    .maybeSingle();

  if (loadErr || !existing) {
    return { ok: false, code: "not_found", message: loadErr?.message ?? "run not found" };
  }
  if (existing.approval_status !== "pending_approval") {
    return {
      ok: false,
      code: "invalid_state",
      message: `expected pending_approval, got ${existing.approval_status}`,
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_intelligence_replay_runs")
    .update({
      approval_status: "approved",
      approved_by: actorId,
      approved_at: now,
    })
    .eq("id", runId);

  if (error) {
    return { ok: false, code: "update_failed", message: error.message };
  }
  return { ok: true, data: { id: runId } };
}

export async function rejectReplayRun(
  runId: string,
  actorId: string | null,
  reason: string | undefined,
  options?: {
    supabaseClientForTests?: SupabaseClient;
    omitPlatformAdminAssertForOperatorCli?: boolean;
  }
): Promise<IntelligenceReplayRunServiceResult<{ id: string }>> {
  await assertAdmin(options?.omitPlatformAdminAssertForOperatorCli);

  const supabase = options?.supabaseClientForTests ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_intelligence_replay_runs")
    .select("id, approval_status, summary")
    .eq("id", runId)
    .maybeSingle();

  if (loadErr || !existing) {
    return { ok: false, code: "not_found", message: loadErr?.message ?? "run not found" };
  }
  if (existing.approval_status !== "pending_approval") {
    return {
      ok: false,
      code: "invalid_state",
      message: `expected pending_approval, got ${existing.approval_status}`,
    };
  }

  const summary = {
    ...(existing.summary as Record<string, unknown>),
    rejection_reason: reason ?? null,
    rejected_by: actorId,
  };

  const { error } = await supabase
    .from("fi_intelligence_replay_runs")
    .update({
      approval_status: "rejected",
      summary,
    })
    .eq("id", runId);

  if (error) {
    return { ok: false, code: "update_failed", message: error.message };
  }
  return { ok: true, data: { id: runId } };
}

function warningLines(w: { code: string; message: string }[]): string[] {
  return w.map((x) => `${x.code}: ${x.message}`);
}

function countsFromReplay(
  mode: FiIntelligenceReplayRunMode,
  summary: import("./intelligenceEventLogReplayTypes").IntelligenceEventLogReplaySummary,
  loadError?: string
): { candidate: number; processed: number; failed: number } {
  const candidate = summary.candidates_loaded ?? 0;
  if (loadError) {
    return { candidate: 0, processed: 0, failed: 1 };
  }
  if (mode === "dry_run") {
    return { candidate, processed: candidate, failed: 0 };
  }
  if (mode === "validate_only") {
    const ok = summary.validated_ok ?? 0;
    const bad = summary.validated_failed ?? 0;
    return { candidate, processed: ok + bad, failed: bad };
  }
  if (mode === "enqueue_shadow") {
    const enq = summary.shadow_enqueued ?? 0;
    const other = summary.shadow_skipped_other ?? 0;
    return { candidate, processed: enq, failed: other };
  }
  return { candidate: 0, processed: 0, failed: 0 };
}

export async function executeApprovedReplayRun(
  runId: string,
  actorId: string | null,
  options?: {
    supabaseClientForTests?: SupabaseClient;
    omitPlatformAdminAssertForOperatorCli?: boolean;
    env?: Record<string, string | undefined>;
    nodeEnv?: string;
  }
): Promise<
  IntelligenceReplayRunServiceResult<{
    replay_summary: import("./intelligenceEventLogReplayTypes").IntelligenceEventLogReplaySummary;
    warnings: import("./intelligenceEventLogReplayTypes").IntelligenceEventLogReplayWarning[];
    load_error?: string;
  }>
> {
  await assertAdmin(options?.omitPlatformAdminAssertForOperatorCli);

  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "";

  if (!canExecuteGovernedReplayRun({ env, nodeEnv })) {
    return {
      ok: false,
      code: "governed_replay_disabled",
      message: "FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED must be 1 to execute governed replay runs.",
    };
  }

  const supabase = options?.supabaseClientForTests ?? supabaseAdmin();
  const { data: row, error: loadErr } = await supabase
    .from("fi_intelligence_replay_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (loadErr || !row) {
    return { ok: false, code: "not_found", message: loadErr?.message ?? "run not found" };
  }

  const run = row as FiIntelligenceReplayRunRow;
  const baseSummary =
    run.summary && typeof run.summary === "object" && !Array.isArray(run.summary)
      ? ({ ...run.summary } as Record<string, unknown>)
      : {};

  if (run.approval_status !== "approved") {
    return {
      ok: false,
      code: "invalid_state",
      message: `expected approved, got ${run.approval_status}`,
    };
  }

  if (run.replay_mode === "dispatch_future") {
    return {
      ok: false,
      code: "dispatch_future_blocked",
      message:
        "dispatch_future is not implemented in Stage 15 and cannot execute. No downstream dispatch is performed.",
    };
  }

  const filters = filtersFromReplayRunRow(run);

  if (run.replay_mode === "enqueue_shadow") {
    if (!isEnqueueShadowEventNameAllowlisted(run.event_name)) {
      const e = await supabase
        .from("fi_intelligence_replay_runs")
        .update({
          approval_status: "failed",
          completed_at: new Date().toISOString(),
          summary: {
            ...baseSummary,
            execute_blocked: "enqueue_shadow_event_not_allowlisted",
            executed_by: actorId,
          },
        })
        .eq("id", runId);
      if (e.error) {
        return { ok: false, code: "update_failed", message: e.error.message };
      }
      return {
        ok: false,
        code: "enqueue_shadow_event_not_allowlisted",
        message: "Run row failed validation at execute time.",
      };
    }
    if (!isGovernedPrivacyFilterSafeForShadowEnqueue(run.privacy_level)) {
      const e = await supabase
        .from("fi_intelligence_replay_runs")
        .update({
          approval_status: "failed",
          completed_at: new Date().toISOString(),
          summary: {
            ...baseSummary,
            execute_blocked: "enqueue_shadow_privacy_blocked",
            executed_by: actorId,
          },
        })
        .eq("id", runId);
      if (e.error) {
        return { ok: false, code: "update_failed", message: e.error.message };
      }
      return {
        ok: false,
        code: "enqueue_shadow_privacy_blocked",
        message: "operational_clinical is blocked for shadow enqueue.",
      };
    }
  }

  const replay = await replayIntelligenceEventLogs({
    mode: run.replay_mode,
    filters,
    env,
    nodeEnv,
    supabaseClientForTests: options?.supabaseClientForTests,
    omitPlatformAdminAssertForOperatorCli: options?.omitPlatformAdminAssertForOperatorCli,
  });

  const { candidate, processed, failed } = countsFromReplay(
    run.replay_mode,
    replay.summary,
    replay.load_error
  );
  const warningLinesOut = warningLines(replay.warnings);
  const finalStatus = replay.load_error || failed > 0 ? "failed" : "completed";
  const summaryOut = {
    ...baseSummary,
    replay_summary: replay.summary,
    load_error: replay.load_error,
    executed_by: actorId,
    executed_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabase
    .from("fi_intelligence_replay_runs")
    .update({
      approval_status: finalStatus,
      completed_at: new Date().toISOString(),
      candidate_count: candidate,
      processed_count: processed,
      failed_count: failed,
      warning_count: replay.warnings.length,
      summary: summaryOut,
      warnings: warningLinesOut,
    })
    .eq("id", runId);

  if (upErr) {
    return { ok: false, code: "update_failed", message: upErr.message };
  }

  return {
    ok: true,
    data: {
      replay_summary: replay.summary,
      warnings: replay.warnings,
      load_error: replay.load_error,
    },
  };
}
