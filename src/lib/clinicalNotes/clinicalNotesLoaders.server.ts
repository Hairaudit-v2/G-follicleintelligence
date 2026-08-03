import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiClinicalNoteRecordStatus } from "@/src/lib/clinicalNotes/clinicalNotesMutations.server";
import {
  parseClinicalNoteSections,
  type ClinicalNoteSections,
} from "@/src/lib/clinicalNotes/clinicalNoteSchemas";

export type PatientClinicalNoteSummary = {
  id: string;
  record_status: FiClinicalNoteRecordStatus;
  created_at: string;
  source: string;
  preview: string;
  case_id: string | null;
  consultation_id: string | null;
};

export type PatientClinicalNoteDetail = {
  id: string;
  record_status: FiClinicalNoteRecordStatus;
  created_at: string;
  source: string;
  case_id: string | null;
  consultation_id: string | null;
  transcript_raw: string;
  sections: ClinicalNoteSections;
};

function mapSummary(raw: Record<string, unknown>): PatientClinicalNoteSummary {
  const st = String(raw.record_status ?? "");
  const status: FiClinicalNoteRecordStatus =
    st === "approved" || st === "archived" || st === "ai_draft" ? st : "ai_draft";
  const sections = parseClinicalNoteSections(raw.sections);
  const transcript = String(raw.transcript_raw ?? "").trim();
  const preview =
    sections.presenting_concern?.trim() ||
    sections.assessment?.trim() ||
    sections.plan?.trim() ||
    transcript ||
    "(no preview)";
  const slice = preview.length > 140 ? `${preview.slice(0, 137)}…` : preview;
  return {
    id: String(raw.id),
    record_status: status,
    created_at: String(raw.created_at),
    source: String(raw.source ?? "voice_consultation"),
    preview: slice,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
  };
}

function mapDetail(raw: Record<string, unknown>): PatientClinicalNoteDetail {
  const st = String(raw.record_status ?? "");
  const status: FiClinicalNoteRecordStatus =
    st === "approved" || st === "archived" || st === "ai_draft" ? st : "ai_draft";
  return {
    id: String(raw.id),
    record_status: status,
    created_at: String(raw.created_at),
    source: String(raw.source ?? "voice_consultation"),
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    transcript_raw: String(raw.transcript_raw ?? ""),
    sections: parseClinicalNoteSections(raw.sections),
  };
}

export async function loadClinicalNotesForPatient(
  tenantId: string,
  patientId: string,
  limit = 25
): Promise<PatientClinicalNoteSummary[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinical_notes")
    .select("id, record_status, created_at, source, sections, case_id, consultation_id, transcript_raw")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapSummary(r as Record<string, unknown>));
}

/** Latest voice-sourced clinical note for a patient (preferring this consultation when set). */
export async function loadLatestVoiceClinicalNoteForPatient(input: {
  tenantId: string;
  patientId: string;
  consultationId?: string | null;
}): Promise<PatientClinicalNoteDetail | null> {
  const supabase = supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const consultationId = input.consultationId?.trim() || null;

  if (consultationId) {
    const byConsult = await supabase
      .from("fi_clinical_notes")
      .select(
        "id, record_status, created_at, source, sections, case_id, consultation_id, transcript_raw"
      )
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("consultation_id", consultationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byConsult.error) throw new Error(byConsult.error.message);
    if (byConsult.data) return mapDetail(byConsult.data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("fi_clinical_notes")
    .select(
      "id, record_status, created_at, source, sections, case_id, consultation_id, transcript_raw"
    )
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapDetail(data as Record<string, unknown>);
}
