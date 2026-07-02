/**
 * GET /api/tenants/[tenantId]/procedure-day
 * Procedure Day board full-tier hydration (tenant-scoped).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { loadProcedureDayBoardForTenant } from "@/src/lib/procedureDay/procedureDayOrchestrator.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const data = await loadProcedureDayBoardForTenant(tenantId.trim(), {
      enforceCrmReadGate: true,
      adminKey,
      request: req,
      tier: "full",
    });

    return crmJsonOk({ data });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}