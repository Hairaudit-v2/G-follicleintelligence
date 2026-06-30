/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/pathology-requests
 * DoctorOS Stage 1: create a blood / pathology request with line items + CRM audit row.
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { createPathologyRequestBodySchema } from "@/src/lib/pathology/pathologyRequestApiSchemas";
import { createPathologyRequest } from "@/src/lib/pathology/pathologyRequestMutations.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim())
      return crmJsonError(400, "Missing tenantId or patientId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = createPathologyRequestBodySchema.parse(body);
    const doctorUserId = await tryResolveFiUserIdForTenant(tenantId, req);

    const requestDate = parsed.request_date?.trim() || new Date().toISOString().slice(0, 10);

    const result = await createPathologyRequest({
      tenantId,
      patientId,
      templateUsed: parsed.template_used,
      requestDate,
      doctorUserId,
      clinicalNotes: parsed.clinical_notes?.trim() ? parsed.clinical_notes.trim() : null,
      tests: parsed.tests.map((t) => ({
        code: t.code?.trim() ? t.code.trim() : null,
        label: t.label.trim(),
      })),
    });

    return crmJsonOk({
      pathology_request: result.request,
      items: result.items,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
