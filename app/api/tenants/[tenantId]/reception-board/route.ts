/**
 * GET /api/tenants/[tenantId]/reception-board
 * Reception Board Command Center live refresh payload (tenant-scoped).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { loadReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoard.server";
import { serializeReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoardPayloadSchema";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const data = await loadReceptionBoardCommandCenterPayload(tenantId.trim(), new Date(), {
      enforceCrmReadGate: true,
      adminKey,
      request: req,
    });

    return crmJsonOk({
      data: serializeReceptionBoardCommandCenterPayload(data),
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}