import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hubspotPostJson, HubspotReadError } from "./hubspotBackupEngine.server";
import { stageHubspotNotesPage } from "./hubspotEngagementBackupEngine.server";
import {
  applyTiebreakerCursor,
  canAdvanceIncrementalWatermark,
  emptyIncrementalCheckpoint,
  emptyIncrementalCounters,
  filterNotesInRange,
  hubspotSearchDatetimeMs,
  HUBSPOT_INCREMENTAL_MILESTONE,
  HUBSPOT_INCREMENTAL_SOURCE_SYSTEM,
  HUBSPOT_INCREMENTAL_STUCK_AGE_MS,
  isHubspotIncrementalDataset,
  isIncrementalRunStuck,
  nextWatermarkFromCutoffTo,
  noteUpdatedAtMs,
  parseIncrementalCheckpoint,
  parseIncrementalRange,
  type HubspotIncrementalDataset,
  type IncrementalCheckpoint,
  type IncrementalCounters,
  type IncrementalRange,
  type NoteTimestampCandidate,
  classifyUpsertOutcome,
} from "./hubspotIncrementalBackupCore";

const NOTES_SEARCH_PATH = "/crm/v3/objects/notes/search";
const NOTES_PROPERTIES = [
  "hs_note_body",
  "hs_timestamp",
  "hubspot_owner_id",
  "hs_attachment_ids",
  "hs_object_id",
  "hs_lastmodifieddate",
];

type RawNote = NoteTimestampCandidate & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  properties?: Record<string, unknown>;
  associations?: Record<string, { results?: { id?: string; type?: string }[] }>;
  [key: string]: unknown;
};

type SearchPage = {
  results?: RawNote[];
  paging?: { next?: { after?: string } };
  total?: number;
};

export type IncrementalBackupAuth = {
  actorAuthUserId: string;
  fiUserId: string | null;
  actorLabel: string;
};

export type RunIncrementalNotesBackupInput = {
  supabase: SupabaseClient;
  accessToken: string;
  tenantId: string;
  integrationId: string;
  portalId: string | null;
  auth: IncrementalBackupAuth;
  cutoffFrom: string;
  cutoffTo: string;
  dataset?: string;
  /** When set, resume this started incremental run (same cutoffs required). */
  resumeRunId?: string | null;
  fetchImpl?: typeof fetch;
  authSessionId?: string | null;
};

export type RunIncrementalNotesBackupResult =
  | {
      ok: true;
      runId: string;
      status: "completed" | "partial" | "failed";
      verificationState: "passed" | "failed" | "pending";
      watermarkAdvanced: boolean;
      counters: IncrementalCounters;
      cutoffFrom: string;
      cutoffTo: string;
      emptyRange: boolean;
    }
  | { ok: false; error: string; exitHint?: "conflict" | "validation" | "failed" };

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

async function recordIncrementalEvent(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    authSessionId: string | null;
    auth: IncrementalBackupAuth;
    event: string;
    outcome: "success" | "warning" | "error" | "info";
    detail: Record<string, unknown>;
  }
): Promise<void> {
  if (!input.authSessionId) return;
  await supabase.from("fi_external_connector_verification_events").insert({
    auth_session_id: input.authSessionId,
    integration_id: input.integrationId,
    tenant_id: input.tenantId,
    provider: "hubspot",
    auth_status: "verified",
    outcome: input.outcome,
    actor_auth_user_id: input.auth.actorAuthUserId,
    actor_fi_user_id: input.auth.fiUserId,
    actor_label: input.auth.actorLabel,
    detail: {
      verification_mode: "incremental_backup",
      milestone: HUBSPOT_INCREMENTAL_MILESTONE,
      event: input.event,
      ...input.detail,
    },
    provider_payload: {
      verification_mode: "incremental_backup",
      event: input.event,
      response_bodies_retained: false,
      note_bodies_retained: false,
    },
  });
}

