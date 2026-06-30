import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadViePatientImagingCompleteness } from "./vieCompleteness.server";
import { loadVieComparisonReadinessForPatient } from "./vieLongitudinalComparison.server";
import type { VieComparisonReadinessSummary } from "./vieComparisonTypes";
import type { ViePatientTwinAlignmentSummary } from "./vieAlignmentTypes";
import type {
  VieInstantIntelligenceResult,
  ViePatientImagingCompleteness,
} from "./vieProtocolTypes";
import { VIE_ENGINE_VERSION } from "./vieProtocolTypes";
import { VIE_FUTURE_ARCHITECTURE } from "./vieFutureArchitecture";
import { loadPatientTwinAlignmentSummary } from "./vieSameAngleAlignment.server";
import { computeVieOutcomeSummaryForPatient } from "./vieOutcomeIntelligence.server";
import type { VieOutcomeSummary } from "./vieOutcomeTypes";

export type PatientTwinVieSection = {
  engine_version: typeof VIE_ENGINE_VERSION;
  imaging_completeness: ViePatientImagingCompleteness;
  latest_intelligence: VieLatestIntelligenceRow[];
  comparison_readiness: VieComparisonReadinessSummary;
  alignment_summary: ViePatientTwinAlignmentSummary;
  outcome_summary: VieOutcomeSummary;
  future_architecture: typeof VIE_FUTURE_ARCHITECTURE;
};

export type VieLatestIntelligenceRow = {
  patient_image_id: string;
  protocol_template_slug: string;
  protocol_slot_slug: string;
  quality_score: number;
  quality_band: VieInstantIntelligenceResult["quality_band"];
  clinically_usable: boolean;
  acceptance_status: VieInstantIntelligenceResult["acceptance_status"];
  created_at: string;
};

export async function loadPatientTwinVieSection(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientTwinVieSection> {
  const supabase = client ?? (await import("@/lib/supabaseAdmin")).supabaseAdmin();
  let imaging_completeness = await loadViePatientImagingCompleteness(tenantId, patientId, supabase);

  const { data, error } = await supabase
    .from("fi_vie_capture_intelligence")
    .select(
      "patient_image_id, protocol_template_slug, protocol_slot_slug, quality_score, quality_band, clinically_usable, acceptance_status, created_at"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);

  const latest_intelligence: VieLatestIntelligenceRow[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      patient_image_id: String(r.patient_image_id),
      protocol_template_slug: String(r.protocol_template_slug),
      protocol_slot_slug: String(r.protocol_slot_slug),
      quality_score: Number(r.quality_score ?? 0),
      quality_band: String(
        r.quality_band ?? "acceptable"
      ) as VieInstantIntelligenceResult["quality_band"],
      clinically_usable: r.clinically_usable !== false,
      acceptance_status: String(
        r.acceptance_status ?? "pending"
      ) as VieInstantIntelligenceResult["acceptance_status"],
      created_at: String(r.created_at),
    };
  });

  const latestAccepted = latest_intelligence.find((row) => row.acceptance_status === "accepted");
  const latestRow = latestAccepted ?? latest_intelligence[0];
  if (latestRow) {
    imaging_completeness = {
      ...imaging_completeness,
      latest_capture_quality: {
        quality_score: latestRow.quality_score,
        quality_band: latestRow.quality_band,
        protocol_template_slug: latestRow.protocol_template_slug,
        protocol_slot_slug: latestRow.protocol_slot_slug,
        captured_at: latestRow.created_at,
        clinically_usable: latestRow.clinically_usable,
        acceptance_status: latestRow.acceptance_status,
      },
    };
  }

  const comparison_readiness = await loadVieComparisonReadinessForPatient(
    tenantId,
    patientId,
    null,
    supabase
  );
  const alignment_summary = await loadPatientTwinAlignmentSummary(tenantId, patientId, supabase);
  const outcome_summary = await computeVieOutcomeSummaryForPatient(tenantId, patientId, {
    client: supabase,
  });

  return {
    engine_version: VIE_ENGINE_VERSION,
    imaging_completeness,
    latest_intelligence,
    comparison_readiness,
    alignment_summary,
    outcome_summary,
    future_architecture: VIE_FUTURE_ARCHITECTURE,
  };
}
