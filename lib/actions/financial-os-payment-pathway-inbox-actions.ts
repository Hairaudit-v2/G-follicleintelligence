"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import {
  addPaymentPathwayTaskNote,
  assignPaymentPathwayTask,
  updatePaymentPathwayTaskStatus,
} from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const TASK_STATUSES = [
  "open",
  "in_progress",
  "waiting_patient",
  "waiting_provider",
  "completed",
  "cancelled",
] as const;

const updateStatusSchema = optionalAdminKey.extend({
  task_id: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
  notes: z.string().max(4000).optional().nullable(),
});

const assignSchema = optionalAdminKey.extend({
  task_id: z.string().uuid(),
  assigned_to: z.string().uuid().nullable(),
});

const addNoteSchema = optionalAdminKey.extend({
  task_id: z.string().uuid(),
  notes: z.string().min(1).max(4000),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateInboxPaths(tenantId: string) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/financial`;
  revalidatePath(base);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/pathway-inbox`);
  revalidatePath(`/fi-admin/${tid}/operations`);
  revalidatePath(`/fi-admin/${tid}/cases`);
}

export async function updatePaymentPathwayTaskStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateStatusSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updatePaymentPathwayTaskStatus({
      tenantId: tenantId.trim(),
      taskId: parsed.task_id,
      status: parsed.status,
      notes: parsed.notes ?? undefined,
    });
    revalidateInboxPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function assignPaymentPathwayTaskAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = assignSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await assignPaymentPathwayTask({
      tenantId: tenantId.trim(),
      taskId: parsed.task_id,
      assignedTo: parsed.assigned_to,
    });
    revalidateInboxPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function addPaymentPathwayTaskNoteAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = addNoteSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await addPaymentPathwayTaskNote({
      tenantId: tenantId.trim(),
      taskId: parsed.task_id,
      notes: parsed.notes.trim(),
    });
    revalidateInboxPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
