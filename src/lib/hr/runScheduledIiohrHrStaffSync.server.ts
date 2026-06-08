import "server-only";

import { z } from "zod";

import { pushStaffSyncToFi } from "@/src/lib/hr/iiohrFiStaffSyncPush";
import { loadEvolvedPerthHrStaffRecordsForFiPush } from "@/src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server";
import {
  runScheduledIiohrHrStaffSyncCore,
  type ScheduledIiohrHrStaffSyncCoreResult,
} from "@/src/lib/hr/runScheduledIiohrHrStaffSyncCore";

/**
 * Scheduled Evolved Perth HR → FI staff sync (commit). Used by `/api/cron/iiohr-hr-perth-staff-sync`.
 */
export async function runScheduledIiohrHrStaffSync(): Promise<ScheduledIiohrHrStaffSyncCoreResult> {
  const tenantId = process.env.EVOLVED_PERTH_TENANT_ID?.trim() ?? "";
  if (!tenantId) {
    return {
      ok: false,
      error: "EVOLVED_PERTH_TENANT_ID is not configured.",
      rowsSent: 0,
      runId: null,
      created: null,
      updated: null,
      linked: null,
      skipped: null,
      warnings: [],
    };
  }
  if (!z.string().uuid().safeParse(tenantId).success) {
    return {
      ok: false,
      error: "EVOLVED_PERTH_TENANT_ID is not a valid UUID.",
      rowsSent: 0,
      runId: null,
      created: null,
      updated: null,
      linked: null,
      skipped: null,
      warnings: [],
    };
  }

  const allowEmptyFeed = process.env.ALLOW_EMPTY_HR_SYNC?.trim() === "true";
  const syncSecretForScrub = process.env.IIOHR_HR_SYNC_SECRET?.trim();

  return runScheduledIiohrHrStaffSyncCore({
    tenantId,
    allowEmptyFeed,
    loadHrStaff: loadEvolvedPerthHrStaffRecordsForFiPush,
    pushFi: pushStaffSyncToFi,
    syncSecretForScrub,
  });
}
