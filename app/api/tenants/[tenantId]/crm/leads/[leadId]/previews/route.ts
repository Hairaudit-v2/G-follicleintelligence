/**
 * GET …/previews — tasks, notes, and message previews for a lead.
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  loadCrmMessagesForLead,
  loadCrmNotesForLead,
  loadCrmTasksForLead,
} from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; leadId: string }> }
) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim())
      return crmJsonError(400, "Missing tenantId or leadId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const lim = Number.isFinite(limit) ? limit : undefined;

    const [tasks, notes, messages] = await Promise.all([
      loadCrmTasksForLead(tenantId, leadId, { limit: lim }),
      loadCrmNotesForLead(tenantId, leadId, { limit: lim }),
      loadCrmMessagesForLead(tenantId, leadId, { limit: lim }),
    ]);

    return crmJsonOk({ tasks, notes, messages });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
