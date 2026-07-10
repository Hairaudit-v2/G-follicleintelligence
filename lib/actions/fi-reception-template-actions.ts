"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { RECEPTION_COMMUNICATION_TEMPLATE_KEYS } from "@/src/lib/receptionOs/receptionCommunicationTemplates";
import {
  loadReceptionCommunicationTemplatesForTenant,
  resetReceptionCommunicationTemplateToDefault,
  upsertReceptionCommunicationTemplate,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates.server";
import { canAccessTenantReminderSettings } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

async function assertTemplateSettingsAccess(tenantId: string): Promise<string | null> {
  const authId = await resolveAuthUserId(null);
  if (!authId) return "Authentication required.";
  if (!(await canAccessTenantReminderSettings(tenantId))) {
    return "You do not have permission to manage templates for this tenant.";
  }
  return null;
}

const upsertSchema = z.object({
  tenantId: z.string().uuid(),
  templateKey: z.enum(RECEPTION_COMMUNICATION_TEMPLATE_KEYS),
  smsBody: z.string().max(1600).nullable().optional(),
  emailSubject: z.string().max(500).nullable().optional(),
  emailBody: z.string().max(16000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function loadReceptionTemplatesAction(
  tenantId: string
): Promise<
  | {
      ok: true;
      templates: Awaited<ReturnType<typeof loadReceptionCommunicationTemplatesForTenant>>;
    }
  | { ok: false; error: string }
> {
  try {
    const tid = tenantId.trim();
    const gate = await assertTemplateSettingsAccess(tid);
    if (gate) return { ok: false, error: gate };
    const templates = await loadReceptionCommunicationTemplatesForTenant(tid);
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function upsertReceptionTemplateAction(
  body: unknown
): Promise<
  | {
      ok: true;
      template: Awaited<ReturnType<typeof upsertReceptionCommunicationTemplate>>;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = upsertSchema.parse(body);
    const gate = await assertTemplateSettingsAccess(parsed.tenantId);
    if (gate) return { ok: false, error: gate };
    const template = await upsertReceptionCommunicationTemplate({
      tenantId: parsed.tenantId,
      templateKey: parsed.templateKey,
      smsBody: parsed.smsBody,
      emailSubject: parsed.emailSubject,
      emailBody: parsed.emailBody,
      isActive: parsed.isActive,
    });
    revalidatePath(`/fi-admin/${parsed.tenantId}/settings/templates`);
    return { ok: true, template };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function resetReceptionTemplateAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        tenantId: z.string().uuid(),
        templateKey: z.enum(RECEPTION_COMMUNICATION_TEMPLATE_KEYS),
      })
      .parse(body);
    const gate = await assertTemplateSettingsAccess(parsed.tenantId);
    if (gate) return { ok: false, error: gate };
    await resetReceptionCommunicationTemplateToDefault(
      parsed.tenantId,
      parsed.templateKey
    );
    revalidatePath(`/fi-admin/${parsed.tenantId}/settings/templates`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
