import { FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import type {
  ConsultationCompletionInput,
  ConsultationCompletionSummary,
  ConsultationOutcomeType,
} from "./consultationCompletionTypes";
import { CONSULTATION_OUTCOME_TYPES } from "./consultationCompletionTypes";
import {
  buildClinicianNotesPreview,
  readBoolean,
  readString,
} from "./consultationCompletionExtractors";

const PROGRESSION_OPTIONS: { value: string; label: string }[] = [
  { value: "progressing_well", label: "Progressing well" },
  { value: "stable", label: "Stable" },
  { value: "treatment_failing", label: "Treatment failing" },
  { value: "surgery_candidate_now", label: "Surgery candidate now" },
  { value: "further_investigation_needed", label: "Further investigation needed" },
];

const NEXT_PATHWAY_OPTIONS: { value: string; label: string }[] = [
  { value: "continue_current_protocol", label: "Continue current protocol" },
  { value: "move_to_hli", label: "Move to HLI / medical pathway" },
  { value: "move_to_hair_transplant_consult", label: "Move to hair transplant consult" },
  { value: "move_to_repair_consult", label: "Move to repair consult" },
  { value: "request_blood_analysis", label: "Request blood analysis" },
  { value: "surgery_planning", label: "Surgery planning (SurgeryOS)" },
];

const TREATMENT_LABELS: { value: string; label: string }[] = [
  { value: "finasteride", label: "Finasteride / dutasteride" },
  { value: "oral_minoxidil", label: "Oral minoxidil" },
  { value: "topical_minoxidil", label: "Topical minoxidil" },
  { value: "prp", label: "PRP" },
  { value: "exosomes", label: "Exosomes / biologics" },
  { value: "mesotherapy", label: "Mesotherapy" },
  { value: "laser_lllt", label: "Low-level laser / light therapy" },
  { value: "nutraceuticals", label: "Nutraceuticals / adjuncts" },
  { value: "scalp_therapy", label: "Dedicated scalp therapy / trichology" },
];

const REVIEW_TYPE_LABELS: { value: string; label: string }[] = [
  { value: "post_treatment_review", label: "Post-treatment review" },
  { value: "post_prp_review", label: "Post-PRP review" },
  { value: "post_exosome_review", label: "Post-exosome review" },
  { value: "medication_review", label: "Medication review" },
  { value: "post_surgery_review", label: "Post-surgery review" },
  { value: "long_term_progress_review", label: "Long-term progress review" },
  { value: "annual_review", label: "Annual review" },
];

const COMPLIANCE_OPTIONS: { value: string; label: string }[] = [
  { value: "fully_compliant", label: "Fully compliant" },
  { value: "partially_compliant", label: "Partially compliant" },
  { value: "poor_compliance", label: "Poor compliance" },
  { value: "discontinued", label: "Discontinued" },
];

const PERCEIVED_OPTIONS: { value: string; label: string }[] = [
  { value: "significant_improvement", label: "Significant improvement" },
  { value: "moderate_improvement", label: "Moderate improvement" },
  { value: "minimal_improvement", label: "Minimal improvement" },
  { value: "no_change", label: "No change" },
  { value: "worsening", label: "Worsening" },
];

function optLabel(opts: { value: string; label: string }[], key: string): string {
  return opts.find((o) => o.value === key)?.label ?? key;
}

function parseOutcomeFromProgression(raw: unknown): ConsultationOutcomeType {
  const k = readString(raw).trim();
  if (k === "surgery_candidate_now") return "proceed_surgery";
  if (k === "further_investigation_needed") return "needs_blood_tests";
  if (k === "treatment_failing") return "review_later";
  if (k === "progressing_well" || k === "stable") return "medical_management";
  const s = k as ConsultationOutcomeType;
  return (CONSULTATION_OUTCOME_TYPES as readonly string[]).includes(s) ? s : "undecided";
}

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function emptyFollowUpBase(input: ConsultationCompletionInput): ConsultationCompletionSummary {
  return {
    consultationId: input.consultationId,
    formInstanceId: input.formInstanceId,
    templateSlug: input.templateSlug,
    completedAt: input.completedAt,
    outcomeType: "undecided",
    primaryConcern: "",
    diagnosisImpression: "",
    surgicalSuitability: "not_assessed",
    medicalSuitability: "not_assessed",
    recommendedProcedure: "",
    estimatedGraftsMin: null,
    estimatedGraftsMax: null,
    recommendedZones: [],
    recommendedTreatments: [],
    pathologyRecommended: false,
    pathologyReason: "",
    quoteNotes: "",
    followUpRequired: false,
    followUpReason: "",
    riskFlags: [],
    areaMapHighlights: [],
    clinicianNotesPreview: "",
    source: "rules_v1",
  };
}

const INTEGRATION_PLACEHOLDER =
  "Integration (future): Patient Twin progression payload, HairAudit progression when flagged, HLI treatment-response row, and AnalyticsOS outcome metrics — persist from orchestrator; not written automatically from this summary today.";

/**
 * Rules-based completion summary for {@link FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG}.
 */
export function buildFollowUpReviewCompletionSummary(
  input: ConsultationCompletionInput
): ConsultationCompletionSummary {
  const v = input.values ?? {};
  const base = emptyFollowUpBase(input);

  if (input.templateSlug.trim() !== FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG) {
    return { ...base, clinicianNotesPreview: buildClinicianNotesPreview(v) };
  }

  const outcomeType = parseOutcomeFromProgression(v.clinical_progression_assessment);

  const primaryConcern = readString(v.current_primary_concern).trim();

  const reviewTypeKey = readString(v.review_type).trim();
  const reviewTypeLabel = optLabel(REVIEW_TYPE_LABELS, reviewTypeKey);

  const complianceKey = readString(v.treatment_compliance).trim();
  const complianceLabel = optLabel(COMPLIANCE_OPTIONS, complianceKey);

  const perceivedKey = readString(v.perceived_improvement).trim();
  const perceivedLabel = optLabel(PERCEIVED_OPTIONS, perceivedKey);

  const sheddingKey = readString(v.shedding_changes).trim();
  const densityKey = readString(v.density_changes).trim();

  const satRaw = v.patient_satisfaction;
  const satisfactionScore =
    typeof satRaw === "number" && Number.isFinite(satRaw)
      ? Math.round(satRaw)
      : satRaw != null
        ? Number.parseInt(String(satRaw), 10)
        : NaN;
  const satisfactionDisplay = Number.isFinite(satisfactionScore) ? satisfactionScore : null;

  const diagnosisImpression = [
    `Perceived course: ${perceivedLabel || perceivedKey}.`,
    sheddingKey ? `Shedding: ${sheddingKey}.` : "",
    densityKey ? `Density: ${densityKey}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const progressionKey = readString(v.clinical_progression_assessment).trim();
  const progressionLabel = optLabel(PROGRESSION_OPTIONS, progressionKey);

  const hairaudit = readBoolean(v.hairaudit_progression_capture);
  const photos = readBoolean(v.updated_photos_captured);
  const modRequired = readBoolean(v.treatment_modification_required);

  const treatKeys = readStringArray(v.updated_recommended_treatments);
  const treatLabels = treatKeys.map((k) => optLabel(TREATMENT_LABELS, k)).filter(Boolean);

  const ai = readString(v.ai_progress_summary).trim();
  const recommendedProcedure =
    ai || "Follow-up review documented — see structured note and snapshot.";

  const nextKey = readString(v.next_pathway_recommended).trim();
  const nextPathwayLabel = optLabel(NEXT_PATHWAY_OPTIONS, nextKey);

  const urgencyKey = readString(v.follow_up_urgency).trim();
  const followUpUrgencyLabel = optLabel(
    [
      { value: "routine", label: "Routine" },
      { value: "priority", label: "Priority" },
      { value: "urgent", label: "Urgent" },
    ],
    urgencyKey
  );

  const pathologyRecommended =
    outcomeType === "needs_blood_tests" || nextKey === "request_blood_analysis";
  const pathologyReason = pathologyRecommended
    ? "Progression or next-pathway indicates labs / further investigation."
    : "";

  const followUpExplicit = readBoolean(v.follow_up_required_explicit);
  const followUpFromUrgency = urgencyKey === "priority" || urgencyKey === "urgent";
  const followUpRequired = followUpExplicit || followUpFromUrgency;

  let followUpReason = "";
  if (followUpRequired && followUpFromUrgency && !followUpExplicit) {
    followUpReason = `Follow-up suggested (urgency: ${urgencyKey}).`;
  }

  const outcomeIntelligenceLine = [
    `Progression: ${progressionLabel || progressionKey}.`,
    `HairAudit progression capture: ${hairaudit ? "yes" : "no"}.`,
    `Photos updated this visit: ${photos ? "yes" : "no"}.`,
    `Treatment modification: ${modRequired ? "required" : "not required"}.`,
  ].join(" ");

  const treatmentResponseLine = [perceivedLabel, `Satisfaction: ${satisfactionDisplay ?? "—"}/10`]
    .filter(Boolean)
    .join(" · ");

  const progressTrendLabel = [perceivedLabel, sheddingKey, densityKey].filter(Boolean).join(" · ");

  const clinicianNotesPreview = buildClinicianNotesPreview(v);

  return {
    ...base,
    outcomeType,
    primaryConcern,
    diagnosisImpression,
    recommendedProcedure,
    recommendedTreatments: treatLabels,
    pathologyRecommended,
    pathologyReason,
    followUpRequired,
    followUpReason,
    clinicianNotesPreview,
    followUpReviewCompletionSnapshot: {
      reviewTypeLabel,
      progressTrendLabel,
      complianceLabel,
      satisfactionScore: satisfactionDisplay,
      treatmentResponseLine,
      outcomeIntelligenceStatusLine: outcomeIntelligenceLine,
      nextPathwayLabel,
      integrationPlaceholderLine: INTEGRATION_PLACEHOLDER,
      followUpUrgencyLabel,
    },
  };
}
