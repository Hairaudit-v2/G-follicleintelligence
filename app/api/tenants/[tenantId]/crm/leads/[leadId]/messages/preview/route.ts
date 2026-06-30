/**
 * POST …/messages/preview — preview-only CRM message row.
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmMessagePreviewBodySchema } from "@/src/lib/crm/crmApiSchemas";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { assertMessagePayloadHasNoForbiddenBodyKeys } from "@/src/lib/crm/messageBodyKeysPolicy";
import { createCrmMessagePreview } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; leadId: string }> }
) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim())
      return crmJsonError(400, "Missing tenantId or leadId.");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body && typeof body === "object") {
      assertMessagePayloadHasNoForbiddenBodyKeys(body);
    }

    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmMessagePreviewBodySchema.parse(body);

    const message = await createCrmMessagePreview({
      tenantId,
      leadId,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
      preview: parsed.preview as Record<string, unknown>,
    });

    return crmJsonOk({ message });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
