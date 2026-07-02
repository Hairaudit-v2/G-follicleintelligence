/**
 * POST /api/tenants/[tenantId]/pathology-extraction-jobs/[jobId]/dismiss
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { dismissPathologyExtractionJob } from "@/src/lib/pathology/pathologyExtractionJobRunner.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; jobId: string }> }
) {
  try {
    const { tenantId, jobId } = await params;
    if (!tenantId?.trim() || !jobId?.trim()) {
      return crmJsonError(400, "Missing tenantId or jobId.");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);
    const job = await dismissPathologyExtractionJob(tenantId.trim(), jobId.trim(), actingUserId);

    return crmJsonOk({ job });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
