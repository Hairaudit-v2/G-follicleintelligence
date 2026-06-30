import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPatientImageSignedUrls } from "@/src/lib/patientImages/patientImagesServer";
import {
  loadActiveTherapyPlanSummary,
  loadPatientTherapyEventsForPatient,
} from "@/src/lib/medicationOs/medicationOsLoaders.server";
import type { PatientTherapyEventRow } from "@/src/lib/medicationOs/medicationOsTypes";
import { loadPatientTwinHairProgressionSection } from "@/src/lib/patientTwin/patientTwinHairProgression.server";
import { recipientAssessmentNotConfiguredResult } from "./assessRecipientFallback";
import {
  HIE_RECIPIENT_ASSESSOR_VERSION,
  assessRecipientWithOpenAi,
  isRecipientAssessorOpenAiConfigured,
} from "./openAiRecipientAssessment.server";
import { insertHairIntelligenceRecipientCandidacyReviewRow } from "./persistRecipientAssessment.server";
import { HIE_RECIPIENT_AREA_IMAGE_CATEGORIES } from "./types";
import type {
  HairIntelligenceRecipientCandidacyReviewInsert,
  HieRecipientSourceSystem,
  RecipientAssessmentModelResult,
} from "./types";

const RECIPIENT_CATEGORIES_SQL = [...HIE_RECIPIENT_AREA_IMAGE_CATEGORIES] as string[];

export type AssessRecipientParams = {
  source_system: HieRecipientSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  patient_image_id?: string | null;
  image_url_for_model?: string | null;
  client?: SupabaseClient;
};

export type AssessRecipientOutcome = {
  result: RecipientAssessmentModelResult;
  assessorVersion: string;
  usedOpenAi: boolean;
  persisted: { id: string };
};

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

function buildTherapyContext(
  events: PatientTherapyEventRow[],
  activeCanonicalCodes: string[]
): {
  modalities_in_event_history: string[];
  stabilisation_related_history: boolean;
  active_plan_includes_tracked_modality: boolean;
} {
  const modalities = new Set<string>();
  for (const e of events) {
    const blob = `${e.canonical_code ?? ""} ${e.event_type}`.toLowerCase();
    for (const m of modalityHits(e.canonical_code, blob)) {
      modalities.add(m);
    }
  }
  const stabilisationRelated =
    modalities.has("finasteride") ||
    modalities.has("dutasteride") ||
    modalities.has("oral_minoxidil") ||
    modalities.has("topical_minoxidil");

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
    stabilisation_related_history: stabilisationRelated,
    active_plan_includes_tracked_modality: activePlanTracked,
  };
}

