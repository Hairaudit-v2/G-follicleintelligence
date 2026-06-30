/**
 * POST /api/tenants/[tenantId]/crm/leads/[leadId]/tasks
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmCreateTaskBodySchema } from "@/src/lib/crm/crmApiSchemas";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { createCrmTask } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; leadId: string }> }
) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim())
      return crmJsonError(400, "Missing tenantId or leadId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmCreateTaskBodySchema.parse(body);

    const task = await createCrmTask({
      tenantId,
      leadId,
      title: parsed.title,
      description: parsed.description ?? null,
      taskType: parsed.taskType,
      status: parsed.status,
      dueAt: parsed.dueAt ?? null,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
      assigneeUserId: parsed.assigneeUserId ?? null,
      metadata: parsed.metadata ?? null,
    });

    return crmJsonOk({ task });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
