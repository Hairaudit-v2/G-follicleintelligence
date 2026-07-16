import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  alertEventForOutcome,
  createHubspotIncrementalBackupAlertIfNeeded,
} from "./hubspotIncrementalBackupAlerts.server";
import {
  HUBSPOT_INCREMENTAL_MILESTONE,
  HUBSPOT_INCREMENTAL_SOURCE_SYSTEM,
} from "./hubspotIncrementalBackupCore";
import {
  buildScheduledCutoffs,
  classifyScheduledOutcome,
  computeScheduledBackoffMs,
  HUBSPOT_SCHEDULED_INCREMENTAL_SOURCE,
  HUBSPOT_SCHEDULED_MAX_TRANSIENT_ATTEMPTS,
  isTransientScheduledError,
  nextDailyBrisbaneRunUtc,
  type ScheduledOutcome,
} from "./hubspotScheduledIncrementalBackupCore";

export const DEFAULT_SCHEDULED_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
export const DEFAULT_SCHEDULED_INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

export type ScheduledIncrementalBackupResult = {
  ok: boolean;
  outcome: ScheduledOutcome;
  httpStatus: number;
  invocationTimestamp: string;
  schedulerSource: string;
  tenantId: string;
  integrationId: string;
  dataset: string;
  runId: string | null;
  cutoffFrom: string | null;
  cutoffTo: string | null;
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  counters: Record<string, number> | null;
  status: string | null;
  verificationState: string | null;
  emptyRange: boolean | null;
  attempts: number;
  error: string | null;
  alertId: string | null;
  nextExpectedRunAt: string;
  runbook: string;
};

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string;
  getEnv?: (key: string) => string | undefined;
  nowIso?: string;
  sleep?: (ms: number) => Promise<void>;
  runBackup?: typeof import("./hubspotConnector.server").runHubspotIncrementalNotesBackup;
};

function env(getEnv: (key: string) => string | undefined, key: string): string {
  return getEnv(key)?.trim() ?? "";
}

function sleepMs(ms: number, sleep?: (ms: number) => Promise<void>): Promise<void> {
  if (sleep) return sleep(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveScheduledTenantIntegration(getEnv: (key: string) => string | undefined): {
  ok: true;
  tenantId: string;
  integrationId: string;
} | { ok: false; error: string } {
  const tenantId =
    env(getEnv, "FI_HUBSPOT_INCREMENTAL_BACKUP_TENANT_ID") || DEFAULT_SCHEDULED_TENANT_ID;
  const integrationId =
    env(getEnv, "FI_HUBSPOT_INCREMENTAL_BACKUP_INTEGRATION_ID") ||
    DEFAULT_SCHEDULED_INTEGRATION_ID;
  if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !/^[0-9a-f-]{36}$/i.test(integrationId)) {
    return { ok: false, error: "Tenant or integration ID is malformed." };
  }
  // Fail closed if both env overrides are set inconsistently empty after trim — already handled.
  return { ok: true, tenantId, integrationId };
}

async function loadNotesWatermark(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ timestamp: string; lastVerifiedRunId: string | null } | null> {
  const { data, error } = await supabase
    .from("fi_external_hubspot_backup_watermarks")
    .select("watermark_timestamp, last_verified_run_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", HUBSPOT_INCREMENTAL_SOURCE_SYSTEM)
    .eq("dataset", "notes")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.watermark_timestamp) return null;
  return {
    timestamp: new Date(String(data.watermark_timestamp)).toISOString(),
    lastVerifiedRunId: data.last_verified_run_id
      ? String(data.last_verified_run_id)
      : null,
  };
}

