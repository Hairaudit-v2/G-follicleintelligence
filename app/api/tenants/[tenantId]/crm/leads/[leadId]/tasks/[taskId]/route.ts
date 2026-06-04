/**
 * PATCH /api/tenants/[tenantId]/crm/leads/[leadId]/tasks/[taskId]
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmUpdateTaskBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { updateCrmTask } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; leadId: string; taskId: string }> }
) {
  try {
    const { tenantId, leadId, taskId } = await params;
    if (!tenantId?.trim() || !leadId?.trim() || !taskId?.trim()) {
      return crmJsonError(400, "Missing tenantId, leadId, or taskId.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmUpdateTaskBodySchema.parse(body);

    const task = await updateCrmTask({
      tenantId,
      leadId,
      taskId,
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.taskType !== undefined ? { taskType: parsed.taskType } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      ...(parsed.dueAt !== undefined ? { dueAt: parsed.dueAt } : {}),
      ...(parsed.assigneeUserId !== undefined ? { assigneeUserId: parsed.assigneeUserId } : {}),
    });

    return crmJsonOk({ task });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
