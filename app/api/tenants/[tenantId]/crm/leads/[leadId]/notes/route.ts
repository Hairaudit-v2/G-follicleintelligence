/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/notes
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmCreateNoteBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { createCrmNoteForLead } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmCreateNoteBodySchema.parse(body);

    const note = await createCrmNoteForLead({
      tenantId,
      leadId,
      body: parsed.body,
      visibility: parsed.visibility,
      authorUserId: parsed.authorUserId ?? null,
      metadata: parsed.metadata ?? null,
    });

    return crmJsonOk({ note });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
