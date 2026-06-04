import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "./activity";
import type { FiCrmMessageRow } from "./types";
import { assertNonEmptyUuid, validateCrmMessagePreviewInput } from "./validation";

export type CreateCrmMessagePreviewParams = {
  tenantId: string;
  /** At least one anchor required by DB; this helper expects a lead-scoped message. */
  leadId: string;
  patientId?: string | null;
  caseId?: string | null;
  /** Raw-ish object validated by `validateCrmMessagePreviewInput` (no full body fields). */
  preview: Record<string, unknown>;
};

function mapMessageRow(row: Record<string, unknown>): FiCrmMessageRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    channel: String(row.channel),
    direction: String(row.direction),
    subject: row.subject != null ? String(row.subject) : null,
    body_preview: row.body_preview != null ? String(row.body_preview) : null,
    body_storage_ref: row.body_storage_ref != null ? String(row.body_storage_ref) : null,
    external_thread_id: row.external_thread_id != null ? String(row.external_thread_id) : null,
    external_message_id: row.external_message_id != null ? String(row.external_message_id) : null,
    sent_at: row.sent_at != null ? String(row.sent_at) : null,
    received_at: row.received_at != null ? String(row.received_at) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
  };
}

/**
 * Inserts a preview/metadata-only CRM message row (Phase 1 — no full body in Postgres).
 */
export async function createCrmMessagePreview(
  params: CreateCrmMessagePreviewParams,
  client?: SupabaseClient
): Promise<FiCrmMessageRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(params.leadId, "leadId");

  const { data: leadExists, error: chk } = await supabase
    .from("fi_crm_leads")
    .select("id")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (chk) throw new Error(chk.message);
  if (!leadExists) throw new Error("Lead not found for tenant.");

  const v = validateCrmMessagePreviewInput(params.preview);

  const { data, error } = await supabase
    .from("fi_crm_messages")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      patient_id: params.patientId?.trim() || null,
      case_id: params.caseId?.trim() || null,
      channel: v.channel,
      direction: v.direction,
      subject: v.subject,
      body_preview: v.body_preview,
      body_storage_ref: v.body_storage_ref,
      external_thread_id: v.external_thread_id,
      external_message_id: v.external_message_id,
      sent_at: v.sent_at,
      received_at: v.received_at,
      metadata: v.metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const msg = mapMessageRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "message.logged",
      title: "Message preview recorded",
      detail: {
        message_id: msg.id,
        channel: msg.channel,
        direction: msg.direction,
        external_message_id: msg.external_message_id,
      },
      patientId: msg.patient_id,
      caseId: msg.case_id,
    },
    supabase
  );

  return msg;
}

/**
 * Recent message preview rows for a lead (newest first).
 */
export async function loadCrmMessagesForLead(
  tenantId: string,
  leadId: string,
  opts?: { limit?: number; client?: SupabaseClient }
): Promise<FiCrmMessageRow[]> {
  const supabase: SupabaseClient = opts?.client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);

  const { data, error } = await supabase
    .from("fi_crm_messages")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapMessageRow);
}
