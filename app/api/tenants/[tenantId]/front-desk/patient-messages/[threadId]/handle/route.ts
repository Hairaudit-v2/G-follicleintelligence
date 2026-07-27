/**
 * POST /api/tenants/[tenantId]/front-desk/patient-messages/[threadId]/handle
 * Explicit staff "Handled" — does not run on toast dismiss.
 */
import { assertCrmTenantReadAllowed, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  assertFrontDeskPatientMessagesAccess,
  markFrontDeskPatientMessageHandled,
} from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessages.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; threadId: string }> }
) {
  try {
    const { tenantId, threadId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");
    if (!threadId?.trim()) return crmJsonError(400, "Missing threadId.");

    const adminKey = extractAdminKeyFromRequest(req);
    // Membership gate (same as Front Desk reads); edit capability checked below.
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const allowed = await assertFrontDeskPatientMessagesAccess(tenantId, "edit");
    if (!allowed) return crmJsonError(403, "Not authorised to handle patient messages.");

    const staffUserId = await resolveAuthUserId(req);
    const result = await markFrontDeskPatientMessageHandled(tenantId.trim(), threadId.trim(), {
      staffUserId,
    });
    if (!result.ok) return crmJsonError(404, "Thread not found.");

    return crmJsonOk({ handled: true });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