async function recordScheduledInvocationEvent(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    actorAuthUserId: string;
    detail: Record<string, unknown>;
    outcome: "success" | "warning" | "error" | "info";
  }
): Promise<void> {
  const { data: session } = await supabase
    .from("fi_external_connector_auth_sessions")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .maybeSingle();
  if (!session?.id) return;
  await supabase.from("fi_external_connector_verification_events").insert({
    auth_session_id: session.id,
    integration_id: input.integrationId,
    tenant_id: input.tenantId,
    provider: "hubspot",
    auth_status: "verified",
    outcome: input.outcome,
    actor_auth_user_id: input.actorAuthUserId,
    actor_fi_user_id: null,
    actor_label: "HubSpot scheduled incremental backup",
    detail: {
      verification_mode: "incremental_backup",
      milestone: HUBSPOT_INCREMENTAL_MILESTONE,
      event: "scheduled_invocation",
      scheduler_source: HUBSPOT_SCHEDULED_INCREMENTAL_SOURCE,
      ...input.detail,
    },
    provider_payload: {
      verification_mode: "incremental_backup",
      event: "scheduled_invocation",
      response_bodies_retained: false,
      note_bodies_retained: false,
    },
  });
}

/**
 * Production scheduled notes incremental backup entry point.
 * Freezes cutoff-to at invocation; uses verified watermark as cutoff-from.
 */
