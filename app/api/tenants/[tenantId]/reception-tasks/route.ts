/**
 * POST /api/tenants/[tenantId]/reception-tasks
 * ReceptionOS Phase 2 task mutations (tenant-scoped).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { assertReceptionTaskMutationAllowed } from "@/src/lib/receptionOs/receptionTaskAccess.server";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import {
  addReceptionTaskNote,
  assignReceptionTask,
  createReceptionTaskFromAlert,
  setReceptionTaskStatus,
  snoozeReceptionTask,
} from "@/src/lib/receptionOs/receptionTasks.server";
import { serializeReceptionTaskRow } from "@/src/lib/receptionOs/receptionTaskSerialize";
import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardModel.types";

export const dynamic = "force-dynamic";

type TaskBody = {
  action: string;
  alert?: ReceptionOsActionAlert;
  task_id?: string;
  owner_fi_user_id?: string | null;
  snoozed_until?: string;
  status?: string;
  resolution_notes?: string | null;
  note?: string;
  due_at?: string | null;
};

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const viewer = await resolveReceptionOsViewerContext(tenantId.trim());
    if (!viewer.canAccessReceptionOs) {
      return crmJsonError(
        403,
        "ReceptionOS access requires an active staff or CRM shell role for this tenant."
      );
    }

    const body = (await req.json()) as TaskBody;
    const action = String(
      body.action ?? ""
    ).trim() as import("@/src/lib/receptionOs/receptionTaskPolicy").ReceptionTaskAction;
    const { actorFiUserId } = await assertReceptionTaskMutationAllowed(
      tenantId.trim(),
      action,
      adminKey
    );

    switch (action) {
      case "create_from_alert": {
        if (!body.alert) return crmJsonError(400, "Missing alert.");
        const row = await createReceptionTaskFromAlert({
          tenantId: tenantId.trim(),
          alert: body.alert,
          actorFiUserId,
          ownerFiUserId: body.owner_fi_user_id ?? null,
          dueAt: body.due_at ?? null,
        });
        return crmJsonOk({ task: serializeReceptionTaskRow(row) });
      }
      case "assign": {
        if (!body.task_id) return crmJsonError(400, "Missing task_id.");
        const row = await assignReceptionTask({
          tenantId: tenantId.trim(),
          taskId: body.task_id,
          ownerFiUserId: body.owner_fi_user_id ?? null,
          actorFiUserId,
        });
        return crmJsonOk({ task: serializeReceptionTaskRow(row) });
      }
      case "snooze": {
        if (!body.task_id || !body.snoozed_until)
          return crmJsonError(400, "Missing task_id or snoozed_until.");
        const row = await snoozeReceptionTask({
          tenantId: tenantId.trim(),
          taskId: body.task_id,
          snoozedUntil: body.snoozed_until,
          actorFiUserId,
        });
        return crmJsonOk({ task: serializeReceptionTaskRow(row) });
      }
      case "mark_in_progress":
      case "resolve":
      case "dismiss": {
        if (!body.task_id || !body.status) return crmJsonError(400, "Missing task_id or status.");
        const row = await setReceptionTaskStatus({
          tenantId: tenantId.trim(),
          taskId: body.task_id,
          status: body.status as never,
          actorFiUserId,
          resolutionNotes: body.resolution_notes ?? null,
        });
        return crmJsonOk({ task: serializeReceptionTaskRow(row) });
      }
      case "add_note": {
        if (!body.task_id || !body.note?.trim())
          return crmJsonError(400, "Missing task_id or note.");
        const row = await addReceptionTaskNote({
          tenantId: tenantId.trim(),
          taskId: body.task_id,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ task: serializeReceptionTaskRow(row) });
      }
      default:
        return crmJsonError(400, `Unknown action: ${action}`);
    }
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
