/**
 * PATCH /api/tenants/[tenantId]/patients/[patientId]/images/[imageId]
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonError, crmJsonOk, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { patientImagePatchBodySchema } from "@/src/lib/patientImages/patientImageApiSchemas";
import { updatePatientImageDetails } from "@/src/lib/patientImages/patientImagesServer";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string; imageId: string }> }
) {
  try {
    const { tenantId, patientId, imageId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !imageId?.trim()) {
      return crmJsonError(400, "Missing tenantId, patientId, or imageId.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = patientImagePatchBodySchema.parse(body);

    const result = await updatePatientImageDetails({
      tenantId,
      patientId,
      imageId,
      patch: parsed,
      request: req,
    });

    return crmJsonOk({ image: result.row, changed_keys: result.changed_keys });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
