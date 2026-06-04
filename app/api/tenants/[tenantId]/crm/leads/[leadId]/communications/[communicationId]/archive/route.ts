/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/communications/[communicationId]/archive
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmArchiveLeadCommunicationBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { archiveCrmLeadCommunication } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(
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

    crmArchiveLeadCommunicationBodySchema.parse(body);

    const communication = await archiveCrmLeadCommunication({ tenantId, leadId, communicationId });
    return crmJsonOk({ communication });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
