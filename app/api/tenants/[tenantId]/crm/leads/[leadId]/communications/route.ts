/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/communications
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmCreateLeadCommunicationBodySchema } from "@/src/lib/crm/crmApiSchemas";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { createCrmLeadCommunication } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; leadId: string }> }
) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim())
      return crmJsonError(400, "Missing tenantId or leadId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmCreateLeadCommunicationBodySchema.parse(body);
    const actorUserId = await tryResolveFiUserIdForTenant(tenantId, req);

    const communication = await createCrmLeadCommunication({
      tenantId,
      leadId,
      communicationType: parsed.communicationType,
      direction: parsed.direction,
      outcome: parsed.outcome,
      subject: parsed.subject,
      preview: parsed.preview,
      externalMessageId: parsed.externalMessageId,
      externalThreadId: parsed.externalThreadId,
      contactAt: parsed.contactAt,
      nextFollowUpAt: parsed.nextFollowUpAt,
      metadata: parsed.metadata,
      actorUserId,
    });

    return crmJsonOk({ communication });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
