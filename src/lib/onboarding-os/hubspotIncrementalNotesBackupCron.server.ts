/**
 * GET /api/cron/hubspot/incremental-notes-backup
 * Vercel Cron wrapper for Stage P3 scheduled HubSpot notes incremental backup.
 * Auth: Bearer CRON_SECRET or FI_HUBSPOT_INCREMENTAL_BACKUP_CRON_SECRET,
 * or header x-fi-hubspot-incremental-backup-secret.
 */
import { NextRequest, NextResponse } from "next/server";

import { runScheduledHubspotIncrementalNotesBackup } from "@/src/lib/onboarding-os/hubspotScheduledIncrementalBackup.server";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";

export async function handleHubspotIncrementalNotesBackupCronGet(
  req: NextRequest,
  opts?: {
    getEnv?: (key: string) => string | undefined;
    runScheduled?: typeof runScheduledHubspotIncrementalNotesBackup;
  }
): Promise<Response> {
  if (req.method !== "GET") {
    return NextResponse.json({ ok: false, error: "Method not allowed." }, { status: 405 });
  }

  const getEnv = opts?.getEnv ?? ((key: string) => process.env[key]);
  const auth = assertCronAuthorized(
    req,
    [
      getEnv("CRON_SECRET") ?? "",
      getEnv("FI_HUBSPOT_INCREMENTAL_BACKUP_CRON_SECRET") ?? "",
    ],
    { alternateTimingSafeHeaderName: "x-fi-hubspot-incremental-backup-secret" }
  );
  if (auth) return auth;

  try {
    const run = opts?.runScheduled ?? runScheduledHubspotIncrementalNotesBackup;
    const result = await run({ getEnv });
    return NextResponse.json(
      {
        ok: result.ok,
        outcome: result.outcome,
        run_id: result.runId,
        dataset: result.dataset,
        tenant_id: result.tenantId,
        integration_id: result.integrationId,
        cutoff_from: result.cutoffFrom,
        cutoff_to: result.cutoffTo,
        watermark_before: result.watermarkBefore,
        watermark_after: result.watermarkAfter,
        counters: result.counters,
        status: result.status,
        verification_state: result.verificationState,
        empty_range: result.emptyRange,
        attempts: result.attempts,
        scheduler_source: result.schedulerSource,
        invocation_timestamp: result.invocationTimestamp,
        next_expected_run_at: result.nextExpectedRunAt,
        alert_id: result.alertId,
        error: result.error,
        runbook: result.runbook,
      },
      { status: result.httpStatus }
    );
  } catch (error) {
    logStructured("error", "hubspot_incremental_notes_backup_cron_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "Scheduled backup failed." }, { status: 500 });
  }
}
