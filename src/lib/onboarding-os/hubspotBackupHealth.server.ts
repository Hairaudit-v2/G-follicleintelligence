/**
 * FI-HUBSPOT-BACKUP-1 Stage P4 — server-side privacy-safe backup health loader.
 * Read-only. Does not start, resume, or schedule backups.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { HUBSPOT_INCREMENTAL_ALERT_SOURCE } from "./hubspotIncrementalBackupAlerts.server";
import { HUBSPOT_INCREMENTAL_SOURCE_SYSTEM } from "./hubspotIncrementalBackupCore";
import {
  deriveHubspotBackupHealth,
  redactHubspotBackupHealthForLowRole,
  type HubspotBackupHealthAlertInput,
  type HubspotBackupHealthDerived,
  type HubspotBackupHealthRunInput,
} from "./hubspotBackupHealthCore";
import {
  HUBSPOT_SCHEDULED_CADENCE_CRON_UTC,
  HUBSPOT_SCHEDULED_LOCAL_TIME,
  HUBSPOT_SCHEDULED_LOCAL_TZ,
} from "./hubspotScheduledIncrementalBackupCore";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  getEnv?: (key: string) => string | undefined;
  nowMs?: number;
  /** When false, redact technical fields for ordinary staff. Default true (admin). */
  includeTechnicalDetail?: boolean;
};

export type HubspotBackupHealthSummary = HubspotBackupHealthDerived & {
  primaryEvidence: {
    label: string;
    detail: string;
  };
  secondaryEvidence: {
    label: string;
    detail: string;
  };
  evidenceSeparationPreserved: true;
  scheduleReference: {
    cadenceCronUtc: string;
    localTime: string;
    timezone: string;
  };
};

function env(getEnv: (key: string) => string | undefined, key: string): string {
  return (getEnv(key) ?? "").trim();
}

function isSchedulerEnabled(getEnv: (key: string) => string | undefined): boolean {
  return env(getEnv, "FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED").toLowerCase() === "true";
}

function mapRunRow(row: Record<string, unknown>): HubspotBackupHealthRunInput {
  const detail = (row.detail as Record<string, unknown> | null) ?? {};
  const countersRaw =
    (detail.counters as Record<string, unknown> | null) ??
    ((row.engagement_counters as Record<string, unknown> | null)?.notes_incremental as
      | Record<string, unknown>
      | null) ??
    null;
  const checkpoint = (row.incremental_checkpoint as Record<string, unknown> | null) ?? {};
  const emptyRange = Boolean(detail.empty_range === true);
  const verificationState = row.incremental_verification_state
    ? String(row.incremental_verification_state)
    : null;
  const status = String(row.status ?? "failed");
  let outcome: string | null = null;
  if (status === "completed" && verificationState === "passed") {
    outcome = emptyRange ? "empty_success" : "success";
  } else if (status === "partial") {
    outcome = "partial";
  } else if (status === "failed" || verificationState === "failed") {
    outcome = "failure";
  } else if (status === "started") {
    outcome = "in_progress";
  }

  return {
    runId: String(row.id),
    status,
    verificationState,
    cutoffFrom: row.incremental_cutoff_from
      ? new Date(String(row.incremental_cutoff_from)).toISOString()
      : null,
    cutoffTo: row.incremental_cutoff_to
      ? new Date(String(row.incremental_cutoff_to)).toISOString()
      : null,
    startedAt: new Date(String(row.started_at)).toISOString(),
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
    emptyRange,
    outcome,
    counters: countersRaw
      ? {
          discovered: Number(countersRaw.discovered ?? 0),
          inRange: Number(countersRaw.inRange ?? countersRaw.in_range ?? 0),
          inserted: Number(countersRaw.inserted ?? 0),
          updated: Number(countersRaw.updated ?? 0),
          unchanged: Number(countersRaw.unchanged ?? 0),
          failed: Number(countersRaw.failed ?? 0),
        }
      : null,
    lastCheckpointAt: checkpoint.updated_at
      ? new Date(String(checkpoint.updated_at)).toISOString()
      : row.started_at
        ? new Date(String(row.started_at)).toISOString()
        : null,
  };
}

