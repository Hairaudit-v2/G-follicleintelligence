/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/convert
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmConvertLeadBodySchema } from "@/src/lib/crm/crmApiSchemas";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { executeCrmLeadConversion } from "@/src/lib/crm/server";

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

    const parsed = crmConvertLeadBodySchema.parse(body);
    const convertedByUserId = await tryResolveFiUserIdForTenant(tenantId, req);

    const result = await executeCrmLeadConversion({
      tenantId,
      leadId,
      seedCase: parsed.seedCase ?? false,
      caseType: parsed.caseType,
      treatmentInterest: parsed.treatmentInterest,
      conversionNote: parsed.conversionNote,
      convertedByUserId,
    });

    return crmJsonOk({ result });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