export async function runScheduledHubspotIncrementalNotesBackup(
  opts: ServerOpts = {}
): Promise<ScheduledIncrementalBackupResult> {
  const getEnv = opts.getEnv ?? ((key: string) => process.env[key]);
  const invocationTimestamp = opts.nowIso ?? new Date().toISOString();
  const nextExpectedRunAt = nextDailyBrisbaneRunUtc(new Date(invocationTimestamp));
  const base = {
    invocationTimestamp,
    schedulerSource: HUBSPOT_SCHEDULED_INCREMENTAL_SOURCE,
    dataset: "notes",
    nextExpectedRunAt,
    runbook: "docs/runbooks/hubspot-incremental-backup.md",
  };

  const enabledRaw = env(getEnv, "FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED").toLowerCase();
  const enabled = enabledRaw === "1" || enabledRaw === "true" || enabledRaw === "yes";
  if (!enabled) {
    return {
      ok: false,
      outcome: "disabled",
      httpStatus: 200,
      ...base,
      tenantId: DEFAULT_SCHEDULED_TENANT_ID,
      integrationId: DEFAULT_SCHEDULED_INTEGRATION_ID,
      runId: null,
      cutoffFrom: null,
      cutoffTo: null,
      watermarkBefore: null,
      watermarkAfter: null,
      counters: null,
      status: null,
      verificationState: null,
      emptyRange: null,
      attempts: 0,
      error:
        "Scheduled HubSpot incremental backup is disabled. Set FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=true to enable.",
      alertId: null,
    };
  }

  const ids = resolveScheduledTenantIntegration(getEnv);
  if (!ids.ok) {
    return {
      ok: false,
      outcome: "validation_error",
      httpStatus: 500,
      ...base,
      tenantId: DEFAULT_SCHEDULED_TENANT_ID,
      integrationId: DEFAULT_SCHEDULED_INTEGRATION_ID,
      runId: null,
      cutoffFrom: null,
      cutoffTo: null,
      watermarkBefore: null,
      watermarkAfter: null,
      counters: null,
      status: null,
      verificationState: null,
      emptyRange: null,
      attempts: 0,
      error: ids.error,
      alertId: null,
    };
  }

  const actorAuthUserId =
    opts.actorAuthUserId?.trim() || env(getEnv, "FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID");
  if (!actorAuthUserId) {
    return {
      ok: false,
      outcome: "missing_credentials",
      httpStatus: 503,
      ...base,
      tenantId: ids.tenantId,
      integrationId: ids.integrationId,
      runId: null,
      cutoffFrom: null,
      cutoffTo: null,
      watermarkBefore: null,
      watermarkAfter: null,
      counters: null,
      status: null,
      verificationState: null,
      emptyRange: null,
      attempts: 0,
      error: "FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID is required.",
      alertId: null,
    };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  let watermarkBefore: string | null = null;
  let planCutoffFrom: string | null = null;
  let planCutoffTo: string | null = null;

  try {
    const watermark = await loadNotesWatermark(supabase, ids.tenantId);
    if (!watermark) {
      const outcome: ScheduledOutcome = "missing_watermark";
      const alert = await createHubspotIncrementalBackupAlertIfNeeded({
        tenantId: ids.tenantId,
        integrationId: ids.integrationId,
        eventType: "hubspot_incremental_backup_missing_watermark",
        title: "HubSpot incremental backup missing watermark",
        message:
          "Scheduled notes backup refused: no verified notes watermark. Will not start a full-history backup.",
        severity: "high",
        idempotencyKey: `hubspot-inc-missing-wm:${ids.tenantId}:${invocationTimestamp.slice(0, 13)}`,
        metadata: {
          dataset: "notes",
          outcome,
          invocation_timestamp: invocationTimestamp,
        },
      }, { supabaseClientForTests: supabase });
      return {
        ok: false,
        outcome,
        httpStatus: 409,
        ...base,
        tenantId: ids.tenantId,
        integrationId: ids.integrationId,
        runId: null,
        cutoffFrom: null,
        cutoffTo: null,
        watermarkBefore: null,
        watermarkAfter: null,
        counters: null,
        status: null,
        verificationState: null,
        emptyRange: null,
        attempts: 0,
        error: "Missing verified notes watermark.",
        alertId: alert.alertId,
      };
    }

    watermarkBefore = watermark.timestamp;
    const plan = buildScheduledCutoffs({
      dataset: "notes",
      watermarkTimestamp: watermark.timestamp,
      invocationTimeIso: invocationTimestamp,
    });
    planCutoffFrom = plan.cutoffFrom;
    planCutoffTo = plan.cutoffTo;

    const runBackup =
      opts.runBackup ??
      (await import("./hubspotConnector.server")).runHubspotIncrementalNotesBackup;

    let attempts = 0;
    let lastError: string | null = null;
    let resumeRunId: string | null = null;
    let result:
      | Awaited<ReturnType<typeof runBackup>>
      | null = null;

    while (attempts < HUBSPOT_SCHEDULED_MAX_TRANSIENT_ATTEMPTS) {
      attempts += 1;
      try {
        result = await runBackup(
          ids.integrationId,
          ids.tenantId,
          {
            dataset: "notes",
            cutoffFrom: plan.cutoffFrom,
            cutoffTo: plan.cutoffTo,
            resumeRunId,
          },
          {
            actorAuthUserId,
            supabaseClientForTests: supabase,
            trustedServiceOperation: true,
          }
        );

        if (!result.ok) {
          if (result.exitHint === "conflict" || result.exitHint === "validation") {
            break;
          }
          // failed exit — engine already classified; do not change cutoffs
          break;
        }
        resumeRunId = result.runId;
        if (result.status === "completed" && result.verificationState === "passed") {
          break;
        }
        if (result.status === "partial" && attempts < HUBSPOT_SCHEDULED_MAX_TRANSIENT_ATTEMPTS) {
          await sleepMs(computeScheduledBackoffMs(attempts - 1), opts.sleep);
          continue;
        }
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Scheduled backup failed.";
        if (
          isTransientScheduledError(error) &&
          attempts < HUBSPOT_SCHEDULED_MAX_TRANSIENT_ATTEMPTS
        ) {
          await sleepMs(computeScheduledBackoffMs(attempts - 1), opts.sleep);
          continue;
        }
        break;
      }
    }

    const outcome = result
      ? classifyScheduledOutcome({
          ok: result.ok,
          exitHint: result.ok ? undefined : result.exitHint,
          error: result.ok ? undefined : result.error,
          status: result.ok ? result.status : undefined,
          verificationState: result.ok ? result.verificationState : undefined,
          emptyRange: result.ok ? result.emptyRange : undefined,
        })
      : "failure";

    const watermarkAfterRow = await loadNotesWatermark(supabase, ids.tenantId);
    const watermarkAfter = watermarkAfterRow?.timestamp ?? watermarkBefore;

    const alertType = alertEventForOutcome(outcome);
    let alertId: string | null = null;
    if (alertType) {
      const alert = await createHubspotIncrementalBackupAlertIfNeeded({
        tenantId: ids.tenantId,
        integrationId: ids.integrationId,
        eventType: alertType,
        title: `HubSpot incremental backup ${outcome}`,
        message: [
          `dataset=notes`,
          `status=${result && result.ok ? result.status : "failed"}`,
          `run_id=${result && result.ok ? result.runId : resumeRunId ?? "none"}`,
          `cutoff_from=${plan.cutoffFrom}`,
          `cutoff_to=${plan.cutoffTo}`,
          `error=${result && !result.ok ? result.error : lastError ?? "none"}`,
          `runbook=docs/runbooks/hubspot-incremental-backup.md`,
        ].join("; "),
        severity: outcome === "overlap_blocked" ? "warning" : "high",
        idempotencyKey: `hubspot-inc:${outcome}:${ids.tenantId}:${plan.cutoffFrom}:${plan.cutoffTo}`,
        metadata: {
          dataset: "notes",
          outcome,
          run_id: result && result.ok ? result.runId : resumeRunId,
          cutoff_from: plan.cutoffFrom,
          cutoff_to: plan.cutoffTo,
          counters: result && result.ok ? result.counters : null,
          invocation_timestamp: invocationTimestamp,
        },
      }, { supabaseClientForTests: supabase });
      alertId = alert.alertId;
    }

    await recordScheduledInvocationEvent(supabase, {
      tenantId: ids.tenantId,
      integrationId: ids.integrationId,
      actorAuthUserId,
      outcome:
        outcome === "success" || outcome === "empty_success"
          ? "success"
          : outcome === "overlap_blocked"
            ? "warning"
            : "error",
      detail: {
        run_id: result && result.ok ? result.runId : resumeRunId,
        dataset: "notes",
        cutoff_from: plan.cutoffFrom,
        cutoff_to: plan.cutoffTo,
        watermark_before: watermarkBefore,
        watermark_after: watermarkAfter,
        counters: result && result.ok ? result.counters : null,
        final_status: result && result.ok ? result.status : "failed",
        verification_status: result && result.ok ? result.verificationState : "failed",
        scheduled_outcome: outcome,
        attempts,
        next_expected_run_at: nextExpectedRunAt,
      },
    });

    logStructured(
      outcome === "success" || outcome === "empty_success" ? "info" : "error",
      "hubspot_scheduled_incremental_notes_backup",
      {
        tenantId: ids.tenantId,
        integrationId: ids.integrationId,
        outcome,
        runId: result && result.ok ? result.runId : resumeRunId,
        cutoffFrom: plan.cutoffFrom,
        cutoffTo: plan.cutoffTo,
        attempts,
      }
    );

    const ok = outcome === "success" || outcome === "empty_success";
    return {
      ok,
      outcome,
      httpStatus: ok ? 200 : outcome === "overlap_blocked" ? 409 : 500,
      ...base,
      tenantId: ids.tenantId,
      integrationId: ids.integrationId,
      runId: result && result.ok ? result.runId : resumeRunId,
      cutoffFrom: plan.cutoffFrom,
      cutoffTo: plan.cutoffTo,
      watermarkBefore,
      watermarkAfter,
      counters: result && result.ok ? result.counters : null,
      status: result && result.ok ? result.status : null,
      verificationState: result && result.ok ? result.verificationState : null,
      emptyRange: result && result.ok ? result.emptyRange : null,
      attempts,
      error: result && !result.ok ? result.error : lastError,
      alertId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled backup failed.";
    logStructured("error", "hubspot_scheduled_incremental_notes_backup_failed", {
      tenantId: ids.tenantId,
      integrationId: ids.integrationId,
      message,
    });
    return {
      ok: false,
      outcome: "failure",
      httpStatus: 500,
      ...base,
      tenantId: ids.tenantId,
      integrationId: ids.integrationId,
      runId: null,
      cutoffFrom: planCutoffFrom,
      cutoffTo: planCutoffTo,
      watermarkBefore,
      watermarkAfter: watermarkBefore,
      counters: null,
      status: null,
      verificationState: null,
      emptyRange: null,
      attempts: 0,
      error: message,
      alertId: null,
    };
  }
}