function mapAlertRow(row: Record<string, unknown>): HubspotBackupHealthAlertInput {
  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  return {
    id: String(row.id),
    eventType: String(row.event_type ?? ""),
    severity: String(row.severity ?? "warning"),
    status: String(row.status ?? "open"),
    createdAt: new Date(String(row.created_at)).toISOString(),
    runId: metadata.run_id ? String(metadata.run_id) : null,
  };
}

function buildEvidence(health: HubspotBackupHealthDerived): {
  primaryEvidence: { label: string; detail: string };
  secondaryEvidence: { label: string; detail: string };
} {
  const run = health.latestRun;
  const primaryDetail = run
    ? [
        `Dataset: ${health.dataset}`,
        `Outcome: ${run.outcome ?? run.status}`,
        health.verification.verifiedAt
          ? `Last verified: ${health.verification.verifiedAt}`
          : "Last verified: not yet verified",
        health.watermark.value
          ? `Watermark: ${health.watermark.value}`
          : "Watermark: missing",
        `Scheduler: ${health.scheduler.enabled === true ? "enabled" : health.scheduler.enabled === false ? "disabled" : "unknown"} · ${health.scheduler.localTime} ${health.scheduler.timezone}`,
      ].join(" · ")
    : "No incremental notes run recorded.";

  const alert = health.latestRelevantAlert;
  const secondaryDetail = alert
    ? `Alert ${alert.eventType} (${alert.severity}, ${alert.status}) at ${alert.createdAt}`
    : "No open incremental-backup admin notifications for this integration.";

  return {
    primaryEvidence: {
      label: "Primary operational evidence (runs, verification, watermark, schedule)",
      detail: primaryDetail,
    },
    secondaryEvidence: {
      label: "Secondary operational evidence (notifications / audit references)",
      detail: secondaryDetail,
    },
  };
}

/**
 * Load derived incremental notes backup health for the HubSpot Backup & Sync workspace.
 * Fail closed when tenantId/integrationId are blank. Never starts a backup.
 */
