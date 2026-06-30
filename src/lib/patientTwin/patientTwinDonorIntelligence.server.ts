import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PatientTwinDonorAssessmentRow, PatientTwinDonorSection } from "./patientTwinTypes";

function mapRow(x: Record<string, unknown>): PatientTwinDonorAssessmentRow {
  return {
    id: String(x.id),
    source_record_id: x.source_record_id != null ? String(x.source_record_id) : null,
    donor_region: String(x.donor_region ?? ""),
    donor_quality_rating: String(x.donor_quality_rating ?? ""),
    confidence_score:
      typeof x.confidence_score === "number" ? x.confidence_score : Number(x.confidence_score ?? 0),
    estimated_density_band:
      x.estimated_density_band != null ? String(x.estimated_density_band) : null,
    miniaturisation_risk: x.miniaturisation_risk != null ? String(x.miniaturisation_risk) : null,
    retrograde_risk: x.retrograde_risk != null ? String(x.retrograde_risk) : null,
    overharvesting_risk: x.overharvesting_risk != null ? String(x.overharvesting_risk) : null,
    safe_donor_capacity_band:
      x.safe_donor_capacity_band != null ? String(x.safe_donor_capacity_band) : null,
    lifetime_graft_budget_band:
      x.lifetime_graft_budget_band != null ? String(x.lifetime_graft_budget_band) : null,
    extraction_caution_level:
      x.extraction_caution_level != null ? String(x.extraction_caution_level) : null,
    review_status: String(x.review_status ?? "pending"),
    clinical_observations: x.clinical_observations != null ? String(x.clinical_observations) : null,
    ai_notes: x.ai_notes != null ? String(x.ai_notes) : null,
    created_at: String(x.created_at ?? ""),
  };
}

const RECENT_CAP = 5;

export async function loadPatientTwinDonorSection(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientTwinDonorSection> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const { data, error } = await supabase
    .from("hair_intelligence_donor_assessments")
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
