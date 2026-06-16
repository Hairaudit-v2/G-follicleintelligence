import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";
import { parseClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";

export type FiClinicalNoteRecordStatus = "ai_draft" | "approved" | "archived";

export type FiClinicalNoteRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  case_id: string | null;
  source: string;
  record_status: FiClinicalNoteRecordStatus;
  transcript_raw: string;
  sections: ClinicalNoteSections;
  ai_model: string | null;
  created_by_fi_user_id: string | null;
  approved_by_fi_user_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

async function assertPatientInTenant(supabase: SupabaseClient, tenantId: string, patientId: string): Promise<void> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", patientId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for tenant.");
}

async function assertCaseBelongsToPatient(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, foundation_patient_id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", caseId.trim())
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Case not found.");
  const fp =
    (data as { foundation_patient_id?: string | null }).foundation_patient_id != null
      ? String((data as { foundation_patient_id: string | null }).foundation_patient_id)
      : null;
  if (fp !== patientId.trim()) {
    throw new Error("Case is not linked to this foundation patient.");
  }
}

function mapClinicalNoteRow(raw: Record<string, unknown>): FiClinicalNoteRow {
  const st = String(raw.record_status ?? "");
  const status: FiClinicalNoteRecordStatus =
    st === "approved" || st === "archived" || st === "ai_draft" ? st : "ai_draft";
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    source: String(raw.source ?? "voice_consultation"),
    record_status: status,
    transcript_raw: String(raw.transcript_raw ?? ""),
    sections: parseClinicalNoteSections(raw.sections),
    ai_model: raw.ai_model != null ? String(raw.ai_model) : null,
    created_by_fi_user_id: raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    approved_by_fi_user_id: raw.approved_by_fi_user_id != null ? String(raw.approved_by_fi_user_id) : null,
    approved_at: raw.approved_at != null ? String(raw.approved_at) : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function insertVoiceClinicalNoteDraft(params: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  consultationId?: string | null;
  transcriptRaw: string;
  sections: ClinicalNoteSections;
  structureModel: string;
  createdByFiUserId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ note: FiClinicalNoteRow; timelineEventId: string }> {
  const supabase = supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  await assertPatientInTenant(supabase, tid, pid);
  const caseId = params.caseId?.trim() || null;
  if (caseId) {
    await assertCaseBelongsToPatient(supabase, tid, caseId, pid);
  }

  const meta = {
    ...(params.metadata ?? {}),
    pipeline: "doctoros_voice_note_1c",
    structure_model: params.structureModel,
  };

  const { data: ins, error: insErr } = await supabase
    .from("fi_clinical_notes")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      case_id: caseId,
      consultation_id: params.consultationId?.trim() || null,
      source: "voice_consultation",
      record_status: "ai_draft",
      transcript_raw: params.transcriptRaw,
      sections: params.sections as unknown as Record<string, unknown>,
      ai_model: params.structureModel,
      created_by_fi_user_id: params.createdByFiUserId,
      metadata: meta,
    })
    .select("*")
    .single();
  if (insErr || !ins) {
    throw new Error(insErr?.message ?? "Could not create clinical note.");
  }
  const note = mapClinicalNoteRow(ins as Record<string, unknown>);

  const { data: tev, error: teErr } = await supabase
    .from("fi_patient_timeline_events")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      case_id: caseId,
      event_kind: "clinical_voice_note",
      title: "Voice clinical note — AI draft (review required)",
      detail: {
        clinical_note_id: note.id,
        record_status: "ai_draft",
      },
      occurred_at: new Date().toISOString(),
      clinical_note_id: note.id,
    })
    .select("id")
    .single();
  if (teErr || !tev) {
    await supabase.from("fi_clinical_notes").delete().eq("tenant_id", tid).eq("id", note.id);
    throw new Error(teErr?.message ?? "Could not create patient timeline event.");
  }

  return { note, timelineEventId: String((tev as { id: string }).id) };
}

export async function approveClinicalVoiceNote(params: {
  tenantId: string;
  clinicalNoteId: string;
  approvedByFiUserId: string;
}): Promise<FiClinicalNoteRow> {
  const supabase = supabaseAdmin();
  const tid = params.tenantId.trim();
  const nid = params.clinicalNoteId.trim();
  const now = new Date().toISOString();

  const { data: existing, error: exErr } = await supabase
    .from("fi_clinical_notes")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", nid)
    .maybeSingle();
  if (exErr || !existing) throw new Error("Clinical note not found.");
  const row = mapClinicalNoteRow(existing as Record<string, unknown>);
  if (row.record_status !== "ai_draft") {
    throw new Error("Only AI draft notes can be approved.");
  }

  const { error: u1 } = await supabase
    .from("fi_clinical_notes")
    .update({
      record_status: "approved",
      approved_by_fi_user_id: params.approvedByFiUserId.trim(),
      approved_at: now,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", nid)
    .eq("record_status", "ai_draft");
  if (u1) throw new Error(u1.message);

  const { error: u2 } = await supabase
    .from("fi_patient_timeline_events")
    .update({
      title: "Voice clinical note — approved",
      detail: { clinical_note_id: nid, record_status: "approved" },
    })
    .eq("tenant_id", tid)
    .eq("clinical_note_id", nid);
  if (u2) throw new Error(u2.message);

  const { data: refreshed, error: rErr } = await supabase
    .from("fi_clinical_notes")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", nid)
    .single();
  if (rErr || !refreshed) throw new Error(rErr?.message ?? "Could not reload clinical note.");
  return mapClinicalNoteRow(refreshed as Record<string, unknown>);
}

export async function loadClinicalNoteById(tenantId: string, clinicalNoteId: string): Promise<FiClinicalNoteRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinical_notes")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("id", clinicalNoteId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return mapClinicalNoteRow(data as Record<string, unknown>);
}
