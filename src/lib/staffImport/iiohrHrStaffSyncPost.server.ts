import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { processIiohrHrStaffSyncPost } from "@/src/lib/staffImport/iiohrHrStaffSyncPost.impl";
import { syncIiohrHrStaffForTenant } from "@/src/lib/staffImport/iiohrHrStaffSync.server";
import { createStaffSyncRun, finishStaffSyncRun } from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";

async function assertTenantExists(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  const { data, error } = await supabaseAdmin().from("fi_tenants").select("id").eq("id", tid).maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/**
 * POST /api/tenants/:tenantId/integrations/iiohr-hr/staff-sync — shared implementation.
 */
export async function postIiohrHrStaffSyncHttp(request: Request, tenantId: string) {
  const rawBody = await request.json().catch(() => null);
  return processIiohrHrStaffSyncPost(
    {
      tenantId,
      secretHeader: request.headers.get("x-iiohr-sync-secret"),
      configuredSecret: process.env.IIOHR_HR_SYNC_SECRET,
      body: rawBody,
    },
    {
      assertTenantExists,
      runSync: syncIiohrHrStaffForTenant,
      createRun: createStaffSyncRun,
      finishRun: finishStaffSyncRun,
    }
  );
}
