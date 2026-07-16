/**
 * FI-HUBSPOT-BACKUP-1 Stage P4 — pure backup-health derivation (no I/O).
 * States: Healthy | Needs review | Failed. Severity precedence: Failed > Needs review > Healthy.
 */

import {
  HUBSPOT_INCREMENTAL_STUCK_AGE_MS,
  type HubspotIncrementalRunStatus,
  type HubspotIncrementalVerificationState,
} from "./hubspotIncrementalBackupCore";
import {
  HUBSPOT_SCHEDULED_CADENCE_CRON_UTC,
  HUBSPOT_SCHEDULED_LOCAL_TIME,
  HUBSPOT_SCHEDULED_LOCAL_TZ,
  HUBSPOT_SCHEDULED_UTC_TIME,
  nextDailyBrisbaneRunUtc,
} from "./hubspotScheduledIncrementalBackupCore";

export const HUBSPOT_BACKUP_HEALTH_STATUSES = ["healthy", "needs_review", "failed"] as const;
export type HubspotBackupHealthStatus = (typeof HUBSPOT_BACKUP_HEALTH_STATUSES)[number];

/** Grace after 16:00 UTC before an overdue expected run becomes Needs review. */
export const HUBSPOT_BACKUP_HEALTH_GRACE_MS = 2 * 60 * 60 * 1000;

export type HubspotBackupHealthRunInput = {
  runId: string;
  status: HubspotIncrementalRunStatus | string;
  verificationState: HubspotIncrementalVerificationState | string | null;
  cutoffFrom: string | null;
  cutoffTo: string | null;
  startedAt: string;
  completedAt: string | null;
  emptyRange?: boolean | null;
  outcome?: string | null;
  counters?: {
    discovered?: number;
    inRange?: number;
    inserted?: number;
    updated?: number;
    unchanged?: number;
    failed?: number;
  } | null;
  lastCheckpointAt?: string | null;
};

export type HubspotBackupHealthAlertInput = {
  id: string;
  eventType: string;
  severity: "info" | "warning" | "high" | string;
  status: "open" | "acknowledged" | "dismissed" | string;
  createdAt: string;
  runId?: string | null;
};

export type HubspotBackupHealthSourceError = {
  code: "query_error" | "tenant_missing" | "ambiguous_tenant";
  message: string;
};

export type DeriveHubspotBackupHealthInput = {
  nowMs?: number;
  dataset?: "notes";
  schedulerEnabled: boolean | null;
  scheduleConfigured: boolean;
  watermarkTimestamp: string | null;
  latestRun: HubspotBackupHealthRunInput | null;
  activeRun: HubspotBackupHealthRunInput | null;
  latestRelevantAlert: HubspotBackupHealthAlertInput | null;
  sourceError?: HubspotBackupHealthSourceError | null;
};

export type HubspotBackupHealthDerived = {
  status: HubspotBackupHealthStatus;
  reasonCode: string;
  summary: string;
  operatorActionRequired: boolean;
  operatorGuidance: string;
  dataset: "notes";
  scheduler: {
    enabled: boolean | null;
    cadence: "daily";
    localTime: string;
    timezone: string;
    cronUtc: string;
    utcTime: string;
    nextExpectedAt: string | null;
    lastExpectedAt: string | null;
  };
  latestRun: HubspotBackupHealthRunInput | null;
  activeRun: HubspotBackupHealthRunInput | null;
  verification: {
    status: string | null;
    verifiedAt: string | null;
  };
  watermark: {
    value: string | null;
    matchesLatestVerifiedCutoff: boolean | null;
  };
  latestRelevantAlert: HubspotBackupHealthAlertInput | null;
  generatedAt: string;
};

type Candidate = {
  status: HubspotBackupHealthStatus;
  reasonCode: string;
  summary: string;
  guidance: string;
};

function severityRank(status: HubspotBackupHealthStatus): number {
  if (status === "failed") return 3;
  if (status === "needs_review") return 2;
  return 1;
}

function pickWorse(a: Candidate, b: Candidate): Candidate {
  return severityRank(b.status) > severityRank(a.status) ? b : a;
}