async function loadAuthSessionId(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("fi_external_connector_auth_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function persistCheckpoint(
  supabase: SupabaseClient,
  runId: string,
  checkpoint: IncrementalCheckpoint,
  counters: IncrementalCounters
): Promise<void> {
  const { error } = await supabase
    .from("fi_external_hubspot_sync_runs")
    .update({
      incremental_checkpoint: checkpoint,
      last_checkpoint_at: new Date().toISOString(),
      engagement_counters: { notes_incremental: counters },
    })
    .eq("id", runId)
    .eq("status", "started");
  if (error) {
    const { error: retry } = await supabase
      .from("fi_external_hubspot_sync_runs")
      .update({
        incremental_checkpoint: checkpoint,
        last_checkpoint_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("status", "started");
    if (retry) throw new Error("Unable to persist incremental checkpoint.");
  }
}

async function loadExistingChecksums(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from("fi_external_hubspot_note_staging")
    .select("hubspot_record_id, payload_checksum")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .in("hubspot_record_id", ids);
  if (error) throw new Error("Unable to load existing note checksums.");
  for (const row of data ?? []) {
    map.set(String(row.hubspot_record_id), String(row.payload_checksum ?? ""));
  }
  return map;
}

function buildNotesSearchBody(range: IncrementalRange, after: string | null): Record<string, unknown> {
  const body: Record<string, unknown> = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "hs_lastmodifieddate",
            operator: "GTE",
            value: hubspotSearchDatetimeMs(range.cutoffFrom.iso),
          },
          {
            propertyName: "hs_lastmodifieddate",
            operator: "LT",
            value: hubspotSearchDatetimeMs(range.cutoffTo.iso),
          },
        ],
      },
    ],
    properties: NOTES_PROPERTIES,
    limit: 100,
    sorts: [
      { propertyName: "hs_lastmodifieddate", direction: "ASCENDING" },
      { propertyName: "hs_object_id", direction: "ASCENDING" },
    ],
  };
  if (after) body.after = after;
  return body;
}

