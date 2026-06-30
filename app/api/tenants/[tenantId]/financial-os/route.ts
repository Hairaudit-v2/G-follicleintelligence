/**
 * GET /api/tenants/[tenantId]/financial-os
 * FinancialOS command centre payload (tenant-scoped, smoke-testable).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { loadFinancialOsCommandCentrePayload } from "@/src/lib/financialOs/financialOsCommandCentreLoader.server";
import { parseFinancialOsCommandCentrePayload } from "@/src/lib/financialOs/financialOsCommandCentrePayloadSchema";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const data = await loadFinancialOsCommandCentrePayload(tenantId.trim(), new Date());
    const validated = parseFinancialOsCommandCentrePayload(data);
    return crmJsonOk({ data: validated });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
