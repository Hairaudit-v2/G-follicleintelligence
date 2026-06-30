import "server-only";

import { z } from "zod";

import {
  computeIiohrHrStaffSyncHealth,
  parseStaffSyncStaleWarningHours,
  type IiohrHrStaffSyncHealthJson,
  type StaffSyncRunHealthRef,
} from "@/src/lib/hr/iiohrHrStaffSyncHealth";
import { listRecentStaffSyncRunsForTenant } from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";

function mapRuns(
  rows: Awaited<ReturnType<typeof listRecentStaffSyncRunsForTenant>>
): StaffSyncRunHealthRef[] {
  return rows.map((r) => ({
    status: r.status,
    started_at: r.started_at,
    finished_at: r.finished_at,
    error_message: r.error_message,
    metadata: r.metadata,
  }));
}

export async function loadIiohrHrStaffSyncHealthJson(
  getEnv: (k: string) => string | undefined
): Promise<IiohrHrStaffSyncHealthJson> {
  const tid = getEnv("EVOLVED_PERTH_TENANT_ID")?.trim() ?? null;
  const hours = parseStaffSyncStaleWarningHours(getEnv);
  const validTenant = tid && z.string().uuid().safeParse(tid).success;
  const runs = validTenant ? mapRuns(await listRecentStaffSyncRunsForTenant(tid!, 100)) : [];
  return computeIiohrHrStaffSyncHealth({
    evolvedTenantId: tid,
    runs,
    staleWarningHours: hours,
    nowMs: Date.now(),
  });
}