export async function loadHubspotBackupHealthSummary(
  tenantId: string,
  integrationId: string,
  opts: ServerOpts = {}
): Promise<HubspotBackupHealthSummary> {
  const tid = tenantId.trim();
  const iid = integrationId.trim();
  const getEnv = opts.getEnv ?? ((key: string) => process.env[key]);
  const includeTechnical = opts.includeTechnicalDetail !== false;

  if (!tid || !iid) {
    const health = deriveHubspotBackupHealth({
      nowMs: opts.nowMs,
      schedulerEnabled: null,
      scheduleConfigured: true,
      watermarkTimestamp: null,
      latestRun: null,
      activeRun: null,
      latestRelevantAlert: null,
      sourceError: {
        code: !tid ? "tenant_missing" : "ambiguous_tenant",
        message: "Tenant or integration context missing.",
      },
    });
    const out = includeTechnical ? health : redactHubspotBackupHealthForLowRole(health);
    const evidence = buildEvidence(out);
    return {
      ...out,
      ...evidence,
      evidenceSeparationPreserved: true,
      scheduleReference: {
        cadenceCronUtc: HUBSPOT_SCHEDULED_CADENCE_CRON_UTC,
        localTime: HUBSPOT_SCHEDULED_LOCAL_TIME,
        timezone: HUBSPOT_SCHEDULED_LOCAL_TZ,
      },
    };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  try {
    const [wmResult, latestResult, activeResult, alertResult] = await Promise.all([
      supabase
        .from("fi_external_hubspot_backup_watermarks")
        .select("watermark_timestamp, last_verified_run_id")
        .eq("tenant_id", tid)
        .eq("source_system", HUBSPOT_INCREMENTAL_SOURCE_SYSTEM)
        .eq("dataset", "notes")
        .maybeSingle(),
      supabase
        .from("fi_external_hubspot_sync_runs")
        .select(
          "id, status, started_at, completed_at, detail, engagement_counters, incremental_dataset, incremental_cutoff_from, incremental_cutoff_to, incremental_verification_state, incremental_checkpoint, backup_run_type"
        )
        .eq("tenant_id", tid)
        .eq("integration_id", iid)
        .eq("backup_run_type", "incremental")
        .eq("incremental_dataset", "notes")
        .neq("status", "started")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("fi_external_hubspot_sync_runs")
        .select(
          "id, status, started_at, completed_at, detail, engagement_counters, incremental_dataset, incremental_cutoff_from, incremental_cutoff_to, incremental_verification_state, incremental_checkpoint, backup_run_type"
        )
        .eq("tenant_id", tid)
        .eq("integration_id", iid)
        .eq("backup_run_type", "incremental")
        .eq("incremental_dataset", "notes")
        .eq("status", "started")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("fi_admin_notifications")
        .select("id, event_type, severity, status, created_at, metadata")
        .eq("tenant_id", tid)
        .eq("source", HUBSPOT_INCREMENTAL_ALERT_SOURCE)
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (wmResult.error || latestResult.error || activeResult.error || alertResult.error) {
      const health = deriveHubspotBackupHealth({
        nowMs: opts.nowMs,
        schedulerEnabled: isSchedulerEnabled(getEnv),
        scheduleConfigured: true,
        watermarkTimestamp: null,
        latestRun: null,
        activeRun: null,
        latestRelevantAlert: null,
        sourceError: {
          code: "query_error",
          message:
            wmResult.error?.message ||
            latestResult.error?.message ||
            activeResult.error?.message ||
            alertResult.error?.message ||
            "query failed",
        },
      });
      const out = includeTechnical ? health : redactHubspotBackupHealthForLowRole(health);
      const evidence = buildEvidence(out);
      return {
        ...out,
        ...evidence,
        evidenceSeparationPreserved: true,
        scheduleReference: {
          cadenceCronUtc: HUBSPOT_SCHEDULED_CADENCE_CRON_UTC,
          localTime: HUBSPOT_SCHEDULED_LOCAL_TIME,
          timezone: HUBSPOT_SCHEDULED_LOCAL_TZ,
        },
      };
    }

    const watermarkTimestamp = wmResult.data?.watermark_timestamp
      ? new Date(String(wmResult.data.watermark_timestamp)).toISOString()
      : null;

    const latestRun = latestResult.data
      ? mapRunRow(latestResult.data as Record<string, unknown>)
      : null;
    const activeRun = activeResult.data
      ? mapRunRow(activeResult.data as Record<string, unknown>)
      : null;

    const alertRows = (alertResult.data ?? []) as Record<string, unknown>[];
    const matchingAlert = alertRows.find((row) => {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const hubspotId = String(metadata.hubspot_integration_id ?? "");
      return !hubspotId || hubspotId === iid;
    });
    const latestRelevantAlert = matchingAlert ? mapAlertRow(matchingAlert) : null;

    let health = deriveHubspotBackupHealth({
      nowMs: opts.nowMs,
      schedulerEnabled: isSchedulerEnabled(getEnv),
      scheduleConfigured: true,
      watermarkTimestamp,
      latestRun,
      activeRun,
      latestRelevantAlert,
    });

    if (!includeTechnical) {
      health = redactHubspotBackupHealthForLowRole(health);
    }

    const evidence = buildEvidence(health);
    return {
      ...health,
      ...evidence,
      evidenceSeparationPreserved: true,
      scheduleReference: {
        cadenceCronUtc: HUBSPOT_SCHEDULED_CADENCE_CRON_UTC,
        localTime: HUBSPOT_SCHEDULED_LOCAL_TIME,
        timezone: HUBSPOT_SCHEDULED_LOCAL_TZ,
      },
    };
  } catch (error) {
    const health = deriveHubspotBackupHealth({
      nowMs: opts.nowMs,
      schedulerEnabled: isSchedulerEnabled(getEnv),
      scheduleConfigured: true,
      watermarkTimestamp: null,
      latestRun: null,
      activeRun: null,
      latestRelevantAlert: null,
      sourceError: {
        code: "query_error",
        message: error instanceof Error ? error.message : "query failed",
      },
    });
    const out = includeTechnical ? health : redactHubspotBackupHealthForLowRole(health);
    const evidence = buildEvidence(out);
    return {
      ...out,
      ...evidence,
      evidenceSeparationPreserved: true,
      scheduleReference: {
        cadenceCronUtc: HUBSPOT_SCHEDULED_CADENCE_CRON_UTC,
        localTime: HUBSPOT_SCHEDULED_LOCAL_TIME,
        timezone: HUBSPOT_SCHEDULED_LOCAL_TZ,
      },
    };
  }
}
