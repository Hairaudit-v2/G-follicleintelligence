/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/notes/[noteId]/archive
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmArchiveLeadNoteBodySchema } from "@/src/lib/crm/crmApiSchemas";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { archiveCrmLeadNote } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(
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

    crmArchiveLeadNoteBodySchema.parse(body);

    const note = await archiveCrmLeadNote({ tenantId, leadId, noteId });
    return crmJsonOk({ note });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
