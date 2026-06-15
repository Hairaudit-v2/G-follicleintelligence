import { CONSULTATION_FORM_OPTION_SETS } from "../consultationFormOptionSets";
import { HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import {
  canonicalHliDiagnosisBody,
  canonicalHliPatternClassificationLines,
  canonicalHliRecommendedPlanText,
  canonicalHliRiskFlagValues,
  canonicalHliRecommendedTreatments,
} from "../normalize/hairLossTreatmentConsultationNormalize";
import type {
  ConsultationCompletionInput,
  ConsultationCompletionSummary,
  ConsultationOutcomeType,
} from "./consultationCompletionTypes";
import { CONSULTATION_OUTCOME_TYPES } from "./consultationCompletionTypes";
import {
  buildClinicianNotesPreview,
  labelForOptionValue,
  readBoolean,
  readString,
} from "./consultationCompletionExtractors";

function parseOutcome(raw: unknown): ConsultationOutcomeType {
  const s = readString(raw).trim() as ConsultationOutcomeType;
  return (CONSULTATION_OUTCOME_TYPES as readonly string[]).includes(s) ? s : "undecided";
}

function emptyHliSummaryBase(input: ConsultationCompletionInput): ConsultationCompletionSummary {
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

function buildHliDiagnosisImpression(values: Record<string, unknown>): string {
  const durKey = readString(values.duration_band).trim();
  const durLine = durKey
    ? `Duration: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.consultation_duration_band, durKey) || durKey}.`
    : "";

  const cls = canonicalHliPatternClassificationLines(values).join("\n");
  const body = canonicalHliDiagnosisBody(values);

  return [durLine, cls, body].map((s) => s.trim()).filter(Boolean).join("\n\n").trim();
}

/**
 * Rules-based completion summary for {@link HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG}.
 */
export function buildHairLossTreatmentCompletionSummary(input: ConsultationCompletionInput): ConsultationCompletionSummary {
  const v = input.values ?? {};
  const base = emptyHliSummaryBase(input);

  if (input.templateSlug.trim() !== HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG) {
    return { ...base, clinicianNotesPreview: buildClinicianNotesPreview(v) };
  }

  const outcomeType = parseOutcome(v.consultation_outcome_type);

  const primaryFocus = readString(v.priority_focus);
  const primaryConcern = labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.consultation_priority, primaryFocus);

  const patternKey = readString(v.pattern_type).trim();
  const hairLossPatternTypeLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.hair_loss_pattern_type, patternKey) || patternKey;

  const diagnosisImpression = buildHliDiagnosisImpression(v);

  const recommendedProcedure = canonicalHliRecommendedPlanText(v);

  const treatments = canonicalHliRecommendedTreatments(v);

  const riskFlags = canonicalHliRiskFlagValues(v);

  const pathologyExplicit = readBoolean(v.pathology_recommended_explicit);
  const bloodAnalysis = readBoolean(v.blood_analysis_recommended);
  const pathologyFromRiskFlags =
    riskFlags.includes("medical_review_required") || riskFlags.includes("blood_tests_recommended");
  const pathologyFromOutcome = outcomeType === "needs_blood_tests";
  const pathologyRecommended = pathologyExplicit || bloodAnalysis || pathologyFromRiskFlags || pathologyFromOutcome;

  let pathologyReason = readString(v.pathology_reason).trim();
  if (pathologyRecommended && !pathologyReason) {
    if (bloodAnalysis) pathologyReason = "Blood analysis / lab panel recommended.";
    else if (pathologyFromRiskFlags) pathologyReason = "Discussed / flagged on consultation form.";
    else if (pathologyFromOutcome) pathologyReason = "Outcome set to needs blood tests.";
    else pathologyReason = "Clinician indicated pathology / screening.";
  }

  const urgency = readString(v.follow_up_urgency);
  const followUpExplicit = readBoolean(v.follow_up_required_explicit);
  const followUpFromUrgency = urgency === "soon" || urgency === "urgent" || urgency === "asap";
  const followUpRequired = followUpExplicit || followUpFromUrgency;

  let followUpReason = "";
  if (followUpRequired && followUpFromUrgency && !followUpExplicit) {
    followUpReason = `Follow-up suggested (urgency: ${urgency}).`;
  }

  const tpKey = readString(v.treatment_priority).trim();
  const treatmentPriorityLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.hli_treatment_priority, tpKey) || tpKey;

  const tlKey = readString(v.treatment_timeline).trim();
  const treatmentTimelineLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.hli_treatment_timeline, tlKey) || tlKey;

  const hliKey = readString(v.hli_pathway_recommended).trim();
  const hliPathwayRecommendedLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.hli_pathway_recommended, hliKey) || hliKey;

  const clinicianNotesPreview = buildClinicianNotesPreview(v);

  return {
    ...base,
    outcomeType,
    primaryConcern,
    diagnosisImpression,
    recommendedProcedure,
    recommendedTreatments: treatments,
    pathologyRecommended,
    pathologyReason,
    followUpRequired,
    followUpReason,
    riskFlags,
    clinicianNotesPreview,
    hairLossPatternTypeLabel,
    bloodAnalysisRecommended: bloodAnalysis,
    treatmentPriorityLabel,
    treatmentTimelineLabel,
    hliPathwayRecommendedLabel,
  };
}
