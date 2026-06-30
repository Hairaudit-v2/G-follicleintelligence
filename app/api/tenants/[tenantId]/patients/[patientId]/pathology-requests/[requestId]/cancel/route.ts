/**
 * POST …/pathology-requests/[requestId]/cancel — void a saved request (CRM write role).
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { cancelPathologyRequest } from "@/src/lib/pathology/pathologyRequestMutations.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string; requestId: string }> }
) {
  try {
    const { tenantId, patientId, requestId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !requestId?.trim())
      return crmJsonError(400, "Missing route parameters.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const row = await cancelPathologyRequest({ tenantId, patientId, requestId });
    return crmJsonOk({ pathology_request: row });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
