/**
 * GET /api/tenants/[tenantId]/crm/leads/[leadId] — lead detail (tenant-scoped).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { loadCrmLeadById } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const lead = await loadCrmLeadById(leadId, tenantId);
    if (!lead) return crmJsonError(404, "Lead not found.");

    return crmJsonOk({ lead });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
