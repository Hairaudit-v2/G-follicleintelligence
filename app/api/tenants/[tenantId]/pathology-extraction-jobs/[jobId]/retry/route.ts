/**
 * POST /api/tenants/[tenantId]/pathology-extraction-jobs/[jobId]/retry
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { retryPathologyExtractionJob } from "@/src/lib/pathology/pathologyExtractionJobRunner.server";
import { readPathologyExtractionEnabled } from "@/src/lib/pathology/pathologyExtractionEnv.server";

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

    if (!readPathologyExtractionEnabled()) {
      return crmJsonError(403, "Pathology extraction is disabled.");
    }

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);
    const out = await retryPathologyExtractionJob(tenantId.trim(), jobId.trim(), actingUserId);

    return crmJsonOk({ job: out.job, document: out.inbound });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
