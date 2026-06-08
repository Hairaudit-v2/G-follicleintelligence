/**
 * POST /api/cron/iiohr-hr-perth-staff-sync
 * Authorisation: `Authorization: Bearer <CRON_SECRET>`.
 * Scheduled Evolved Perth HR → FI staff sync (commit). See docs/iiohr-hr-perth-staff-sync-cron.md.
 */
import { NextResponse } from "next/server";

import { handleIiohrHrPerthStaffSyncCronPost } from "@/src/lib/hr/iiohrHrPerthStaffSyncCron";
import { runScheduledIiohrHrStaffSync } from "@/src/lib/hr/runScheduledIiohrHrStaffSync.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleIiohrHrPerthStaffSyncCronPost(req, {
    getEnv: (k) => process.env[k],
    runScheduled: runScheduledIiohrHrStaffSync,
    timeoutMs: 55_000,
  });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed." }, { status: 405 });
}
