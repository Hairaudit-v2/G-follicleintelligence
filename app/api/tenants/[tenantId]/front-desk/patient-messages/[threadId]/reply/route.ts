/**
 * POST /api/tenants/[tenantId]/front-desk/patient-messages/[threadId]/reply
 * Clinic → patient reply into the same canonical gateway thread.
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
  replyFrontDeskPatientMessage,
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
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const allowed = await assertFrontDeskPatientMessagesAccess(tenantId, "edit");
    if (!allowed) return crmJsonError(403, "Not authorised to reply to patient messages.");

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const raw =
      body && typeof body === "object" && "body" in (body as object)
        ? (body as { body: unknown }).body
        : undefined;

    const staffUserId = await resolveAuthUserId(req);
    const result = await replyFrontDeskPatientMessage(tenantId.trim(), threadId.trim(), raw, {
      staffUserId,
      senderLabel: "Clinical Team",
    });

    if (!result.ok) {
      const status =
        result.code === "not_found"
          ? 404
          : result.code === "thread_closed"
            ? 409
            : 400;
      return crmJsonError(status, result.message);
    }

    return crmJsonOk({ message: result.message });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
