"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import {
  assignArCaseOwner,
  createManualArCase,
  logArCall,
  markArReminderSent,
  resolveArCase,
  setArCaseNextAction,
  writeOffArCase,
} from "@/src/lib/financialOs/financialAccountsReceivable.server";
import { FI_AR_REMINDER_CHANNELS } from "@/src/lib/financialOs/financialAccountsReceivableCore";
import { resolveActorFiUserIdForTenantAdminActions } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const caseIdSchema = optionalAdminKey.extend({ ar_case_id: z.string().uuid() });

const assignSchema = caseIdSchema.extend({
  assigned_fi_user_id: z.string().uuid().nullable(),
});

const nextActionSchema = caseIdSchema.extend({
  next_action_at: z.string().datetime().nullable(),
});

const callSchema = caseIdSchema.extend({
  notes: z.string().max(2000).optional(),
});

const reminderSchema = caseIdSchema.extend({
  channel: z.enum(FI_AR_REMINDER_CHANNELS),
});

const manualSchema = optionalAdminKey.extend({
  invoice_id: z.string().uuid(),
  today_ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assigned_fi_user_id: z.string().uuid().nullable().optional(),
});

const writeOffSchema = caseIdSchema.extend({
  reason: z.string().max(500).optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateArPaths(tenantId: string, caseId?: string | null) {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/financial-os`);
  revalidatePath(`/fi-admin/${tid}/financial-os/accounts-receivable`);
  if (caseId?.trim()) revalidatePath(`/fi-admin/${tid}/cases/${caseId.trim()}`);
}

export async function assignArCaseOwnerAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = assignSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await assignArCaseOwner(tenantId.trim(), parsed.ar_case_id, parsed.assigned_fi_user_id);
    revalidateArPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setArCaseNextActionAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = nextActionSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await setArCaseNextAction(tenantId.trim(), parsed.ar_case_id, parsed.next_action_at);
    revalidateArPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function logArCallAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true; event_id?: string } | { ok: false; error: string }> {
  try {
    const parsed = callSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    const event = await logArCall(tenantId.trim(), parsed.ar_case_id, actorFiUserId, parsed.notes);
    revalidateArPaths(tenantId);
    return { ok: true, event_id: event.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function markArReminderSentAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true; draft_preview?: string } | { ok: false; error: string }> {
  try {
    const parsed = reminderSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    const { draft } = await markArReminderSent(tenantId.trim(), parsed.ar_case_id, parsed.channel, actorFiUserId);
    revalidateArPaths(tenantId);
    return { ok: true, draft_preview: draft.reminder_body_preview };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resolveArCaseAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = caseIdSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    await resolveArCase(tenantId.trim(), parsed.ar_case_id, actorFiUserId);
    revalidateArPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function writeOffArCaseAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = writeOffSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    await writeOffArCase(tenantId.trim(), parsed.ar_case_id, actorFiUserId, {
      reason: parsed.reason?.trim() || null,
    });
    revalidateArPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createManualArCaseAction(
  tenantId: string,
  body: unknown,
): Promise<{ ok: true; ar_case_id: string } | { ok: false; error: string }> {
  try {
    const parsed = manualSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    const row = await createManualArCase({
      tenantId: tenantId.trim(),
      invoiceId: parsed.invoice_id,
      todayYmd: parsed.today_ymd,
      actorFiUserId,
      assignedFiUserId: parsed.assigned_fi_user_id,
    });
    revalidateArPaths(tenantId, row.case_id);
    return { ok: true, ar_case_id: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
