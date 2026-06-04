/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/notes
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmCreateLeadNoteBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { createCrmLeadNote } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmCreateLeadNoteBodySchema.parse(body);
    const authorUserId = await tryResolveFiUserIdForTenant(tenantId, req);

    const note = await createCrmLeadNote({
      tenantId,
      leadId,
      noteBody: parsed.noteBody,
      noteVisibility: parsed.noteVisibility,
      isPinned: parsed.isPinned,
      authorUserId,
    });

    return crmJsonOk({ note });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
