import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadActiveTherapyPlanSummary,
  loadPatientTherapyEventsForPatient,
} from "@/src/lib/medicationOs/medicationOsLoaders.server";
import type { PatientTherapyEventRow } from "@/src/lib/medicationOs/medicationOsTypes";
import { loadPatientTwinHairProgressionSection } from "@/src/lib/patientTwin/patientTwinHairProgression.server";
import { consultationChecklistFallbackResult } from "./generateChecklistFallback";
import {
  HIE_CONSULTATION_CHECKLIST_GENERATOR_VERSION,
  generateConsultationChecklistWithOpenAi,
  isConsultationChecklistOpenAiConfigured,
} from "./openAiChecklistGenerator.server";
import { insertHairIntelligenceConsultationChecklistRow } from "./persistChecklist.server";
import type {
  GenerateConsultationChecklistOutcome,
  GenerateConsultationChecklistParams,
  HairIntelligenceConsultationChecklistInsert,
} from "./types";

function modalityHits(code: string | null, haystack: string): string[] {
  const c = (code ?? "").toLowerCase();
  const h = haystack.toLowerCase();
  const out: string[] = [];
  if (c.includes("finasteride") || h.includes("finasteride")) out.push("finasteride");
  if (c.includes("dutasteride") || h.includes("dutasteride")) out.push("dutasteride");
  if (c.includes("minoxidil") || h.includes("minoxidil")) {
    if (c.includes("oral") || h.includes("oral minoxidil")) out.push("oral_minoxidil");
    else out.push("topical_minoxidil");
  }
  if (c === "prp" || c.includes("prp") || h.includes(" prp") || h.includes("prp")) out.push("prp");
  if (c.includes("exosome") || h.includes("exosome")) out.push("exosomes");
  return out;
}

function stabilisationModalitiesFromEvent(e: PatientTherapyEventRow): string[] {
  const blob = `${e.canonical_code ?? ""} ${e.event_type}`.toLowerCase();
  return modalityHits(e.canonical_code, blob).filter((m) =>
    ["finasteride", "dutasteride", "oral_minoxidil", "topical_minoxidil"].includes(m)
  );
}

function buildTherapySignals(
  events: PatientTherapyEventRow[],
  activeCanonicalCodes: string[]
): Record<string, unknown> {
  const modalities = new Set<string>();
  let stabilisationStopOrHold = 0;
  for (const e of events) {
    const blob = `${e.canonical_code ?? ""} ${e.event_type}`.toLowerCase();
    for (const m of modalityHits(e.canonical_code, blob)) {
      modalities.add(m);
    }
    const stabMods = stabilisationModalitiesFromEvent(e);
    if (
      stabMods.length > 0 &&
      (e.event_type === "therapy_stopped" ||
        e.event_type === "plan_cancelled" ||
        e.event_type === "therapy_on_hold" ||
        e.event_type === "adverse_event")
    ) {
      stabilisationStopOrHold += 1;
    }
  }

  let activePlanTracked = false;
  for (const c of activeCanonicalCodes) {
    const hits = modalityHits(c, c);
    if (
      hits.some((h) =>
        [
          "finasteride",
          "dutasteride",
          "oral_minoxidil",
          "topical_minoxidil",
          "prp",
          "exosomes",
        ].includes(h)
      )
    ) {
      activePlanTracked = true;
      break;
    }
  }

  return {
    modalities_in_event_history: Array.from(modalities),
    active_plan_includes_tracked_modality: activePlanTracked,
    stabilisation_related_history:
      modalities.has("finasteride") ||
      modalities.has("dutasteride") ||
      modalities.has("oral_minoxidil") ||
      modalities.has("topical_minoxidil"),
    prior_stabilisation_interruption_signals: stabilisationStopOrHold,
    recent_event_types_sample: events.slice(0, 12).map((e) => ({
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      canonical_code: e.canonical_code,
    })),
  };
}

async function latestHairLossClassificationBundle(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ id: string | null; summary: Record<string, unknown> | null }> {
  const { data, error } = await supabase
    .from("hair_intelligence_hair_loss_classifications")
    .select(
      "id, pattern_type, classification_grade, classification_system, confidence_score, frontal_loss_score, temporal_recession_score, mid_scalp_score, crown_loss_score, diffuse_thinning_score, review_status"
    )
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { id: null, summary: null };
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    summary: {
      pattern_type: x.pattern_type,
      classification_grade: x.classification_grade,
      classification_system: x.classification_system,
      confidence_score: x.confidence_score,
      frontal_loss_score: x.frontal_loss_score,
      temporal_recession_score: x.temporal_recession_score,
      mid_scalp_score: x.mid_scalp_score,
      crown_loss_score: x.crown_loss_score,
      diffuse_thinning_score: x.diffuse_thinning_score,
      review_status: x.review_status,
    },
  };
}

