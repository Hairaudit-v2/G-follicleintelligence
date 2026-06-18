"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertReceptionTaskMutationAllowed } from "@/src/lib/receptionOs/receptionTaskAccess.server";
import {
  RECEPTION_TASK_STATUSES,
  type ReceptionTaskAction,
} from "@/src/lib/receptionOs/receptionTaskPolicy";
import {
  addReceptionTaskNote,
  assignReceptionTask,
  createReceptionTaskFromAlert,
  setReceptionTaskStatus,
  snoozeReceptionTask,
} from "@/src/lib/receptionOs/receptionTasks.server";
import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import { trackReceptionUsageEventSafe } from "@/src/lib/receptionOs/receptionUsageEvents.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const usageContextSchema = z.object({
  operatingMode: z.enum(["morning_prep", "live_clinic", "end_of_day"]).nullable().optional(),
});

const actionAlertSchema = z.object({
  id: z.string(),
  kind: z.enum(["missing_deposit", "no_follow_up_after_consultation", "missing_forms", "surgery_risk"]),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "critical", "blocked"]),
  href: z.string().nullable(),
  hrefs: z
    .object({
      patient: z.string().nullable(),
      case: z.string().nullable(),
      lead: z.string().nullable(),
      consultation: z.string().nullable(),
    })
    .optional(),
});

const createFromAlertSchema = optionalAdminKey.extend({
  alert: actionAlertSchema,
  owner_fi_user_id: z.string().uuid().nullable().optional(),
  due_at: z.string().nullable().optional(),
  usageContext: usageContextSchema.optional(),
});

const assignSchema = optionalAdminKey.extend({
  task_id: z.string().uuid(),
  owner_fi_user_id: z.string().uuid().nullable(),
  usageContext: usageContextSchema.optional(),
});

const snoozeSchema = optionalAdminKey.extend({
  task_id: z.string().uuid(),
  snoozed_until: z.string().min(1),
  usageContext: usageContextSchema.optional(),
});

const statusSchema = optionalAdminKey.extend({
  task_id: z.string().uuid(),
  status: z.enum(RECEPTION_TASK_STATUSES),
  resolution_notes: z.string().max(4000).optional().nullable(),
  usageContext: usageContextSchema.optional(),
});

const noteSchema = optionalAdminKey.extend({
  task_id: z.string().uuid(),
  note: z.string().min(1).max(4000),
  usageContext: usageContextSchema.optional(),
});

function trackTaskUsage(
  tenantId: string,
  profileId: string | null,
  eventKind: "task_created" | "task_actioned",
  taskId: string,
  operatingMode?: string | null,
  extra?: Record<string, unknown>,
): void {
  trackReceptionUsageEventSafe({
    tenantId,
    profileId,
    eventKind,
    context: {
      taskId,
      operatingMode: operatingMode as "morning_prep" | "live_clinic" | "end_of_day" | null | undefined,
      metadata: extra,
    },
  });
}

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateReceptionOsPaths(tenantId: string) {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/reception-os`);
}

async function withMutation<T>(
  tenantId: string,
  action: ReceptionTaskAction,
  adminKey: string | undefined,
  fn: (actorFiUserId: string | null) => Promise<T>,
): Promise<{ ok: true; data?: T } | { ok: false; error: string }> {
  try {
    const { actorFiUserId } = await assertReceptionTaskMutationAllowed(tenantId, action, adminKey);
    const data = await fn(actorFiUserId);
    revalidateReceptionOsPaths(tenantId);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createReceptionTaskFromAlertAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const result = await withMutation(tenantId, "create_from_alert", (body as { adminKey?: string })?.adminKey, async (actorFiUserId) => {
    const parsed = createFromAlertSchema.parse(body);
    const row = await createReceptionTaskFromAlert({
      tenantId: tenantId.trim(),
      alert: parsed.alert as ReceptionOsActionAlert,
      actorFiUserId,
      ownerFiUserId: parsed.owner_fi_user_id ?? null,
      dueAt: parsed.due_at ?? null,
    });
    trackTaskUsage(tenantId.trim(), actorFiUserId, "task_created", row.id, parsed.usageContext?.operatingMode, {
      action: "create_from_alert",
      alertKind: parsed.alert.kind,
    });
    return row.id;
  });
  if (!result.ok) return result;
  return { ok: true, taskId: result.data! };
}

export async function assignReceptionTaskAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await withMutation(tenantId, "assign", (body as { adminKey?: string })?.adminKey, async (actorFiUserId) => {
    const parsed = assignSchema.parse(body);
    await assignReceptionTask({
      tenantId: tenantId.trim(),
      taskId: parsed.task_id,
      ownerFiUserId: parsed.owner_fi_user_id,
      actorFiUserId,
    });
    trackTaskUsage(tenantId.trim(), actorFiUserId, "task_actioned", parsed.task_id, parsed.usageContext?.operatingMode, {
      action: "assign",
    });
  });
  return result.ok ? { ok: true } : result;
}

export async function snoozeReceptionTaskAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await withMutation(tenantId, "snooze", (body as { adminKey?: string })?.adminKey, async (actorFiUserId) => {
    const parsed = snoozeSchema.parse(body);
    await snoozeReceptionTask({
      tenantId: tenantId.trim(),
      taskId: parsed.task_id,
      snoozedUntil: parsed.snoozed_until,
      actorFiUserId,
    });
    trackTaskUsage(tenantId.trim(), actorFiUserId, "task_actioned", parsed.task_id, parsed.usageContext?.operatingMode, {
      action: "snooze",
    });
  });
  return result.ok ? { ok: true } : result;
}

export async function setReceptionTaskStatusAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsedRaw = statusSchema.safeParse(body);
  if (!parsedRaw.success) return { ok: false, error: errMsg(parsedRaw.error) };
  const parsed = parsedRaw.data;
  const action: ReceptionTaskAction =
    parsed.status === "resolved" ? "resolve" : parsed.status === "dismissed" ? "dismiss" : "mark_in_progress";

  const result = await withMutation(tenantId, action, parsed.adminKey, async (actorFiUserId) => {
    await setReceptionTaskStatus({
      tenantId: tenantId.trim(),
      taskId: parsed.task_id,
      status: parsed.status,
      actorFiUserId,
      resolutionNotes: parsed.resolution_notes ?? null,
    });
    trackTaskUsage(tenantId.trim(), actorFiUserId, "task_actioned", parsed.task_id, parsed.usageContext?.operatingMode, {
      action,
      status: parsed.status,
    });
  });
  return result.ok ? { ok: true } : result;
}

export async function addReceptionTaskNoteAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await withMutation(tenantId, "add_note", (body as { adminKey?: string })?.adminKey, async (actorFiUserId) => {
    const parsed = noteSchema.parse(body);
    await addReceptionTaskNote({
      tenantId: tenantId.trim(),
      taskId: parsed.task_id,
      note: parsed.note,
      actorFiUserId,
    });
    trackTaskUsage(tenantId.trim(), actorFiUserId, "task_actioned", parsed.task_id, parsed.usageContext?.operatingMode, {
      action: "add_note",
    });
  });
  return result.ok ? { ok: true } : result;
}
