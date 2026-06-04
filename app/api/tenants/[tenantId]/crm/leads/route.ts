/**
 * POST /api/tenants/[tenantId]/crm/leads — create lead (+ person resolution).
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmCreateLeadBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { createCrmLeadWithPerson } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmCreateLeadBodySchema.parse(body);

    if (parsed.personId) {
      const lead = await createCrmLeadWithPerson({
        tenantId,
        organisationId: parsed.organisationId ?? undefined,
        clinicId: parsed.clinicId ?? undefined,
        patientId: parsed.patientId ?? undefined,
        caseId: parsed.caseId ?? undefined,
        primaryOwnerUserId: parsed.primaryOwnerUserId ?? undefined,
        status: parsed.status,
        priority: parsed.priority ?? undefined,
        summary: parsed.summary,
        metadata: parsed.metadata ?? undefined,
        pipelineKey: parsed.pipelineKey,
        sourceSystem: parsed.sourceSystem ?? undefined,
        sourceLeadId: parsed.sourceLeadId ?? undefined,
        personId: parsed.personId,
      });
      return crmJsonOk({ lead });
    }

    if (parsed.person) {
      const lead = await createCrmLeadWithPerson({
        tenantId,
        organisationId: parsed.organisationId ?? undefined,
        clinicId: parsed.clinicId ?? undefined,
        patientId: parsed.patientId ?? undefined,
        caseId: parsed.caseId ?? undefined,
        primaryOwnerUserId: parsed.primaryOwnerUserId ?? undefined,
        status: parsed.status,
        priority: parsed.priority ?? undefined,
        summary: parsed.summary,
        metadata: parsed.metadata ?? undefined,
        pipelineKey: parsed.pipelineKey,
        sourceSystem: parsed.sourceSystem ?? undefined,
        sourceLeadId: parsed.sourceLeadId ?? undefined,
        person: {
          source_system: parsed.person.source_system ?? undefined,
          source_person_id: parsed.person.source_person_id ?? undefined,
          source_patient_id: parsed.person.source_patient_id ?? undefined,
          display_name: parsed.person.display_name ?? undefined,
          email: parsed.person.email ?? undefined,
          phone: parsed.person.phone ?? undefined,
          date_of_birth: parsed.person.date_of_birth ?? undefined,
          sex: parsed.person.sex ?? undefined,
          metadata: parsed.person.metadata ?? undefined,
        },
      });
      return crmJsonOk({ lead });
    }

    return crmJsonError(400, "Provide personId or person with resolution fields.");
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
