"use server";

import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  reminderTemplateCreateBodySchema,
  reminderTemplatePreviewBodySchema,
  reminderTemplateUpdateBodySchema,
} from "@/src/lib/reminders/reminderSchemas";
import { renderReminderText } from "@/src/lib/reminders/remindersCore";
import {
  createReminderTemplate,
  deleteReminderTemplate,
  loadReminderTemplatesForTenant,
  updateReminderTemplate,
} from "@/src/lib/reminders/reminderTemplates.server";
import { ZodError } from "zod";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function loadReminderTemplatesAction(tenantId: string): Promise<
  { ok: true; templates: Awaited<ReturnType<typeof loadReminderTemplatesForTenant>> } | { ok: false; error: string }
> {
  try {
    const templates = await loadReminderTemplatesForTenant(tenantId.trim());
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createReminderTemplateAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = reminderTemplateCreateBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    await createReminderTemplate({
      tenantId,
      name: parsed.name,
      type: parsed.type,
      trigger_event: parsed.trigger_event,
      subject: parsed.subject ?? null,
      body: parsed.body,
      is_active: parsed.is_active,
    });
    revalidatePath(`/fi-admin/${tenantId.trim()}/settings/reminders`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateReminderTemplateAction(
  tenantId: string,
  templateId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = reminderTemplateUpdateBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    await updateReminderTemplate({
      tenantId,
      templateId,
      name: parsed.name,
      type: parsed.type,
      trigger_event: parsed.trigger_event,
      subject: parsed.subject,
      body: parsed.body,
      is_active: parsed.is_active,
    });
    revalidatePath(`/fi-admin/${tenantId.trim()}/settings/reminders`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function deleteReminderTemplateAction(
  tenantId: string,
  templateId: string,
  adminKey: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });
    await deleteReminderTemplate(tenantId.trim(), templateId.trim());
    revalidatePath(`/fi-admin/${tenantId.trim()}/settings/reminders`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function previewReminderTemplateAction(
  body: unknown
): Promise<{ ok: true; subject: string | null; body: string } | { ok: false; error: string }> {
  try {
    const parsed = reminderTemplatePreviewBodySchema.parse(body);
    const sample = {
      patient_name: "Jordan Example",
      booking_time: "Fri, Jun 5, 2026, 2:30 PM",
      clinic_name: "Evolved Hair Clinic",
      booking_title: "Consultation",
      booking_type: "consultation",
    };
    const renderedBody = renderReminderText(parsed.body, sample);
    const renderedSubject = parsed.subject != null ? renderReminderText(parsed.subject, sample) : null;
    return { ok: true, subject: renderedSubject, body: renderedBody };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