export async function runIncrementalNotesBackup(
  input: RunIncrementalNotesBackupInput
): Promise<RunIncrementalNotesBackupResult> {
  const datasetRaw = (input.dataset ?? "notes").trim();
  if (!isHubspotIncrementalDataset(datasetRaw)) {
    return {
      ok: false,
      error: `Unsupported incremental dataset "${datasetRaw}". Supported: notes.`,
      exitHint: "validation",
    };
  }
  const dataset: HubspotIncrementalDataset = datasetRaw;

  let range: IncrementalRange;
  try {
    range = parseIncrementalRange({
      cutoffFrom: input.cutoffFrom,
      cutoffTo: input.cutoffTo,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid cutoff range.",
      exitHint: "validation",
    };
  }

  const supabase = input.supabase;
  const fetchImpl = input.fetchImpl ?? fetch;
  const authSessionId =
    input.authSessionId ?? (await loadAuthSessionId(supabase, input.tenantId, input.integrationId));

  let run: Record<string, unknown> | null = null;

  if (input.resumeRunId) {
    const { data, error } = await supabase
      .from("fi_external_hubspot_sync_runs")
      .select("*")
      .eq("id", input.resumeRunId)
      .eq("tenant_id", input.tenantId)
      .eq("integration_id", input.integrationId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, error: "Incremental run not found for resume.", exitHint: "validation" };
    }
    run = data as Record<string, unknown>;
    if (run.backup_run_type !== "incremental") {
      return { ok: false, error: "Run is not an incremental backup.", exitHint: "validation" };
    }
    if (run.incremental_dataset !== dataset) {
      return { ok: false, error: "Resume dataset does not match run.", exitHint: "validation" };
    }
    if (run.status !== "started") {
      return {
        ok: false,
        error: `Run status "${String(run.status)}" is not resumable.`,
        exitHint: "validation",
      };
    }
    const persistedFrom = run.incremental_cutoff_from
      ? new Date(String(run.incremental_cutoff_from)).toISOString()
      : null;
    const persistedTo = run.incremental_cutoff_to
      ? new Date(String(run.incremental_cutoff_to)).toISOString()
      : null;
    if (persistedFrom !== range.cutoffFrom.iso || persistedTo !== range.cutoffTo.iso) {
      return {
        ok: false,
        error:
          "Resume cutoffs must match the immutable range persisted on the run. Do not widen or replace cutoff-to.",
        exitHint: "validation",
      };
    }
    await recordIncrementalEvent(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      authSessionId,
      auth: input.auth,
      event: "run_resumed",
      outcome: "info",
      detail: {
        run_id: String(run.id),
        dataset,
        cutoff_from: range.cutoffFrom.iso,
        cutoff_to: range.cutoffTo.iso,
      },
    });
  } else {
    const now = new Date().toISOString();
    const detail = {
      milestone: HUBSPOT_INCREMENTAL_MILESTONE,
      run_type: "incremental",
      dataset,
      cutoff_from: range.cutoffFrom.iso,
      cutoff_to: range.cutoffTo.iso,
      source_portal: input.portalId,
      read_only: true,
      promotion_enabled: false,
      response_bodies_retained: false,
      note_bodies_logged: false,
      range_semantics: "updatedAt >= cutoff_from AND updatedAt < cutoff_to",
    };
    const { data, error } = await supabase
      .from("fi_external_hubspot_sync_runs")
      .insert({
        tenant_id: input.tenantId,
        integration_id: input.integrationId,
        status: "started",
        started_at: now,
        backup_run_type: "incremental",
        incremental_dataset: dataset,
        incremental_cutoff_from: range.cutoffFrom.iso,
        incremental_cutoff_to: range.cutoffTo.iso,
        incremental_verification_state: "pending",
        incremental_checkpoint: emptyIncrementalCheckpoint(),
        detail,
      })
      .select("*")
      .single();

    if (error || !data) {
      const msg = String(error?.message ?? "");
      if (/uq_hubspot_incremental_active_run|duplicate key|unique/i.test(msg)) {
        return {
          ok: false,
          error: "An incremental notes backup is already running for this tenant.",
          exitHint: "conflict",
        };
      }
      return { ok: false, error: "Unable to start incremental backup run.", exitHint: "failed" };
    }
    run = data as Record<string, unknown>;
    await recordIncrementalEvent(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      authSessionId,
      auth: input.auth,
      event: "run_created",
      outcome: "info",
      detail: {
        run_id: String(run.id),
        dataset,
        cutoff_from: range.cutoffFrom.iso,
        cutoff_to: range.cutoffTo.iso,
      },
    });
    await recordIncrementalEvent(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      authSessionId,
      auth: input.auth,
      event: "run_started",
      outcome: "info",
      detail: { run_id: String(run.id), dataset },
    });
  }

  const runId = String(run.id);
  let checkpoint = parseIncrementalCheckpoint(run.incremental_checkpoint);
  const counters = emptyIncrementalCounters();
  const priorCounters = (run.engagement_counters as { notes_incremental?: IncrementalCounters } | null)
    ?.notes_incremental;
  if (priorCounters) {
    Object.assign(counters, priorCounters);
  }

  try {
    let pages = 0;
    while (true) {
      const page = await hubspotPostJson<SearchPage>(
        NOTES_SEARCH_PATH,
        input.accessToken,
        buildNotesSearchBody(range, checkpoint.searchAfter),
        fetchImpl
      );
      const results = (page.results ?? []).filter((row) => Boolean(row.id?.trim()));
      counters.discovered += results.length;

      const candidates: NoteTimestampCandidate[] = results.map((row) => ({
        id: String(row.id).trim(),
        updatedAt: row.updatedAt ?? null,
        createdAt: row.createdAt ?? null,
      }));
      const { inRange, skippedOutOfRange } = filterNotesInRange(candidates, range);
      counters.skippedOutOfRange += skippedOutOfRange;

      const afterTie = applyTiebreakerCursor(
        inRange,
        checkpoint.lastUpdatedAt,
        checkpoint.lastId
      );
      const idSet = new Set(afterTie.map((n) => n.id));
      const toStage = results.filter((row) => idSet.has(String(row.id).trim()));

      const existing = await loadExistingChecksums(
        supabase,
        input.tenantId,
        input.integrationId,
        toStage.map((row) => String(row.id).trim())
      );

      if (toStage.length) {
        await stageHubspotNotesPage(
          supabase,
          toStage,
          input.tenantId,
          input.integrationId,
          runId
        );
        for (const row of toStage) {
          const id = String(row.id).trim();
          const nextChecksum = checksum(row);
          const outcome = classifyUpsertOutcome({
            existedBefore: existing.has(id),
            previousChecksum: existing.get(id) ?? null,
            nextChecksum,
          });
          if (outcome === "inserted") counters.inserted += 1;
          else if (outcome === "updated") counters.updated += 1;
          else counters.unchanged += 1;
        }
        counters.inRange += toStage.length;
      }

      pages += 1;
      const previousAfter = checkpoint.searchAfter;
      const nextAfter =
        typeof page.paging?.next?.after === "string" && page.paging.next.after
          ? page.paging.next.after
          : null;

      if (afterTie.length) {
        const last = afterTie[afterTie.length - 1]!;
        const lastMs = noteUpdatedAtMs(last);
        checkpoint = {
          searchAfter: nextAfter,
          lastUpdatedAt: lastMs != null ? new Date(lastMs).toISOString() : checkpoint.lastUpdatedAt,
          lastId: last.id,
          pagesCompleted: pages,
        };
      } else {
        checkpoint = {
          ...checkpoint,
          searchAfter: nextAfter,
          pagesCompleted: pages,
        };
      }

      await persistCheckpoint(supabase, runId, checkpoint, counters);
      await recordIncrementalEvent(supabase, {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        authSessionId,
        auth: input.auth,
        event: "page_checkpointed",
        outcome: "info",
        detail: {
          run_id: runId,
          dataset,
          pages_completed: pages,
          discovered: counters.discovered,
          in_range: counters.inRange,
          has_next: Boolean(nextAfter),
        },
      });

      if (!nextAfter) break;
      if (previousAfter && nextAfter === previousAfter) break;
    }

    const emptyRange = counters.inRange === 0 && counters.failed === 0;
    const verificationState: "passed" | "failed" =
      counters.failed === 0 ? "passed" : "failed";
    const status: "completed" | "partial" =
      counters.failed > 0 ? "partial" : "completed";

    const paginationComplete = true;
    const watermarkEligible = canAdvanceIncrementalWatermark({
      status,
      verificationState,
      paginationComplete,
      unresolvedFailures: counters.failed > 0,
    });

    await recordIncrementalEvent(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      authSessionId,
      auth: input.auth,
      event: "finalisation_completed",
      outcome: status === "completed" ? "success" : "warning",
      detail: {
        run_id: runId,
        dataset,
        status,
        counters,
        empty_range: emptyRange,
      },
    });

    await recordIncrementalEvent(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      authSessionId,
      auth: input.auth,
      event: verificationState === "passed" ? "verification_passed" : "verification_failed",
      outcome: verificationState === "passed" ? "success" : "error",
      detail: {
        run_id: runId,
        dataset,
        cutoff_from: range.cutoffFrom.iso,
        cutoff_to: range.cutoffTo.iso,
        counters,
      },
    });

    const { error: finalizeError } = await supabase
      .from("fi_external_hubspot_sync_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        incremental_verification_state: verificationState,
        incremental_checkpoint: { ...checkpoint, phase: "complete" },
        engagement_counters: { notes_incremental: counters },
        health_score: status === "completed" ? 100 : 70,
        detail: {
          ...((run.detail as Record<string, unknown>) ?? {}),
          milestone: HUBSPOT_INCREMENTAL_MILESTONE,
          run_type: "incremental",
          dataset,
          cutoff_from: range.cutoffFrom.iso,
          cutoff_to: range.cutoffTo.iso,
          counters,
          empty_range: emptyRange,
          watermark_advanced: false,
        },
      })
      .eq("id", runId)
      .eq("status", "started");
    if (finalizeError) throw new Error("Unable to finalise incremental run.");

    let watermarkAdvanced = false;
    if (watermarkEligible) {
      const next = nextWatermarkFromCutoffTo(range.cutoffTo.iso);
      const { data: existingWm } = await supabase
        .from("fi_external_hubspot_backup_watermarks")
        .select("id, version")
        .eq("tenant_id", input.tenantId)
        .eq("source_system", HUBSPOT_INCREMENTAL_SOURCE_SYSTEM)
        .eq("dataset", dataset)
        .maybeSingle();

      if (existingWm?.id) {
        const { error: wmError } = await supabase
          .from("fi_external_hubspot_backup_watermarks")
          .update({
            watermark_timestamp: next.watermark_timestamp,
            watermark_tiebreaker: next.watermark_tiebreaker,
            last_successful_run_id: runId,
            last_verified_run_id: runId,
            version: Number(existingWm.version ?? 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingWm.id)
          .eq("version", existingWm.version);
        if (wmError) throw new Error("Unable to advance watermark.");
      } else {
        const { error: wmError } = await supabase.from("fi_external_hubspot_backup_watermarks").insert({
          tenant_id: input.tenantId,
          integration_id: input.integrationId,
          source_system: HUBSPOT_INCREMENTAL_SOURCE_SYSTEM,
          dataset,
          watermark_timestamp: next.watermark_timestamp,
          watermark_tiebreaker: next.watermark_tiebreaker,
          last_successful_run_id: runId,
          last_verified_run_id: runId,
          version: 1,
        });
        if (wmError) throw new Error("Unable to create watermark.");
      }
      watermarkAdvanced = true;
      await supabase
        .from("fi_external_hubspot_sync_runs")
        .update({
          detail: {
            ...((run.detail as Record<string, unknown>) ?? {}),
            milestone: HUBSPOT_INCREMENTAL_MILESTONE,
            run_type: "incremental",
            dataset,
            cutoff_from: range.cutoffFrom.iso,
            cutoff_to: range.cutoffTo.iso,
            counters,
            empty_range: emptyRange,
            watermark_advanced: true,
          },
        })
        .eq("id", runId);
      await recordIncrementalEvent(supabase, {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        authSessionId,
        auth: input.auth,
        event: "watermark_advanced",
        outcome: "success",
        detail: {
          run_id: runId,
          dataset,
          watermark_timestamp: next.watermark_timestamp,
        },
      });
    }

    return {
      ok: true,
      runId,
      status,
      verificationState,
      watermarkAdvanced,
      counters,
      cutoffFrom: range.cutoffFrom.iso,
      cutoffTo: range.cutoffTo.iso,
      emptyRange,
    };
  } catch (error) {
    const safe =
      error instanceof HubspotReadError
        ? error.message
        : error instanceof Error && error.message.startsWith("Unable to ")
          ? error.message
          : "Incremental notes backup failed.";
    await supabase
      .from("fi_external_hubspot_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        incremental_verification_state: "failed",
        incremental_checkpoint: checkpoint,
        detail: {
          ...((run.detail as Record<string, unknown>) ?? {}),
          milestone: HUBSPOT_INCREMENTAL_MILESTONE,
          error_category: error instanceof HubspotReadError ? error.category : "internal",
          safe_reason: safe,
          watermark_advanced: false,
        },
      })
      .eq("id", runId)
      .eq("status", "started");
    await recordIncrementalEvent(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      authSessionId,
      auth: input.auth,
      event: "run_failed",
      outcome: "error",
      detail: { run_id: runId, dataset, safe_reason: safe },
    });
    return { ok: false, error: safe, exitHint: "failed" };
  }
}

