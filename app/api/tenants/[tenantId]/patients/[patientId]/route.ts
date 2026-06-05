/**
 * PATCH /api/tenants/[tenantId]/patients/[patientId]
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { patientAdminPatchBodySchema } from "@/src/lib/patients/patientApiSchemas";
import { updatePatientAdminDetails } from "@/src/lib/patients/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ tenantId: string; patientId: string }> }) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim()) return crmJsonError(400, "Missing tenantId or patientId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = patientAdminPatchBodySchema.parse(body);

    const row = await updatePatientAdminDetails({
      tenantId,
      patientId,
      patient_status: parsed.patient_status,
      admin_note: parsed.admin_note,
      reminder_consent: parsed.reminder_consent,
      preferred_contact_method: parsed.preferred_contact_method,
    });

    return crmJsonOk({ patient: row });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