async function latestDonorAssessmentBundle(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ id: string | null; summary: Record<string, unknown> | null }> {
  const { data, error } = await supabase
    .from("hair_intelligence_donor_assessments")
    .select(
      "id, donor_quality_rating, miniaturisation_risk, retrograde_risk, safe_donor_capacity_band, extraction_caution_level, confidence_score, review_status"
    )
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { id: null, summary: null };
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    summary: {
      donor_quality_rating: x.donor_quality_rating,
      miniaturisation_risk: x.miniaturisation_risk,
      retrograde_risk: x.retrograde_risk,
      safe_donor_capacity_band: x.safe_donor_capacity_band,
      extraction_caution_level: x.extraction_caution_level,
      confidence_score: x.confidence_score,
      review_status: x.review_status,
    },
  };
}

async function latestRecipientReviewBundle(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ id: string | null; summary: Record<string, unknown> | null }> {
  const { data, error } = await supabase
    .from("hair_intelligence_recipient_candidacy_reviews")
    .select(
      "id, diffuse_thinning_risk, shock_loss_risk, medication_stabilisation_needed, pathology_review_recommended, surgical_timing_risk, patient_expectation_risk, review_topics, candidacy_summary, confidence_score, review_status"
    )
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { id: null, summary: null };
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    summary: {
      diffuse_thinning_risk: x.diffuse_thinning_risk,
      shock_loss_risk: x.shock_loss_risk,
      medication_stabilisation_needed: x.medication_stabilisation_needed,
      pathology_review_recommended: x.pathology_review_recommended,
      surgical_timing_risk: x.surgical_timing_risk,
      patient_expectation_risk: x.patient_expectation_risk,
      review_topics: x.review_topics,
      candidacy_summary: x.candidacy_summary,
      confidence_score: x.confidence_score,
      review_status: x.review_status,
    },
  };
}

