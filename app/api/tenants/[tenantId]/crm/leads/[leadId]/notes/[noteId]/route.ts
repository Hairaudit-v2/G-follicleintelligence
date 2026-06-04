/**
 * PATCH /api/tenants/[tenantId]/crm/leads/[leadId]/notes/[noteId]
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmUpdateLeadNoteBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { updateCrmLeadNote } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; leadId: string; noteId: string }> }
) {
  try {
    const { tenantId, leadId, noteId } = await params;
    if (!tenantId?.trim() || !leadId?.trim() || !noteId?.trim()) {
      return crmJsonError(400, "Missing tenantId, leadId, or noteId.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmUpdateLeadNoteBodySchema.parse(body);

    const note = await updateCrmLeadNote({
      tenantId,
      leadId,
      noteId,
      ...(parsed.noteBody !== undefined ? { noteBody: parsed.noteBody } : {}),
      ...(parsed.noteVisibility !== undefined ? { noteVisibility: parsed.noteVisibility } : {}),
      ...(parsed.isPinned !== undefined ? { isPinned: parsed.isPinned } : {}),
    });

    return crmJsonOk({ note });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
