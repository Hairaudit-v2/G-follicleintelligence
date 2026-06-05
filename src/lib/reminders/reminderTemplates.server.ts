import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { FiReminderTemplateRow } from "./reminderTypes";
import { REMINDER_TEMPLATE_TYPES, REMINDER_TRIGGER_EVENTS } from "./reminderConstants";
import type { ReminderTemplateType, ReminderTriggerEvent } from "./reminderConstants";

function assertMetadataObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function mapTemplateRow(row: Record<string, unknown>): FiReminderTemplateRow {
  const meta = assertMetadataObject(row.metadata);
  const type = String(row.type);
  const trig = String(row.trigger_event);
  if (!REMINDER_TEMPLATE_TYPES.includes(type as ReminderTemplateType)) {
    throw new Error(`Invalid reminder template type: ${type}`);
  }
  if (!REMINDER_TRIGGER_EVENTS.includes(trig as ReminderTriggerEvent)) {
    throw new Error(`Invalid reminder template trigger: ${trig}`);
  }
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    type: type as ReminderTemplateType,
    trigger_event: trig as ReminderTriggerEvent,
    subject: row.subject != null ? String(row.subject) : null,
    body: String(row.body),
    is_active: Boolean(row.is_active),
    metadata: meta,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadReminderTemplatesForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<FiReminderTemplateRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { data, error } = await supabase
    .from("fi_reminder_templates")
    .select("*")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapTemplateRow);
}

export async function loadReminderTemplateForTenant(
  tenantId: string,
  templateId: string,
  client?: SupabaseClient
): Promise<FiReminderTemplateRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const id = assertNonEmptyUuid(templateId, "templateId");
  const { data, error } = await supabase
    .from("fi_reminder_templates")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapTemplateRow(data as Record<string, unknown>);
}

export type CreateReminderTemplateParams = {
  tenantId: string;
  name: string;
  type: ReminderTemplateType;
  trigger_event: ReminderTriggerEvent;
  subject?: string | null;
  body: string;
  is_active?: boolean;
};

export async function createReminderTemplate(
  params: CreateReminderTemplateParams,
  client?: SupabaseClient
): Promise<FiReminderTemplateRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_reminder_templates")
    .insert({
      tenant_id: tid,
      name: params.name.trim(),
      type: params.type,
      trigger_event: params.trigger_event,
      subject: params.type === "email" ? (params.subject?.trim() || null) : null,
      body: params.body.trim(),
      is_active: params.is_active ?? true,
      metadata: {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTemplateRow(data as Record<string, unknown>);
}

export type UpdateReminderTemplateParams = {
  tenantId: string;
  templateId: string;
  name?: string;
  type?: ReminderTemplateType;
  trigger_event?: ReminderTriggerEvent;
  subject?: string | null;
  body?: string;
  is_active?: boolean;
};

export async function updateReminderTemplate(
  params: UpdateReminderTemplateParams,
  client?: SupabaseClient
): Promise<FiReminderTemplateRow> {
  const supabase = client ?? supabaseAdmin();
  const existing = await loadReminderTemplateForTenant(params.tenantId, params.templateId, supabase);
  if (!existing) throw new Error("Template not found.");

  const nextType = params.type ?? existing.type;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.name !== undefined) updates.name = params.name.trim();
  if (params.type !== undefined) updates.type = params.type;
  if (params.trigger_event !== undefined) updates.trigger_event = params.trigger_event;
  if (params.body !== undefined) updates.body = params.body.trim();
  if (params.is_active !== undefined) updates.is_active = params.is_active;
  if (params.subject !== undefined) {
    updates.subject = params.subject?.trim() || null;
  } else if (params.type !== undefined && nextType === "sms") {
    updates.subject = null;
  }
  if (nextType === "email") {
    const subj = (updates.subject as string | null | undefined) ?? existing.subject;
    if (!String(subj ?? "").trim()) {
      throw new Error("subject is required for email templates.");
    }
  }

  const { data, error } = await supabase
    .from("fi_reminder_templates")
    .update(updates)
    .eq("tenant_id", assertNonEmptyUuid(params.tenantId, "tenantId"))
    .eq("id", assertNonEmptyUuid(params.templateId, "templateId"))
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTemplateRow(data as Record<string, unknown>);
}

export async function deleteReminderTemplate(
  tenantId: string,
  templateId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const id = assertNonEmptyUuid(templateId, "templateId");
  const { error } = await supabase.from("fi_reminder_templates").delete().eq("tenant_id", tid).eq("id", id);
  if (error) throw new Error(error.message);
}
