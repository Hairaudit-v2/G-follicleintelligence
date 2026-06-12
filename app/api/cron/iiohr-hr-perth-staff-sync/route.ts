/**
 * GET or POST /api/cron/iiohr-hr-perth-staff-sync
 * Authorisation: `Authorization: Bearer` with `CRON_SECRET` or `FI_HR_SYNC_CRON_SECRET` (Vercel Cron invokes GET with Bearer `CRON_SECRET`).
 * Scheduled Evolved Perth HR → FI staff sync (commit). See docs/iiohr-hr-perth-staff-sync-cron.md.
 */
import { NextRequest } from "next/server";

import { handleIiohrHrPerthStaffSyncCronPost } from "@/src/lib/hr/iiohrHrPerthStaffSyncCron";
import { runScheduledIiohrHrStaffSync } from "@/src/lib/hr/runScheduledIiohrHrStaffSync.server";
import { maybeStaffSyncAlertAfterCronRun } from "@/src/lib/hr/staffSyncAlertIntent.server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleIiohrHrPerthStaffSyncCronPost(req, {
    getEnv: (k) => process.env[k],
    runScheduled: runScheduledIiohrHrStaffSync,
    timeoutMs: 55_000,
    afterRun: maybeStaffSyncAlertAfterCronRun,
  });
}

export async function GET(req: NextRequest) {
  return handleIiohrHrPerthStaffSyncCronPost(req, {
    getEnv: (k) => process.env[k],
    runScheduled: runScheduledIiohrHrStaffSync,
    timeoutMs: 55_000,
    afterRun: maybeStaffSyncAlertAfterCronRun,
  });
}
