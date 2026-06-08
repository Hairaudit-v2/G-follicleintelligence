/**
 * GET /api/health/iiohr-hr-staff-sync
 * JSON snapshot from `fi_staff_sync_runs` for the Evolved Perth tenant (`EVOLVED_PERTH_TENANT_ID`).
 * No authentication — returns aggregates only (no secrets).
 */
import { NextResponse } from "next/server";

import { loadIiohrHrStaffSyncHealthJson } from "@/src/lib/hr/iiohrHrStaffSyncHealth.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await loadIiohrHrStaffSyncHealthJson((k) => process.env[k]);
  return NextResponse.json(body);
}
