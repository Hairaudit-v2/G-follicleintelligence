import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "./activity";
import {
  collectChangedLeadNoteDetailKeys,
  noteDetailSnapshotFromRowLike,
} from "./crmLeadNoteChangedFields";
import {
  assertCrmLeadNoteBodyNonEmpty,
  assertCrmLeadNoteVisibilityAllowed,
  assertLeadNoteNotArchived,
} from "./crmLeadNotePolicy";
import type { FiCrmLeadNoteRow } from "./types";
import { assertNonEmptyUuid } from "./validation";

export type CreateCrmLeadNoteParams = {
  tenantId: string;
  leadId: string;
  noteBody: string;
  noteVisibility?: string;
  isPinned?: boolean;
  /** Set only from trusted server context (not client input). */
  authorUserId?: string | null;
};

export type UpdateCrmLeadNoteParams = {
  tenantId: string;
  leadId: string;
  noteId: string;
  noteBody?: string;
  noteVisibility?: string;
  isPinned?: boolean;
};

function mapLeadNoteRow(row: Record<string, unknown>): FiCrmLeadNoteRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: String(row.lead_id),
    author_user_id: row.author_user_id != null ? String(row.author_user_id) : null,
    note_body: String(row.note_body),
    note_visibility: String(row.note_visibility),
    is_pinned: Boolean(row.is_pinned),
    archived_at: row.archived_at != null ? String(row.archived_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadCrmLeadNotesForLead(
  tenantId: string,
  leadId: string,
  opts?: { limit?: number; client?: SupabaseClient }
): Promise<FiCrmLeadNoteRow[]> {
  const supabase: SupabaseClient = opts?.client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);

  const { data, error } = await supabase
    .from("fi_crm_lead_notes")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLeadNoteRow);
}

export async function loadCrmLeadNoteForLead(
  tenantId: string,
  leadId: string,
  noteId: string,
  client?: SupabaseClient
): Promise<FiCrmLeadNoteRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const nid = assertNonEmptyUuid(noteId, "noteId");

  const { data, error } = await supabase
    .from("fi_crm_lead_notes")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .eq("id", nid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLeadNoteRow(data as Record<string, unknown>);
}

async function assertAuthorBelongsToTenant(supabase: SupabaseClient, tenantId: string, fiUserId: string): Promise<void> {
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", fiUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("author_user_id is not a user in this tenant.");
}

export async function createCrmLeadNote(params: CreateCrmLeadNoteParams, client?: SupabaseClient): Promise<FiCrmLeadNoteRow> {
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

  const noteBody = assertCrmLeadNoteBodyNonEmpty(params.noteBody);
  const noteVisibility = (params.noteVisibility ?? "internal").trim() || "internal";
  assertCrmLeadNoteVisibilityAllowed(noteVisibility);

  const authorUserId = params.authorUserId?.trim() || null;
  if (authorUserId) {
    await assertAuthorBelongsToTenant(supabase, tenantId, authorUserId);
  }

  const isPinned = Boolean(params.isPinned);

  const { data, error } = await supabase
    .from("fi_crm_lead_notes")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      author_user_id: authorUserId,
      note_body: noteBody,
      note_visibility: noteVisibility,
      is_pinned: isPinned,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const note = mapLeadNoteRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "lead_note.created",
      title: "Lead note created",
      detail: { note_id: note.id, note_visibility: note.note_visibility },
    },
    supabase
  );

  return note;
}

export async function updateCrmLeadNote(params: UpdateCrmLeadNoteParams, client?: SupabaseClient): Promise<FiCrmLeadNoteRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const row = await loadCrmLeadNoteForLead(params.tenantId, params.leadId, params.noteId, supabase);
  if (!row) throw new Error("Lead note not found for this lead.");

  assertLeadNoteNotArchived(row);

  const hasPatch =
    params.noteBody !== undefined || params.noteVisibility !== undefined || params.isPinned !== undefined;
  if (!hasPatch) throw new Error("No lead note fields to update.");

  let nextBody = row.note_body;
  if (params.noteBody !== undefined) {
    nextBody = assertCrmLeadNoteBodyNonEmpty(params.noteBody);
  }

  let nextVis = row.note_visibility;
  if (params.noteVisibility !== undefined) {
    const v = params.noteVisibility.trim();
    assertCrmLeadNoteVisibilityAllowed(v);
    nextVis = v;
  }

  let nextPinned = row.is_pinned;
  if (params.isPinned !== undefined) {
    nextPinned = Boolean(params.isPinned);
  }

  const before = noteDetailSnapshotFromRowLike(row);
  const after = noteDetailSnapshotFromRowLike({
    ...row,
    note_body: nextBody,
    note_visibility: nextVis,
    is_pinned: nextPinned,
  });
  const changed = collectChangedLeadNoteDetailKeys(before, after);
  if (changed.length === 0) {
    return row;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_crm_lead_notes")
    .update({
      note_body: nextBody,
      note_visibility: nextVis,
      is_pinned: nextPinned,
      updated_at: nowIso,
    })
    .eq("id", row.id)
    .eq("tenant_id", row.tenant_id)
    .eq("lead_id", row.lead_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapLeadNoteRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      activityKind: "lead_note.updated",
      title: "Lead note updated",
      detail: { note_id: updated.id, changed_keys: changed },
    },
    supabase
  );

  return updated;
}

export async function archiveCrmLeadNote(
  params: { tenantId: string; leadId: string; noteId: string },
  client?: SupabaseClient
): Promise<FiCrmLeadNoteRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const row = await loadCrmLeadNoteForLead(params.tenantId, params.leadId, params.noteId, supabase);
  if (!row) throw new Error("Lead note not found for this lead.");

  if (row.archived_at) {
    return row;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_crm_lead_notes")
    .update({
      archived_at: nowIso,
      updated_at: nowIso,
      is_pinned: false,
    })
    .eq("id", row.id)
    .eq("tenant_id", row.tenant_id)
    .eq("lead_id", row.lead_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapLeadNoteRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      activityKind: "lead_note.archived",
      title: "Lead note archived",
      detail: { note_id: updated.id },
    },
    supabase
  );

  return updated;
}
