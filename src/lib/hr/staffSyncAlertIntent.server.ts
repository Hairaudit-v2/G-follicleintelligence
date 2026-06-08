import "server-only";

import { z } from "zod";

import { loadIiohrHrStaffSyncHealthJson } from "@/src/lib/hr/iiohrHrStaffSyncHealth.server";
import type { ScheduledIiohrHrStaffSyncCoreResult } from "@/src/lib/hr/runScheduledIiohrHrStaffSyncCore";

/**
 * Placeholder for future email alerts when `STAFF_SYNC_ALERT_EMAIL` is set.
 * Logs intent only (no addresses, no secrets, no detailed DB errors).
 */
export async function maybeStaffSyncAlertAfterCronRun(
  result: ScheduledIiohrHrStaffSyncCoreResult,
  getEnv: (k: string) => string | undefined
): Promise<void> {
  const email = getEnv("STAFF_SYNC_ALERT_EMAIL")?.trim();
  if (!email) return;

  const tenant = getEnv("EVOLVED_PERTH_TENANT_ID")?.trim();
  const tenantOk = tenant ? z.string().uuid().safeParse(tenant).success : false;
  const tenantPrefix = tenantOk ? `${tenant!.slice(0, 8)}…` : "unknown-tenant";

  if (!result.ok) {
    console.info(
      "[staff_sync_alert_intent]",
      JSON.stringify({
        kind: "cron_run_failed",
        at: new Date().toISOString(),
        tenant_prefix: tenantPrefix,
        note: "STAFF_SYNC_ALERT_EMAIL is set; wire email delivery when ready.",
      })
    );
    return;
  }

  const health = await loadIiohrHrStaffSyncHealthJson(getEnv);
  if (health.stale || !health.ok) {
    console.info(
      "[staff_sync_alert_intent]",
      JSON.stringify({
        kind: "cron_stale_or_degraded",
        at: new Date().toISOString(),
        tenant_prefix: tenantPrefix,
        stale: health.stale,
        health_ok: health.ok,
        note: "STAFF_SYNC_ALERT_EMAIL is set; wire email delivery when ready.",
      })
    );
  }
}
