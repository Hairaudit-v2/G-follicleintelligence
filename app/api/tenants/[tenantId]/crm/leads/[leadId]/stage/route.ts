/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/stage — move lead to pipeline stage.
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmMoveLeadStageBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { moveCrmLeadToStage } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmMoveLeadStageBodySchema.parse(body);

    const result = await moveCrmLeadToStage({
      tenantId,
      leadId,
      toStageId: parsed.toStageId,
      changedBy: parsed.changedBy ?? null,
      reason: parsed.reason ?? null,
      source: parsed.source,
    });

    return crmJsonOk({ lead: result.lead, timelineEventId: result.timelineEventId });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
