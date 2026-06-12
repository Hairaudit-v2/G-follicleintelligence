import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { processIiohrHrStaffSyncPost } from "@/src/lib/staffImport/iiohrHrStaffSyncPost.impl";
import { syncIiohrHrStaffForTenant } from "@/src/lib/staffImport/iiohrHrStaffSync.server";
import { createStaffSyncRun, finishStaffSyncRun } from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";
import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH, timingSafeUtf8Equal } from "@/src/lib/security/timingSafeSecret";

async function assertTenantExists(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  const { data, error } = await supabaseAdmin().from("fi_tenants").select("id").eq("id", tid).maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/**
 * POST /api/tenants/:tenantId/integrations/iiohr-hr/staff-sync — shared implementation.
 * Validates `x-iiohr-sync-secret` before reading the JSON body.
 */
export async function postIiohrHrStaffSyncHttp(request: Request, tenantId: string) {
  const configured = process.env.IIOHR_HR_SYNC_SECRET?.trim();
  if (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    return { httpStatus: 503 as const, body: { ok: false, error: "Service unavailable." } };
  }

  const secretHeader = request.headers.get("x-iiohr-sync-secret")?.trim() ?? null;
  if (secretHeader == null || !timingSafeUtf8Equal(configured, secretHeader)) {
    return { httpStatus: 401 as const, body: { ok: false, error: "Unauthorized." } };
  }

  const rawBody = await request.json().catch(() => null);
  return processIiohrHrStaffSyncPost(
    {
      tenantId,
      secretHeader,
      configuredSecret: process.env.IIOHR_HR_SYNC_SECRET,
      body: rawBody,
      callerSecretVerified: true,
      syncSource: request.headers.get("x-fi-staff-sync-source"),
    },
    {
      assertTenantExists,
      runSync: syncIiohrHrStaffForTenant,
      createRun: createStaffSyncRun,
      finishRun: finishStaffSyncRun,
    }
  );
}
