/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/vie/capture/retake
 * Body JSON: { session_id, slot_slug }
 */
import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { retakeVieProtocolCapture } from "@/src/lib/vie/vieGuidedCapture.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
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

    if (!sessionId || !slotSlug) {
      return crmJsonError(400, "session_id and slot_slug are required.");
    }

    const guided_session = await retakeVieProtocolCapture({
      tenantId: tid,
      patientId: pid,
      sessionId,
      slotSlug,
    });

    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    revalidatePath(`/fi-admin/${tid}/surgery-os`);

    return crmJsonOk({ guided_session });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
