/**
 * PATCH /api/tenants/[tenantId]/crm/leads/[leadId]/communications/[communicationId]
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmUpdateLeadCommunicationBodySchema } from "@/src/lib/crm/crmApiSchemas";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { updateCrmLeadCommunication } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; leadId: string; communicationId: string }> }
) {
  try {
    const { tenantId, leadId, communicationId } = await params;
    if (!tenantId?.trim() || !leadId?.trim() || !communicationId?.trim()) {
      return crmJsonError(400, "Missing tenantId, leadId, or communicationId.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmUpdateLeadCommunicationBodySchema.parse(body);

    const communication = await updateCrmLeadCommunication({
      tenantId,
      leadId,
      communicationId,
      ...(parsed.communicationType !== undefined
        ? { communicationType: parsed.communicationType }
        : {}),
      ...(parsed.direction !== undefined ? { direction: parsed.direction } : {}),
      ...(parsed.outcome !== undefined ? { outcome: parsed.outcome } : {}),
      ...(parsed.subject !== undefined ? { subject: parsed.subject } : {}),
      ...(parsed.preview !== undefined ? { preview: parsed.preview } : {}),
      ...(parsed.contactAt !== undefined ? { contactAt: parsed.contactAt } : {}),
      ...(parsed.nextFollowUpAt !== undefined ? { nextFollowUpAt: parsed.nextFollowUpAt } : {}),
      ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
    });

    return crmJsonOk({ communication });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
