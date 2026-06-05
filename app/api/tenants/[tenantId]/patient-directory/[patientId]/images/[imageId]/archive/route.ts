/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/images/[imageId]/archive
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonError, crmJsonOk, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { patientImageArchiveBodySchema } from "@/src/lib/patientImages/patientImageApiSchemas";
import { archivePatientImage } from "@/src/lib/patientImages/patientImagesServer";

export const dynamic = "force-dynamic";

export async function POST(
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

    const parsed = patientImageArchiveBodySchema.parse(body);

    const result = await archivePatientImage({
      tenantId,
      patientId,
      imageId,
      archiveReason: parsed.archive_reason,
      request: req,
    });

    return crmJsonOk({ image: result.row, changed_keys: result.changed_keys });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