function isoOrNull(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/** Most recent 16:00 UTC at or before `now`. */
export function lastExpectedDailyBrisbaneRunUtc(from: Date = new Date()): string {
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 16, 0, 0, 0)
  );
  if (candidate.getTime() > from.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  return candidate.toISOString();
}

export function isCriticalHubspotBackupAlert(alert: HubspotBackupHealthAlertInput): boolean {
  if (alert.status === "dismissed" || alert.status === "acknowledged") return false;
  if (alert.severity === "info") return false;
  const t = alert.eventType.toLowerCase();
  return (
    t.includes("failed") ||
    t.includes("verification_failed") ||
    t.includes("stuck") ||
    t.includes("missing_credentials") ||
    alert.severity === "high"
  );
}

export function isWarningHubspotBackupAlert(alert: HubspotBackupHealthAlertInput): boolean {
  if (alert.status === "dismissed" || alert.status === "acknowledged") return false;
  if (isCriticalHubspotBackupAlert(alert)) return false;
  return alert.severity === "warning" || alert.eventType.toLowerCase().includes("partial");
}

function runOutcomeLabel(run: HubspotBackupHealthRunInput): string {
  if (run.outcome) return String(run.outcome);
  if (run.status === "completed" && run.verificationState === "passed") {
    return run.emptyRange ? "empty_success" : "success";
  }
  return String(run.status);
}

function isVerifiedSuccess(run: HubspotBackupHealthRunInput | null): boolean {
  if (!run) return false;
  return run.status === "completed" && run.verificationState === "passed";
}

function watermarkMatchesCutoff(
  watermark: string | null,
  cutoffTo: string | null
): boolean | null {
  const wm = isoOrNull(watermark);
  const cut = isoOrNull(cutoffTo);
  if (!wm || !cut) return null;
  return wm === cut;
}

/**
 * Derive privacy-safe HubSpot incremental notes backup health.
 * Never returns Healthy when sourceError is set.
 */
