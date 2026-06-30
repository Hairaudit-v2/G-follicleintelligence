/**
 * PATCH …/pathology-requests/[requestId] — update clinical notes on a saved request (CRM write role).
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { patchPathologyRequestBodySchema } from "@/src/lib/pathology/pathologyRequestApiSchemas";
import { updatePathologyRequestClinicalNotes } from "@/src/lib/pathology/pathologyRequestMutations.server";

export const dynamic = "force-dynamic";

export async function PATCH(
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

    const parsed = patchPathologyRequestBodySchema.parse(body);
    const row = await updatePathologyRequestClinicalNotes({
      tenantId,
      patientId,
      requestId,
      clinicalNotes: parsed.clinical_notes === null ? null : parsed.clinical_notes.trim() || null,
    });

    return crmJsonOk({ pathology_request: row });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
