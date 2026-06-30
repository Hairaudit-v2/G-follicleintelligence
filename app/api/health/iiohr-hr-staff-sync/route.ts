/**
 * GET /api/health/iiohr-hr-staff-sync
 * JSON snapshot from `fi_staff_sync_runs` for the Evolved Perth tenant (`EVOLVED_PERTH_TENANT_ID`).
 * Production: requires Bearer `CRON_SECRET` or `FI_HR_SYNC_CRON_SECRET` (same as HR cron).
 */
import { NextRequest, NextResponse } from "next/server";

import { loadIiohrHrStaffSyncHealthJson } from "@/src/lib/hr/iiohrHrStaffSyncHealth.server";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = assertCronAuthorized(req, [
      process.env.CRON_SECRET ?? "",
      process.env.FI_HR_SYNC_CRON_SECRET ?? "",
    ]);
    if (auth) return auth;
  }

  const body = await loadIiohrHrStaffSyncHealthJson((k) => process.env[k]);
  return NextResponse.json(body);
}
