import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES,
  type ReceptionCommunicationTemplateContent,
  type ReceptionCommunicationTemplateKey,
  isReceptionCommunicationTemplateKey,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates";

function mapTemplateRow(raw: Record<string, unknown>): ReceptionCommunicationTemplateContent {
  const key = String(raw.template_key ?? "").trim();
  if (!isReceptionCommunicationTemplateKey(key)) {
    throw new Error(`Invalid reception communication template key: ${key}`);
  }
  return {
    templateKey: key,
    smsBody: raw.sms_body != null ? String(raw.sms_body) : null,
    emailSubject: raw.email_subject != null ? String(raw.email_subject) : null,
    emailBody: raw.email_body != null ? String(raw.email_body) : null,
  };
}

export async function loadReceptionCommunicationTemplatesForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<ReceptionCommunicationTemplateContent[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");

  const { data, error } = await supabase
    .from("fi_reception_communication_templates")
    .select("template_key, sms_body, email_subject, email_body, is_active")
    .eq("tenant_id", tid)
    .eq("is_active", true);

  if (error) {
    if (error.message.includes("does not exist")) {
      return Object.values(RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES);
    }
    throw new Error(error.message);
  }

  const overrides = new Map<
    ReceptionCommunicationTemplateKey,
    ReceptionCommunicationTemplateContent
  >();
  for (const raw of data ?? []) {
    const mapped = mapTemplateRow(raw as Record<string, unknown>);
    overrides.set(mapped.templateKey, mapped);
  }

  return (
    Object.keys(RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES) as ReceptionCommunicationTemplateKey[]
  ).map((key) => overrides.get(key) ?? RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[key]);
}

export async function loadReceptionCommunicationTemplateForTenant(
  tenantId: string,
  templateKey: ReceptionCommunicationTemplateKey,
  client?: SupabaseClient
): Promise<ReceptionCommunicationTemplateContent> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");

  const { data, error } = await supabase
    .from("fi_reception_communication_templates")
    .select("template_key, sms_body, email_subject, email_body, is_active")
    .eq("tenant_id", tid)
    .eq("template_key", templateKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) {
      return RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[templateKey];
    }
    throw new Error(error.message);
  }

  if (!data) return RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[templateKey];
  return mapTemplateRow(data as Record<string, unknown>);
}

export type UpsertReceptionCommunicationTemplateParams = {
  tenantId: string;
  templateKey: ReceptionCommunicationTemplateKey;
  smsBody?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  isActive?: boolean;
};

/** Upsert tenant override for a reception communication template key. */
export async function upsertReceptionCommunicationTemplate(
  params: UpsertReceptionCommunicationTemplateParams,
  client?: SupabaseClient
): Promise<ReceptionCommunicationTemplateContent> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  if (!isReceptionCommunicationTemplateKey(params.templateKey)) {
    throw new Error(`Invalid template key: ${params.templateKey}`);
  }
  const now = new Date().toISOString();
  const row = {
    tenant_id: tid,
    template_key: params.templateKey,
    sms_body: params.smsBody?.trim() || null,
    email_subject: params.emailSubject?.trim() || null,
    email_body: params.emailBody?.trim() || null,
    is_active: params.isActive ?? true,
    metadata: {},
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("fi_reception_communication_templates")
    .upsert(row, { onConflict: "tenant_id,template_key" })
    .select("template_key, sms_body, email_subject, email_body")
    .single();
  if (error) throw new Error(error.message);
  return mapTemplateRow(data as Record<string, unknown>);
}

export async function resetReceptionCommunicationTemplateToDefault(
  tenantId: string,
  templateKey: ReceptionCommunicationTemplateKey,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { error } = await supabase
    .from("fi_reception_communication_templates")
    .delete()
    .eq("tenant_id", tid)
    .eq("template_key", templateKey);
  if (error && !error.message.includes("does not exist")) throw new Error(error.message);
}
