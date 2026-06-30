import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  PatientTwinConsultationChecklistRow,
  PatientTwinConsultationChecklistSection,
} from "./patientTwinTypes";

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapRow(x: Record<string, unknown>): PatientTwinConsultationChecklistRow {
  return {
    id: String(x.id),
    source_record_id: x.source_record_id != null ? String(x.source_record_id) : null,
    priority_level: String(x.priority_level ?? "low"),
    checklist_status: String(x.checklist_status ?? "generated"),
    confidence_score:
      typeof x.confidence_score === "number" ? x.confidence_score : Number(x.confidence_score ?? 0),
    medication_discussion_required: Boolean(x.medication_discussion_required),
    stabilisation_discussion_required: Boolean(x.stabilisation_discussion_required),
    donor_preservation_discussion_required: Boolean(x.donor_preservation_discussion_required),
    expectation_management_required: Boolean(x.expectation_management_required),
    consent_complexity_level:
      x.consent_complexity_level != null ? String(x.consent_complexity_level) : null,
    documentation_required: Boolean(x.documentation_required),
    follow_up_required: Boolean(x.follow_up_required),
    delay_recommended: Boolean(x.delay_recommended),
    checklist_items: parseStringArray(x.checklist_items),
    risk_flags: parseStringArray(x.risk_flags),
    consultation_summary: x.consultation_summary != null ? String(x.consultation_summary) : null,
    review_status: String(x.review_status ?? "pending"),
    ai_notes: x.ai_notes != null ? String(x.ai_notes) : null,
    created_at: String(x.created_at ?? ""),
  };
}

const RECENT_CAP = 5;

export async function loadPatientTwinConsultationChecklistSection(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientTwinConsultationChecklistSection> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const { data, error } = await supabase
    .from("hair_intelligence_consultation_checklists")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(RECENT_CAP);

  if (error) {
    const m = error.message ?? "";
    if (m.includes("does not exist") || m.includes("schema cache")) {
      return { latest: null, recent: [], recent_cap: RECENT_CAP };
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const recent = rows.map(mapRow);
  return {
    latest: recent[0] ?? null,
    recent,
    recent_cap: RECENT_CAP,
  };
}

export type ConsultationChecklistWorkspacePreview = PatientTwinConsultationChecklistRow;

/** Latest checklist row for consultation workspace (read-only). */
export async function loadLatestConsultationChecklistForPatientWorkspace(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<ConsultationChecklistWorkspacePreview | null> {
  const sec = await loadPatientTwinConsultationChecklistSection(tenantId, patientId, client);
  return sec.latest;
}