async function pathologyWorkflowSignals(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ pathology_ordered: boolean; pathology_completed: boolean }> {
  const [{ count: reqCount }, { count: resCount }] = await Promise.all([
    supabase
      .from("fi_pathology_requests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .limit(1),
    supabase
      .from("fi_pathology_results")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .limit(1),
  ]);
  return {
    pathology_ordered: (reqCount ?? 0) > 0,
    pathology_completed: (resCount ?? 0) > 0,
  };
}

/**
 * Loads latest HIE slices + therapy + pathology presence, calls OpenAI (or fallback), persists `hair_intelligence_consultation_checklists`.
 */
export async function generateConsultationChecklistAndPersist(
  params: GenerateConsultationChecklistParams & { client?: SupabaseClient }
): Promise<GenerateConsultationChecklistOutcome> {
  const supabase = params.client ?? supabaseAdmin();
  const tenantId = params.tenant_id?.trim() ?? null;
  const patientId = params.patient_id?.trim() ?? null;

  if (!tenantId || !patientId) {
    const fb = consultationChecklistFallbackResult("no_patient_context");
    const row: HairIntelligenceConsultationChecklistInsert = {
      source_system: params.source_system,
      source_record_id: params.source_record_id,
      tenant_id: tenantId,
      patient_id: patientId,
      case_id: params.case_id?.trim() ?? null,
      hair_loss_classification_id: null,
      donor_assessment_id: null,
      recipient_review_id: null,
      confidence_score: fb.confidence_score,
      checklist_status: "generated",
      priority_level: fb.priority_level,
      medication_discussion_required: fb.medication_discussion_required,
      stabilisation_discussion_required: fb.stabilisation_discussion_required,
      donor_preservation_discussion_required: fb.donor_preservation_discussion_required,
      expectation_management_required: fb.expectation_management_required,
      consent_complexity_level: fb.consent_complexity_level,
      documentation_required: fb.documentation_required,
      follow_up_required: fb.follow_up_required,
      delay_recommended: fb.delay_recommended,
      consultation_summary: fb.consultation_summary.trim() ? fb.consultation_summary : null,
      checklist_items: fb.checklist_items,
      risk_flags: fb.risk_flags,
      ai_notes: fb.ai_notes.trim() ? fb.ai_notes : null,
      review_status: "pending",
      reviewed_by_user_id: null,
      reviewed_at: null,
      generator_version: `${HIE_CONSULTATION_CHECKLIST_GENERATOR_VERSION};fallback=no_patient_context`,
    };
    const persisted = await insertHairIntelligenceConsultationChecklistRow(row, supabase);
    return {
      result: fb,
      generatorVersion: row.generator_version ?? "",
      usedOpenAi: false,
      persisted,
    };
  }

  const [hairLoss, donor, recipient, progression, therapyEvents, activeSummary, pathologySignals] =
    await Promise.all([
      latestHairLossClassificationBundle(supabase, tenantId, patientId),
      latestDonorAssessmentBundle(supabase, tenantId, patientId),
      latestRecipientReviewBundle(supabase, tenantId, patientId),
      loadPatientTwinHairProgressionSection(tenantId, patientId, {}, supabase).catch(() => null),
      loadPatientTherapyEventsForPatient(supabase, tenantId, patientId, { limit: 200 }).catch(
        () => [] as PatientTherapyEventRow[]
      ),
      loadActiveTherapyPlanSummary(supabase, tenantId, patientId).catch(() => null),
      pathologyWorkflowSignals(supabase, tenantId, patientId),
    ]);

  const activeCodes = (activeSummary?.plans ?? []).flatMap((p) =>
    p.items.map((i) => i.canonical_code)
  );
  const therapy_signals = buildTherapySignals(therapyEvents, activeCodes);

  const progressionDto = progression
    ? {
        stability_label: progression.stability.label,
        stability_rationale: progression.stability.rationale,
        progression_velocity_grades_per_year: progression.progression_velocity.grades_per_year,
        progression_velocity_weighted_grades_per_year:
          progression.progression_velocity.confidence_weighted_grades_per_year,
        rapid_progression_signal: progression.stability.label === "rapid_progression",
        diffuse_unstable_progression_signal:
          progression.stability.label === "diffuse_unstable_progression",
        analysis_basis: progression.analysis_basis,
      }
    : null;

  const context = {
    hair_loss_classification: hairLoss.summary,
    donor_assessment: donor.summary ? { donor_assessment_id: donor.id, ...donor.summary } : null,
    recipient_candidacy_review: recipient.summary
      ? { recipient_review_id: recipient.id, ...recipient.summary }
      : null,
    hair_progression: progressionDto,
    therapy_signals,
    pathology_workflow_presence: pathologySignals,
  };

  let usedOpenAi = false;
  let generatorVersion: string = HIE_CONSULTATION_CHECKLIST_GENERATOR_VERSION;
  let result = consultationChecklistFallbackResult("openai_unavailable");

  if (!isConsultationChecklistOpenAiConfigured()) {
    result = consultationChecklistFallbackResult("no_api_key");
    generatorVersion = `${HIE_CONSULTATION_CHECKLIST_GENERATOR_VERSION};fallback=no_api_key`;
  } else {
    try {
      const { result: r, model } = await generateConsultationChecklistWithOpenAi({
        structuredContextJson: JSON.stringify(context),
      });
      result = r;
      usedOpenAi = true;
      generatorVersion = `${HIE_CONSULTATION_CHECKLIST_GENERATOR_VERSION};model=${model}`;
    } catch {
      result = consultationChecklistFallbackResult("openai_unavailable");
      generatorVersion = `${HIE_CONSULTATION_CHECKLIST_GENERATOR_VERSION};fallback=openai_error`;
    }
  }

  const row: HairIntelligenceConsultationChecklistInsert = {
    source_system: params.source_system,
    source_record_id: params.source_record_id,
    tenant_id: tenantId,
    patient_id: patientId,
    case_id: params.case_id?.trim() ?? null,
    hair_loss_classification_id: hairLoss.id,
    donor_assessment_id: donor.id,
    recipient_review_id: recipient.id,
    confidence_score: result.confidence_score,
    checklist_status: "generated",
    priority_level: result.priority_level,
    medication_discussion_required: result.medication_discussion_required,
    stabilisation_discussion_required: result.stabilisation_discussion_required,
    donor_preservation_discussion_required: result.donor_preservation_discussion_required,
    expectation_management_required: result.expectation_management_required,
    consent_complexity_level: result.consent_complexity_level,
    documentation_required: result.documentation_required,
    follow_up_required: result.follow_up_required,
    delay_recommended: result.delay_recommended,
    consultation_summary: result.consultation_summary.trim() ? result.consultation_summary : null,
    checklist_items: result.checklist_items,
    risk_flags: result.risk_flags,
    ai_notes: result.ai_notes.trim() ? result.ai_notes : null,
    review_status: "pending",
    reviewed_by_user_id: null,
    reviewed_at: null,
    generator_version: generatorVersion,
  };

  const persisted = await insertHairIntelligenceConsultationChecklistRow(row, supabase);
  return { result, generatorVersion, usedOpenAi, persisted };
}
