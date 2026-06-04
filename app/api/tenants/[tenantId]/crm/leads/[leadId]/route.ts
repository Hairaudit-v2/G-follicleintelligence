/**
 * GET /api/tenants/[tenantId]/crm/leads/[leadId] — lead detail (tenant-scoped).
 * PATCH — update lead details (never stage); gated writes.
 */
import { assertCrmTenantReadAllowed, assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmUpdateLeadDetailsBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { loadCrmLeadById, updateCrmLeadDetails } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const lead = await loadCrmLeadById(leadId, tenantId);
    if (!lead) return crmJsonError(404, "Lead not found.");

    return crmJsonOk({ lead });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmUpdateLeadDetailsBodySchema.parse(body);
    const lead = await updateCrmLeadDetails({
      tenantId,
      leadId,
      summary: parsed.summary,
      status: parsed.status,
      priority: parsed.priority,
      primaryOwnerUserId: parsed.primaryOwnerUserId,
      organisationId: parsed.organisationId,
      clinicId: parsed.clinicId,
      metadata: parsed.metadata,
      adminMetadataMerge: parsed.adminMetadataMerge ?? null,
      fiAdminKey: parsed.adminKey ?? null,
    });
    return crmJsonOk({ lead });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
