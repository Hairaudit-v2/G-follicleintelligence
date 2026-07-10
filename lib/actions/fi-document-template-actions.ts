"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  DOCUMENT_TEMPLATE_CATEGORIES,
} from "@/src/lib/documentTemplates/documentTemplateConstants";
import {
  deleteDocumentTemplate,
  ensureDefaultDocumentTemplatesForTenant,
  loadDocumentTemplatesForTenant,
  upsertDocumentTemplate,
} from "@/src/lib/documentTemplates/documentTemplates.server";
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
  id: z.string().uuid().optional().nullable(),
  category: z.enum(DOCUMENT_TEMPLATE_CATEGORIES),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export async function loadDocumentTemplatesAction(
  tenantId: string
): Promise<
  | { ok: true; templates: Awaited<ReturnType<typeof loadDocumentTemplatesForTenant>> }
  | { ok: false; error: string }
> {
  try {
    const tid = tenantId.trim();
    const gate = await assertTemplateSettingsAccess(tid);
    if (gate) return { ok: false, error: gate };
    await ensureDefaultDocumentTemplatesForTenant(tid);
    const templates = await loadDocumentTemplatesForTenant(tid);
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function upsertDocumentTemplateAction(
  body: unknown
): Promise<
  | { ok: true; template: Awaited<ReturnType<typeof upsertDocumentTemplate>> }
  | { ok: false; error: string }
> {
  try {
    const parsed = upsertSchema.parse(body);
    const gate = await assertTemplateSettingsAccess(parsed.tenantId);
    if (gate) return { ok: false, error: gate };
    const template = await upsertDocumentTemplate(parsed);
    revalidatePath(`/fi-admin/${parsed.tenantId}/settings/templates`);
    revalidatePath(`/fi-admin/${parsed.tenantId}/settings/reminders`);
    return { ok: true, template };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteDocumentTemplateAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({ tenantId: z.string().uuid(), templateId: z.string().uuid() })
      .parse(body);
    const gate = await assertTemplateSettingsAccess(parsed.tenantId);
    if (gate) return { ok: false, error: gate };
    await deleteDocumentTemplate(parsed.tenantId, parsed.templateId);
    revalidatePath(`/fi-admin/${parsed.tenantId}/settings/templates`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