export async function recoverStuckIncrementalRun(input: {
  supabase: SupabaseClient;
  tenantId: string;
  integrationId: string;
  runId: string;
  auth: IncrementalBackupAuth;
  reason: string;
  transitionTo: "failed" | "started";
  nowMs?: number;
}): Promise<{ ok: true; previousStatus: string } | { ok: false; error: string }> {
  const reason = input.reason.trim();
  if (reason.length < 8) {
    return { ok: false, error: "Recovery reason must be at least 8 characters." };
  }
  const { data, error } = await input.supabase
    .from("fi_external_hubspot_sync_runs")
    .select("*")
    .eq("id", input.runId)
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Run not found." };
  const run = data as Record<string, unknown>;
  if (run.backup_run_type !== "incremental") {
    return { ok: false, error: "Not an incremental run." };
  }
  if (run.status === "completed") {
    return { ok: false, error: "Cannot recover a completed/verified incremental run." };
  }
  if (
    !isIncrementalRunStuck({
      status: String(run.status),
      startedAt: run.started_at ? String(run.started_at) : null,
      lastCheckpointAt: run.last_checkpoint_at ? String(run.last_checkpoint_at) : null,
      nowMs: input.nowMs,
      staleAgeMs: HUBSPOT_INCREMENTAL_STUCK_AGE_MS,
    }) &&
    run.status === "started"
  ) {
    return {
      ok: false,
      error: `Run is not stale (threshold ${HUBSPOT_INCREMENTAL_STUCK_AGE_MS / 60000} minutes).`,
    };
  }

  const nextStatus = input.transitionTo === "failed" ? "failed" : "started";
  const detail = {
    ...((run.detail as Record<string, unknown>) ?? {}),
    stuck_run_recovery: {
      recovered_at: new Date().toISOString(),
      reason,
      actor: input.auth.actorLabel,
      previous_status: run.status,
      transition_to: nextStatus,
      watermark_advanced: false,
    },
  };

  const { error: updateError } = await input.supabase
    .from("fi_external_hubspot_sync_runs")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "failed" ? new Date().toISOString() : null,
      detail,
      // Checkpoints retained — never deleted.
    })
    .eq("id", input.runId)
    .eq("status", String(run.status));
  if (updateError) return { ok: false, error: "Unable to recover stuck run." };

  const authSessionId = await loadAuthSessionId(input.supabase, input.tenantId, input.integrationId);
  await recordIncrementalEvent(input.supabase, {
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    authSessionId,
    auth: input.auth,
    event: "stuck_run_recovered",
    outcome: "warning",
    detail: {
      run_id: input.runId,
      reason,
      transition_to: nextStatus,
      watermark_advanced: false,
    },
  });

  return { ok: true, previousStatus: String(run.status) };
}
