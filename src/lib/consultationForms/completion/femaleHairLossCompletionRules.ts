import { CONSULTATION_FORM_OPTION_SETS } from "../consultationFormOptionSets";
import { FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import {
  canonicalFemaleDiagnosisBody,
  canonicalFemalePatternClassificationLines,
  canonicalFemaleRecommendedPlanText,
  canonicalFemaleRecommendedTreatments,
  canonicalFemaleRiskFlagValues,
} from "../normalize/femaleHairLossConsultationNormalize";
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
  readStringArray,
} from "./consultationCompletionExtractors";

function parseOutcomeDefaultMedical(raw: unknown): ConsultationOutcomeType {
  const s = readString(raw).trim() as ConsultationOutcomeType;
  return (CONSULTATION_OUTCOME_TYPES as readonly string[]).includes(s) ? s : "medical_management";
}

function emptyFemaleSummaryBase(input: ConsultationCompletionInput): ConsultationCompletionSummary {
  return {
    consultationId: input.consultationId,
    formInstanceId: input.formInstanceId,
    templateSlug: input.templateSlug,
    completedAt: input.completedAt,
    outcomeType: "medical_management",
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

function buildFemaleDiagnosisImpression(values: Record<string, unknown>): string {
  const durKey = readString(values.duration_band).trim();
  const durLine = durKey
    ? `Duration: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.consultation_duration_band, durKey) || durKey}.`
    : "";

  const shedKey = readString(values.shedding_reported).trim();
  const shedLine = shedKey
    ? `Shedding: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.shedding_severity, shedKey) || shedKey}.`
    : "";

  const ppKey = readString(values.postpartum_status).trim();
  const ppLine = ppKey
    ? `Postpartum context: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.postpartum_status, ppKey) || ppKey}.`
    : "";

  const cls = canonicalFemalePatternClassificationLines(values).join("\n");
  const body = canonicalFemaleDiagnosisBody(values);

  return [durLine, shedLine, ppLine, cls, body]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/**
 * Rules-based completion summary for {@link FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG}.
 */
export function buildFemaleHairLossCompletionSummary(
  input: ConsultationCompletionInput
): ConsultationCompletionSummary {
  const v = input.values ?? {};
  const base = emptyFemaleSummaryBase(input);

  if (input.templateSlug.trim() !== FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG) {
    return { ...base, clinicianNotesPreview: buildClinicianNotesPreview(v) };
  }

  const outcomeType = parseOutcomeDefaultMedical(v.consultation_outcome_type);

  const primaryFocus = readString(v.priority_focus);
  const primaryConcern = labelForOptionValue(
    CONSULTATION_FORM_OPTION_SETS.female_priority_focus,
    primaryFocus
  );

  const patternKey = readString(v.female_pattern_type).trim();
  const hairLossPatternTypeLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.female_hair_loss_pattern_type, patternKey) ||
    patternKey;

  const diagnosisImpression = buildFemaleDiagnosisImpression(v);

  const recommendedProcedure = canonicalFemaleRecommendedPlanText(v);

  const treatments = canonicalFemaleRecommendedTreatments(v);

  const riskFlags = canonicalFemaleRiskFlagValues(v);

  const pathologyExplicit = readBoolean(v.pathology_recommended_explicit);
  const bloodAnalysis = readBoolean(v.blood_analysis_recommended);
  const pathologyFromRiskFlags =
    riskFlags.includes("medical_review_required") || riskFlags.includes("blood_tests_recommended");
  const pathologyRecommended = pathologyExplicit || bloodAnalysis || pathologyFromRiskFlags;

  let pathologyReason = readString(v.pathology_reason).trim();
  if (pathologyRecommended && !pathologyReason) {
    if (bloodAnalysis) pathologyReason = "Blood analysis / lab panel recommended.";
    else if (pathologyFromRiskFlags) pathologyReason = "Discussed / flagged on consultation form.";
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

  const hormonalSelected = readStringArray(v.hormonal_flags);
  const hormonalSystemicSummary = hormonalSelected.length
    ? hormonalSelected
        .map(
          (h) => labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.female_hormonal_flags, h) || h
        )
        .join("; ")
    : "None selected on hormonal screen.";

  const ferritinKey = readString(v.ferritin_history_known).trim();
  const ferritinLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.ferritin_history_known, ferritinKey) ||
    ferritinKey;

  const thyroidKey = readString(v.thyroid_history_known).trim();
  const thyroidLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.thyroid_history_known, thyroidKey) ||
    thyroidKey;

  const ludwigKey = readString(v.ludwig_classification).trim();
  const ludwigLabel = ludwigKey
    ? labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.ludwig_scale, ludwigKey) || ludwigKey
    : "";

  const sinclairKey = readString(v.sinclair_classification).trim();
  const sinclairLabel = sinclairKey
    ? labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.sinclair_scale, sinclairKey) || sinclairKey
    : "";

  const femaleScaleSummary = [
    ludwigLabel && `Ludwig: ${ludwigLabel}`,
    sinclairLabel && `Sinclair: ${sinclairLabel}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const sheddingLabel =
    labelForOptionValue(
      CONSULTATION_FORM_OPTION_SETS.shedding_severity,
      readString(v.shedding_reported).trim()
    ) || readString(v.shedding_reported).trim();

  const durationLabel =
    labelForOptionValue(
      CONSULTATION_FORM_OPTION_SETS.consultation_duration_band,
      readString(v.duration_band).trim()
    ) || readString(v.duration_band).trim();

  const bloodPathologySummary = pathologyRecommended
    ? [bloodAnalysis ? "Blood analysis recommended" : null, pathologyReason || null]
        .filter(Boolean)
        .join(" — ")
    : "Not flagged as required from this form.";

  const followUpUrgencyLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.urgency, urgency.trim()) || urgency.trim();

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
    femaleHairLossCompletionSnapshot: {
      patternLabel: hairLossPatternTypeLabel,
      durationLabel,
      sheddingLabel,
      femaleScaleSummary: femaleScaleSummary || "—",
      hormonalSystemicSummary,
      ferritinLabel,
      thyroidLabel,
      bloodPathologySummary,
      treatmentPathwayLabel: hliPathwayRecommendedLabel,
      followUpUrgencyLabel,
    },
  };
}
