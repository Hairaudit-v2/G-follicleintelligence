/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/vie/capture/accept
 * Body JSON: { session_id, slot_slug, quality_override?: boolean }
 */
import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmJsonError, crmJsonOk, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { acceptVieProtocolCapture } from "@/src/lib/vie/vieGuidedCapture.server";
import { regenerateVieComparisonsBestEffort } from "@/src/lib/vie/vieLongitudinalComparison.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; patientId: string }> }) {
  try {
    const { tenantId, patientId } = await params;
    const tid = tenantId?.trim() ?? "";
    const pid = patientId?.trim() ?? "";
    if (!tid || !pid) return crmJsonError(400, "Missing tenantId or patientId.");

    const adminKey = extractAdminKeyFromRequest(req, {});
    await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey, request: req });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = String(body.session_id ?? "").trim();
    const slotSlug = String(body.slot_slug ?? "").trim();
    const qualityOverride = body.quality_override === true;

    if (!sessionId || !slotSlug) {
      return crmJsonError(400, "session_id and slot_slug are required.");
    }

    const actingUserId = await tryResolveFiUserIdForTenant(tid, req);
    const result = await acceptVieProtocolCapture({
      tenantId: tid,
      patientId: pid,
      sessionId,
      slotSlug,
      qualityOverride,
      acceptedByUserId: actingUserId,
    });

    if (!result.review.allowed) {
      return crmJsonError(409, result.review.reason ?? "Capture cannot be accepted.");
    }

    await regenerateVieComparisonsBestEffort({ tenantId: tid, patientId: pid });

    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    revalidatePath(`/fi-admin/${tid}/surgery-os`);

    return crmJsonOk({ guided_session: result.guided_session, review: result.review });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
