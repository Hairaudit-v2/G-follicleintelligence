import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "./activity";
import type { FiCrmNoteRow } from "./types";
import { assertNonEmptyUuid } from "./validation";

export type CreateCrmNoteForLeadParams = {
  tenantId: string;
  leadId: string;
  body: string;
  visibility?: string;
  authorUserId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function mapNoteRow(row: Record<string, unknown>): FiCrmNoteRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    author_user_id: row.author_user_id != null ? String(row.author_user_id) : null,
    visibility: String(row.visibility),
    body: String(row.body),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Lead-context note: sets `lead_id` (schema still allows patient/case-only notes via other helpers later). */
export async function createCrmNoteForLead(
  params: CreateCrmNoteForLeadParams,
  client?: SupabaseClient
): Promise<FiCrmNoteRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(params.leadId, "leadId");
  const body = params.body.trim();
  if (!body) throw new Error("Note body is required.");

  const { data: leadExists, error: chk } = await supabase
    .from("fi_crm_leads")
    .select("id")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (chk) throw new Error(chk.message);
  if (!leadExists) throw new Error("Lead not found for tenant.");

  const metadata =
    params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
      ? params.metadata
      : {};

  const { data, error } = await supabase
    .from("fi_crm_notes")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      patient_id: null,
      case_id: null,
      author_user_id: params.authorUserId?.trim() || null,
      visibility: (params.visibility ?? "team").trim() || "team",
      body,
      metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const note = mapNoteRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "note.created",
      title: "Note added",
      detail: { note_id: note.id, visibility: note.visibility },
    },
    supabase
  );

  return note;
}
