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
