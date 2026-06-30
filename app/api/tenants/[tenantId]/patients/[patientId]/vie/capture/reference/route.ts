/**
 * GET /api/tenants/[tenantId]/patients/[patientId]/vie/capture/reference
 * Query: protocol_template_slug, protocol_slot_slug
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { loadVieCaptureReferenceGuidance } from "@/src/lib/vie/vieSameAngleAlignment.server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    const tid = tenantId?.trim() ?? "";
    const pid = patientId?.trim() ?? "";
    if (!tid || !pid) return crmJsonError(400, "Missing tenantId or patientId.");

    const url = new URL(req.url);
    const protocolTemplateSlug = url.searchParams.get("protocol_template_slug")?.trim() ?? "";
    const protocolSlotSlug = url.searchParams.get("protocol_slot_slug")?.trim() ?? "";

    if (!protocolTemplateSlug || !protocolSlotSlug) {
      return crmJsonError(400, "protocol_template_slug and protocol_slot_slug are required.");
    }

    const adminKey = extractAdminKeyFromRequest(req, {});
    await assertCrmTenantReadAllowed({ tenantId: tid, adminKey, request: req });

    const guidance = await loadVieCaptureReferenceGuidance({
      tenantId: tid,
      patientId: pid,
      protocolTemplateSlug,
      protocolSlotSlug,
    });

    return crmJsonOk({ guidance });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
