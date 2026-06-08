/**
 * POST …/pathology-requests/[requestId]/send-to-patient — email PDF to patient (CRM write role).
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { sendPathologyRequestToPatientBodySchema } from "@/src/lib/pathology/pathologyRequestApiSchemas";
import { sendPathologyRequestToPatientEmail } from "@/src/lib/pathology/pathologySendToPatient.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; patientId: string; requestId: string }> }) {
  try {
    const { tenantId, patientId, requestId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !requestId?.trim()) return crmJsonError(400, "Missing route parameters.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = sendPathologyRequestToPatientBodySchema.parse(body);
    const result = await sendPathologyRequestToPatientEmail({
      tenantId,
      patientId,
      requestId,
      personalNote: parsed.personal_note,
    });

    return crmJsonOk({ resend_id: result.resendId, to: result.to });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