export function deriveHubspotBackupHealth(
  input: DeriveHubspotBackupHealthInput
): HubspotBackupHealthDerived {
  const nowMs = input.nowMs ?? Date.now();
  const now = new Date(nowMs);
  const generatedAt = now.toISOString();
  const nextExpectedAt = input.scheduleConfigured ? nextDailyBrisbaneRunUtc(now) : null;
  const lastExpectedAt = input.scheduleConfigured ? lastExpectedDailyBrisbaneRunUtc(now) : null;

  const baseScheduler = {
    enabled: input.schedulerEnabled,
    cadence: "daily" as const,
    localTime: HUBSPOT_SCHEDULED_LOCAL_TIME,
    timezone: HUBSPOT_SCHEDULED_LOCAL_TZ,
    cronUtc: HUBSPOT_SCHEDULED_CADENCE_CRON_UTC,
    utcTime: HUBSPOT_SCHEDULED_UTC_TIME,
    nextExpectedAt,
    lastExpectedAt,
  };

  const latest = input.latestRun;
  const active = input.activeRun;
  const match = watermarkMatchesCutoff(
    input.watermarkTimestamp,
    latest && isVerifiedSuccess(latest) ? latest.cutoffTo : null
  );

  let candidate: Candidate | null = null;
  const escalate = (next: Candidate) => {
    candidate = candidate ? pickWorse(candidate, next) : next;
  };

  if (input.sourceError) {
    escalate({
      status: input.sourceError.code === "query_error" ? "failed" : "needs_review",
      reasonCode: input.sourceError.code,
      summary:
        input.sourceError.code === "tenant_missing"
          ? "Tenant context is missing. Backup health cannot be confirmed."
          : input.sourceError.code === "ambiguous_tenant"
            ? "Tenant context is ambiguous. Backup health cannot be confirmed."
            : "Backup health sources could not be loaded. Status cannot be confirmed.",
      guidance:
        "Follow the incremental backup recovery runbook. Do not treat this as a verified success.",
    });
  } else if (!input.scheduleConfigured) {
    escalate({
      status: "needs_review",
      reasonCode: "missing_schedule",
      summary: "Incremental backup schedule configuration is missing.",
      guidance: "Confirm the Vercel Cron schedule and kill-switch configuration.",
    });
  } else if (input.schedulerEnabled === false) {
    escalate({
      status: "needs_review",
      reasonCode: "scheduler_disabled",
      summary: "The incremental notes backup scheduler is disabled.",
      guidance: "Review whether FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED was intentionally turned off.",
    });
  } else if (!input.watermarkTimestamp) {
    escalate({
      status: "needs_review",
      reasonCode: "missing_watermark",
      summary: "No verified notes watermark exists yet.",
      guidance: "Do not start a full-history backup from the UI. Follow the incremental backup runbook.",
    });
  } else if (!latest && !active) {
    escalate({
      status: "needs_review",
      reasonCode: "no_runs",
      summary: "No incremental notes backup run has been recorded yet.",
      guidance: "Wait for the next scheduled run or follow the operator runbook.",
    });
  } else {
    if (latest) {
      if (latest.status === "failed" || latest.verificationState === "failed") {
        escalate({
          status: "failed",
          reasonCode:
            latest.verificationState === "failed" ? "verification_failed" : "run_failed",
          summary:
            latest.verificationState === "failed"
              ? "The latest backup failed verification. Data protection status cannot be confirmed."
              : "The latest incremental notes backup run failed.",
          guidance:
            "Follow the incremental backup recovery runbook. Do not treat staged data as verified.",
        });
      } else if (latest.status === "partial") {
        escalate({
          status: "needs_review",
          reasonCode: "run_partial",
          summary: "The latest run did not fully verify. The watermark has not advanced.",
          guidance: "Review the run before resuming. Use the operator runbook.",
        });
      } else if (latest.verificationState === "pending") {
        escalate({
          status: "needs_review",
          reasonCode: "verification_pending",
          summary: "The latest run has not finished verification yet.",
          guidance: "Wait for verification to complete, then refresh Backup & Sync.",
        });
      } else if (isVerifiedSuccess(latest)) {
        const cutoffMatch = watermarkMatchesCutoff(input.watermarkTimestamp, latest.cutoffTo);
        if (cutoffMatch === false) {
          escalate({
            status: "failed",
            reasonCode: "watermark_mismatch",
            summary: "The watermark does not match the latest verified cutoff.",
            guidance:
              "Follow the incremental backup recovery runbook. Do not edit the watermark manually.",
          });
        } else {
          escalate({
            status: "healthy",
            reasonCode: latest.emptyRange ? "empty_success" : "verified_success",
            summary: latest.emptyRange
              ? "Backup verified with an empty successful range. No action is required."
              : "Backup verified. No action is required.",
            guidance: "Backup verified. No action is required.",
          });
        }
      } else {
        escalate({
          status: "needs_review",
          reasonCode: "undetermined",
          summary: "Current backup status cannot be fully determined from source data.",
          guidance: "Review the latest run and notification history.",
        });
      }
    }

    if (active) {
      const anchor = Date.parse(active.lastCheckpointAt ?? active.startedAt);
      const age = Number.isFinite(anchor) ? nowMs - anchor : Number.POSITIVE_INFINITY;
      if (age >= HUBSPOT_INCREMENTAL_STUCK_AGE_MS) {
        escalate({
          status: "failed",
          reasonCode: "stuck_active_run",
          summary: "An incremental notes backup run is stuck beyond the stale threshold.",
          guidance:
            "Follow the incremental backup recovery runbook. The watermark must not be advanced manually.",
        });
      } else {
        escalate({
          status: "needs_review",
          reasonCode: "active_run_in_progress",
          summary: "An incremental notes backup run is currently in progress.",
          guidance: "Allow the run to finish. Review again if it exceeds the normal window.",
        });
      }
    }

    if (lastExpectedAt) {
      const lastExpectedMs = Date.parse(lastExpectedAt);
      const verifiedAt =
        latest && isVerifiedSuccess(latest)
          ? Date.parse(latest.completedAt ?? latest.startedAt)
          : NaN;
      const covered = Number.isFinite(verifiedAt) && verifiedAt >= lastExpectedMs;
      if (!covered && nowMs > lastExpectedMs + HUBSPOT_BACKUP_HEALTH_GRACE_MS) {
        const overdueFailed =
          latest &&
          (latest.status === "failed" || latest.verificationState === "failed");
        escalate({
          status: overdueFailed ? "failed" : "needs_review",
          reasonCode: overdueFailed ? "overdue_with_failure" : "expected_run_overdue",
          summary: overdueFailed
            ? "The expected backup window is overdue and the latest run failed."
            : "The expected backup has not completed within its normal window.",
          guidance: overdueFailed
            ? "Follow the incremental backup recovery runbook."
            : "Review the latest run and notification history.",
        });
      }
    }

    const alert = input.latestRelevantAlert;
    if (alert && latest && isVerifiedSuccess(latest)) {
      const alertMs = Date.parse(alert.createdAt);
      const verifiedMs = Date.parse(latest.completedAt ?? latest.startedAt);
      if (Number.isFinite(alertMs) && Number.isFinite(verifiedMs) && alertMs > verifiedMs) {
        if (isCriticalHubspotBackupAlert(alert)) {
          escalate({
            status: "failed",
            reasonCode: "unresolved_failure_alert",
            summary:
              "A critical backup failure notification remains unresolved after the latest success.",
            guidance: "Review FI Admin notifications and the incremental backup runbook.",
          });
        } else if (isWarningHubspotBackupAlert(alert)) {
          escalate({
            status: "needs_review",
            reasonCode: "unresolved_warning_alert",
            summary: "A backup warning notification exists after the latest verified success.",
            guidance: "Review the latest notification history before the next schedule window.",
          });
        }
      }
    } else if (alert && (!latest || !isVerifiedSuccess(latest))) {
      if (isCriticalHubspotBackupAlert(alert)) {
        escalate({
          status: "failed",
          reasonCode: "unresolved_failure_alert",
          summary: "A critical backup failure notification is open.",
          guidance: "Review FI Admin notifications and the incremental backup runbook.",
        });
      } else if (isWarningHubspotBackupAlert(alert)) {
        escalate({
          status: "needs_review",
          reasonCode: "unresolved_warning_alert",
          summary: "A backup warning notification is open.",
          guidance: "Review the latest notification history.",
        });
      }
    }

    if (!candidate) {
      escalate({
        status: "needs_review",
        reasonCode: "undetermined",
        summary: "Current backup status cannot be fully determined from source data.",
        guidance: "Review the latest run and notification history.",
      });
    }
  }

  const resolved = candidate!;

  return {
    status: resolved.status,
    reasonCode: resolved.reasonCode,
    summary: resolved.summary,
    operatorActionRequired: resolved.status !== "healthy",
    operatorGuidance: resolved.guidance,
    dataset: "notes",
    scheduler: baseScheduler,
    latestRun: latest,
    activeRun: active,
    verification: {
      status: latest?.verificationState ?? null,
      verifiedAt:
        latest && isVerifiedSuccess(latest) ? isoOrNull(latest.completedAt ?? latest.startedAt) : null,
    },
    watermark: {
      value: isoOrNull(input.watermarkTimestamp),
      matchesLatestVerifiedCutoff: match,
    },
    latestRelevantAlert: input.latestRelevantAlert,
    generatedAt,
  };
}

