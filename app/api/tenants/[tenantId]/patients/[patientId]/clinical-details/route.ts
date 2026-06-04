/**
 * PATCH /api/tenants/[tenantId]/patients/[patientId]/clinical-details
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { patientClinicalDetailsPatchBodySchema } from "@/src/lib/patients/clinicalDetailsApiSchemas";
import { updatePatientClinicalDetails } from "@/src/lib/patients/clinicalDetailsServer";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ tenantId: string; patientId: string }> }) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim()) return crmJsonError(400, "Missing tenantId or patientId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = patientClinicalDetailsPatchBodySchema.parse(body);

    const result = await updatePatientClinicalDetails({
      tenantId,
      patientId,
      patch: parsed,
      request: req,
    });

    return crmJsonOk({
      clinical_details: result.row,
      created: result.created,
      changed_keys: result.changedKeys,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
