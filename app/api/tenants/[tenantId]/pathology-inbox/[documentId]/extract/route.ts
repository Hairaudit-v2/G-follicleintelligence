/**
 * POST /api/tenants/[tenantId]/pathology-inbox/[documentId]/extract
 * Manually trigger extraction for an inbound document.
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { runPathologyExtractionForDocument } from "@/src/lib/pathology/pathologyExtractionJobRunner.server";
import { readPathologyExtractionEnabled } from "@/src/lib/pathology/pathologyExtractionEnv.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; documentId: string }> }
) {
  try {
    const { tenantId, documentId } = await params;
    if (!tenantId?.trim() || !documentId?.trim()) {
      return crmJsonError(400, "Missing tenantId or documentId.");
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
    const out = await runPathologyExtractionForDocument(
      tenantId.trim(),
      documentId.trim(),
      actingUserId
    );

    return crmJsonOk({ job: out.job, document: out.inbound });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