async function resolveImageUrlForModel(params: AssessRecipientParams): Promise<string | null> {
  const direct = params.image_url_for_model?.trim();
  if (direct) return direct;
  const tid = params.tenant_id?.trim();
  const iid = params.patient_image_id?.trim();
  if (!tid || !iid) return null;
  const supabase = params.client ?? supabaseAdmin();
  const { data: row, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", iid)
    .eq("image_status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const mapped = row as Record<string, unknown>;
  const bucket = String(mapped.storage_bucket ?? "patient-images");
  const path = String(mapped.storage_path ?? "");
  if (!path) return null;
  const signedMap = await createPatientImageSignedUrls(
    [{ id: iid, storage_bucket: bucket, storage_path: path }],
    supabase
  );
  const signed = signedMap.get(iid);
  return signed?.url ?? null;
}

async function resolveDefaultRecipientPatientImageId(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<string | null> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data: hli, error: e1 } = await supabase
    .from("hli_image_classifications")
    .select("source_record_id")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .in("image_category", RECIPIENT_CATEGORIES_SQL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!e1 && hli && (hli as { source_record_id?: string }).source_record_id) {
    return String((hli as { source_record_id: string }).source_record_id).trim() || null;
  }
  const preferred = ["front", "crown", "top"];
  const { data: img, error: e2 } = await supabase
    .from("fi_patient_images")
    .select("id, ai_image_category")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("image_status", "active")
    .order("taken_at", { ascending: false, nullsFirst: false })
    .limit(40);
  if (e2) return null;
  for (const p of preferred) {
    const hit = (img ?? []).find(
      (r) => String((r as Record<string, unknown>).ai_image_category ?? "") === p
    );
    if (hit) return String((hit as { id: string }).id);
  }
  const first = (img ?? [])[0] as { id?: string } | undefined;
  return first?.id != null ? String(first.id) : null;
}

async function latestRecipientHliClassificationIdForPatientImage(
  supabase: SupabaseClient,
  patientImageId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hli_image_classifications")
    .select("id")
    .eq("source_record_id", patientImageId)
    .in("image_category", RECIPIENT_CATEGORIES_SQL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
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

async function latestDonorAssessmentSummary(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ id: string; summary: Record<string, unknown> } | null> {
  const { data, error } = await supabase
    .from("hair_intelligence_donor_assessments")
    .select(
      "id, donor_quality_rating, miniaturisation_risk, retrograde_risk, safe_donor_capacity_band"
    )
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const x = data as Record<string, unknown>;
  return {
    id: String(x.id),
    summary: {
      donor_quality_rating: x.donor_quality_rating,
      miniaturisation_risk: x.miniaturisation_risk,
      retrograde_risk: x.retrograde_risk,
      safe_donor_capacity_band: x.safe_donor_capacity_band,
    },
  };
}

async function pathologyRecordsPresent(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<boolean> {
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
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
  return (c1 ?? 0) > 0 || (c2 ?? 0) > 0;
}

/**
 * Resolve image URL, assemble longitudinal + therapy context, run recipient vision assessor (or fallback), persist ledger row.
 */
export async function assessRecipient(
  params: AssessRecipientParams
): Promise<AssessRecipientOutcome> {
  const supabase = params.client ?? supabaseAdmin();
  let patientId = params.patient_id?.trim() ?? null;
  let caseId = params.case_id?.trim() ?? null;
  let patientImageId = params.patient_image_id?.trim() ?? null;
  const tenantId = params.tenant_id?.trim() ?? null;

  if (patientImageId && tenantId) {
    const { data: row, error } = await supabase
      .from("fi_patient_images")
      .select("patient_id, case_id")
      .eq("tenant_id", tenantId)
      .eq("id", patientImageId)
      .eq("image_status", "active")
      .maybeSingle();
    if (!error && row) {
      const m = row as Record<string, unknown>;
      if (!patientId && m.patient_id) patientId = String(m.patient_id);
      if (!caseId && m.case_id) caseId = String(m.case_id);
    }
  }

  if (!patientImageId && tenantId && patientId) {
    patientImageId = await resolveDefaultRecipientPatientImageId(supabase, tenantId, patientId);
  }

  const assessParams: AssessRecipientParams = {
    ...params,
    tenant_id: tenantId,
    patient_id: patientId,
    case_id: caseId,
    patient_image_id: patientImageId,
    client: supabase,
  };

  let hairLossClassificationId: string | null = null;
  let donorAssessmentId: string | null = null;
  let recipientImageClassificationId: string | null = null;
  let progressionVelocity: number | null = null;
  const context: Record<string, unknown> = {};

  if (tenantId && patientId) {
    const [hairLoss, donorBundle, progression, therapyEvents, activeSummary, pathologyPresent] =
      await Promise.all([
        latestHairLossClassificationBundle(supabase, tenantId, patientId),
        latestDonorAssessmentSummary(supabase, tenantId, patientId),
        loadPatientTwinHairProgressionSection(tenantId, patientId, {}, supabase).catch(() => null),
        loadPatientTherapyEventsForPatient(supabase, tenantId, patientId, { limit: 200 }).catch(
          () => [] as PatientTherapyEventRow[]
        ),
        loadActiveTherapyPlanSummary(supabase, tenantId, patientId).catch(() => null),
        pathologyRecordsPresent(supabase, tenantId, patientId),
      ]);

    hairLossClassificationId = hairLoss.id;
    donorAssessmentId = donorBundle?.id ?? null;

    if (patientImageId) {
      recipientImageClassificationId = await latestRecipientHliClassificationIdForPatientImage(
        supabase,
        patientImageId
      );
    }

    const activeCodes = (activeSummary?.plans ?? []).flatMap((p) =>
      p.items.map((i) => i.canonical_code)
    );
    const therapyCtx = buildTherapyContext(therapyEvents, activeCodes);

    if (progression) {
      const v =
        progression.progression_velocity.confidence_weighted_grades_per_year ??
        progression.progression_velocity.grades_per_year;
      progressionVelocity = v != null && Number.isFinite(v) ? v : null;
    }

    Object.assign(context, {
      hair_loss_classification: hairLoss.summary,
      donor_assessment: donorBundle
        ? { donor_assessment_id: donorBundle.id, ...donorBundle.summary }
        : null,
      hair_progression: progression
        ? {
            stability_label: progression.stability.label,
            stability_rationale: progression.stability.rationale,
            progression_velocity_grades_per_year: progression.progression_velocity.grades_per_year,
            progression_velocity_weighted_grades_per_year:
              progression.progression_velocity.confidence_weighted_grades_per_year,
            analysis_basis: progression.analysis_basis,
          }
        : null,
      therapy_signals: {
        ...therapyCtx,
        no_stabilisation_attempts: !therapyCtx.stabilisation_related_history,
      },
      pathology_context: {
        pathology_records_present: pathologyPresent,
      },
      imaging_context: {
        patient_image_id: patientImageId,
        recipient_area_hli_categories: RECIPIENT_CATEGORIES_SQL,
      },
    });
  }

  const imageUrl = await resolveImageUrlForModel(assessParams);
  let result: RecipientAssessmentModelResult;
  let usedOpenAi = false;
  let assessorVersion: string = HIE_RECIPIENT_ASSESSOR_VERSION;

  if (!imageUrl) {
    result = recipientAssessmentNotConfiguredResult("no_image");
    assessorVersion = `${HIE_RECIPIENT_ASSESSOR_VERSION};fallback=no_image`;
  } else if (!isRecipientAssessorOpenAiConfigured()) {
    result = recipientAssessmentNotConfiguredResult("no_api_key");
    assessorVersion = `${HIE_RECIPIENT_ASSESSOR_VERSION};fallback=no_api_key`;
  } else {
    const { result: r, model } = await assessRecipientWithOpenAi({
      imageUrlForModel: imageUrl,
      structuredContextJson: JSON.stringify(context),
    });
    result = r;
    usedOpenAi = true;
    assessorVersion = `${HIE_RECIPIENT_ASSESSOR_VERSION};model=${model}`;
  }

  const row: HairIntelligenceRecipientCandidacyReviewInsert = {
    source_system: params.source_system,
    source_record_id: params.source_record_id ?? patientImageId,
    tenant_id: tenantId,
    patient_id: patientId,
    case_id: caseId,
    hair_loss_classification_id: hairLossClassificationId,
    donor_assessment_id: donorAssessmentId,
    recipient_image_classification_id: recipientImageClassificationId,
    progression_velocity: progressionVelocity,
    recipient_quality_rating: result.recipient_quality_rating,
    confidence_score: result.confidence_score,
    diffuse_thinning_risk: result.diffuse_thinning_risk,
    shock_loss_risk: result.shock_loss_risk,
    density_expectation_risk: result.density_expectation_risk,
    medication_stabilisation_needed: result.medication_stabilisation_needed,
    pathology_review_recommended: result.pathology_review_recommended,
    surgical_timing_risk: result.surgical_timing_risk,
    patient_expectation_risk: result.patient_expectation_risk,
    documentation_gap_detected: result.documentation_gap_detected,
    candidacy_summary: result.candidacy_summary.trim() ? result.candidacy_summary : null,
    review_topics: result.review_topics,
    ai_notes: result.ai_notes.trim() ? result.ai_notes : null,
    review_status: "pending",
    reviewed_by_user_id: null,
    reviewed_at: null,
    assessor_version: assessorVersion,
  };

  const persisted = await insertHairIntelligenceRecipientCandidacyReviewRow(row, supabase);
  return { result, assessorVersion, usedOpenAi, persisted };
}
