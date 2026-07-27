/**
 * GET /api/tenants/[tenantId]/front-desk/patient-messages
 * Front Desk patient-message work queue (tenant-scoped, canonical gateway store).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  assertFrontDeskPatientMessagesAccess,
} from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesAccess.server";
import { loadFrontDeskPatientMessageQueue } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessages.server";
import type { FrontDeskPatientMessageQueueFilter } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesCore";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const allowed = await assertFrontDeskPatientMessagesAccess(tenantId, "read");
    if (!allowed) return crmJsonError(403, "Patient messaging inbox is not available for this role.");

    const url = new URL(req.url);
    const filterParam = url.searchParams.get("filter");
    const filter: FrontDeskPatientMessageQueueFilter =
      filterParam === "unread" ? "unread" : "all";

    const data = await loadFrontDeskPatientMessageQueue(tenantId.trim(), { filter });
    return crmJsonOk({ data });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
