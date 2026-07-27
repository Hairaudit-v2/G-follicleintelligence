/**
 * GET /api/tenants/[tenantId]/front-desk/patient-messages/[threadId]
 * Opens canonical staff thread view and acknowledges staff unread.
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { assertFrontDeskPatientMessagesAccess } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesAccess.server";
import { loadFrontDeskPatientMessageThread } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessages.server";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; threadId: string }> }
) {
  try {
    const { tenantId, threadId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");
    if (!threadId?.trim()) return crmJsonError(400, "Missing threadId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const allowed = await assertFrontDeskPatientMessagesAccess(tenantId, "read");
    if (!allowed) return crmJsonError(403, "Patient messaging inbox is not available for this role.");

    const canReply = await assertFrontDeskPatientMessagesAccess(tenantId, "edit");
    const staffUserId = await resolveAuthUserId(req);

    const url = new URL(req.url);
    const acknowledge = url.searchParams.get("ack") !== "0";

    const data = await loadFrontDeskPatientMessageThread(tenantId.trim(), threadId.trim(), {
      acknowledge,
      staffUserId,
      canReply,
    });
    if (!data) return crmJsonError(404, "Thread not found.");

    return crmJsonOk({ data });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
