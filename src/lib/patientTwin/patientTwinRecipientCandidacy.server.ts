import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PatientTwinRecipientCandidacyReviewRow, PatientTwinRecipientCandidacySection } from "./patientTwinTypes";

function parseTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

function mapRow(x: Record<string, unknown>): PatientTwinRecipientCandidacyReviewRow {
  return {
    id: String(x.id),
    source_record_id: x.source_record_id != null ? String(x.source_record_id) : null,
    recipient_quality_rating: String(x.recipient_quality_rating ?? ""),
    confidence_score: typeof x.confidence_score === "number" ? x.confidence_score : Number(x.confidence_score ?? 0),
    diffuse_thinning_risk: x.diffuse_thinning_risk != null ? String(x.diffuse_thinning_risk) : null,
    shock_loss_risk: x.shock_loss_risk != null ? String(x.shock_loss_risk) : null,
    density_expectation_risk: x.density_expectation_risk != null ? String(x.density_expectation_risk) : null,
    medication_stabilisation_needed: Boolean(x.medication_stabilisation_needed),
    pathology_review_recommended: Boolean(x.pathology_review_recommended),
    surgical_timing_risk: x.surgical_timing_risk != null ? String(x.surgical_timing_risk) : null,
    patient_expectation_risk: x.patient_expectation_risk != null ? String(x.patient_expectation_risk) : null,
    documentation_gap_detected: Boolean(x.documentation_gap_detected),
    review_topics: parseTopics(x.review_topics),
    candidacy_summary: x.candidacy_summary != null ? String(x.candidacy_summary) : null,
    review_status: String(x.review_status ?? "pending"),
    ai_notes: x.ai_notes != null ? String(x.ai_notes) : null,
    created_at: String(x.created_at ?? ""),
  };
}

const RECENT_CAP = 5;

export async function loadPatientTwinRecipientCandidacySection(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientTwinRecipientCandidacySection> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const { data, error } = await supabase
    .from("hair_intelligence_recipient_candidacy_reviews")
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