export function redactHubspotBackupHealthForLowRole(
  health: HubspotBackupHealthDerived
): HubspotBackupHealthDerived {
  return {
    ...health,
    reasonCode: health.status === "healthy" ? "verified_success" : health.status,
    latestRun: health.latestRun
      ? {
          runId: "",
          status: health.latestRun.status,
          verificationState: health.latestRun.verificationState,
          cutoffFrom: null,
          cutoffTo: null,
          startedAt: health.latestRun.startedAt,
          completedAt: health.latestRun.completedAt,
          emptyRange: health.latestRun.emptyRange,
          outcome: runOutcomeLabel(health.latestRun),
          counters: null,
        }
      : null,
    activeRun: health.activeRun
      ? {
          runId: "",
          status: health.activeRun.status,
          verificationState: health.activeRun.verificationState,
          cutoffFrom: null,
          cutoffTo: null,
          startedAt: health.activeRun.startedAt,
          completedAt: health.activeRun.completedAt,
          counters: null,
        }
      : null,
    watermark: { value: null, matchesLatestVerifiedCutoff: null },
    latestRelevantAlert: null,
    operatorGuidance:
      health.status === "healthy"
        ? "Backup verified. No action is required."
        : "Operator action may be required. Contact a workspace administrator.",
  };
}
