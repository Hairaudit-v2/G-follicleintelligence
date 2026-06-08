import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiClinicalNoteRecordStatus } from "@/src/lib/clinicalNotes/clinicalNotesMutations.server";
import { parseClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";

export type PatientClinicalNoteSummary = {
  id: string;
  record_status: FiClinicalNoteRecordStatus;
  created_at: string;
  source: string;
  preview: string;
  case_id: string | null;
};

function mapSummary(raw: Record<string, unknown>): PatientClinicalNoteSummary {
  const st = String(raw.record_status ?? "");
  const status: FiClinicalNoteRecordStatus =
    st === "approved" || st === "archived" || st === "ai_draft" ? st : "ai_draft";
  const sections = parseClinicalNoteSections(raw.sections);
  const preview =
    sections.presenting_concern?.trim() ||
    sections.assessment?.trim() ||
    sections.plan?.trim() ||
    "(no preview)";
  const slice = preview.length > 140 ? `${preview.slice(0, 137)}…` : preview;
  return {
    id: String(raw.id),
    record_status: status,
    created_at: String(raw.created_at),
    source: String(raw.source ?? "voice_consultation"),
    preview: slice,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
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
    .select("id, record_status, created_at, source, sections, case_id")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapSummary(r as Record<string, unknown>));
}
