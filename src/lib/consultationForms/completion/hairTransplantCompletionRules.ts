import { CONSULTATION_FORM_OPTION_SETS } from "../consultationFormOptionSets";
import { HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import {
  canonicalHairTransplantDiagnosisBody,
  canonicalHairTransplantDurationKey,
  canonicalHairTransplantGraftBounds,
  canonicalHairTransplantNorwoodKey,
  canonicalHairTransplantRecommendedPlanText,
  canonicalHairTransplantRiskFlagValues,
  canonicalHairTransplantTreatmentValues,
} from "../normalize/hairTransplantConsultationNormalize";
import type {
  ConsultationCompletionInput,
  ConsultationCompletionSummary,
  ConsultationOutcomeType,
  ConsultationSuitabilityStatus,
} from "./consultationCompletionTypes";
import {
  CONSULTATION_OUTCOME_TYPES,
  CONSULTATION_SUITABILITY_STATUSES,
} from "./consultationCompletionTypes";
import {
  buildClinicianNotesPreview,
  extractBodyAreaMapHighlights,
  labelForOptionValue,
  readBoolean,
  readString,
} from "./consultationCompletionExtractors";

function parseOutcome(raw: unknown): ConsultationOutcomeType {
  const s = readString(raw).trim() as ConsultationOutcomeType;
  return (CONSULTATION_OUTCOME_TYPES as readonly string[]).includes(s) ? s : "undecided";
}

function parseSuitability(raw: unknown): ConsultationSuitabilityStatus {
  const s = readString(raw).trim() as ConsultationSuitabilityStatus;
  return (CONSULTATION_SUITABILITY_STATUSES as readonly string[]).includes(s) ? s : "not_assessed";
}

function emptySummaryBase(input: ConsultationCompletionInput): Omit<ConsultationCompletionSummary, "outcomeType"> & {
  outcomeType: ConsultationOutcomeType;
} {
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

function buildDiagnosisImpressionText(values: Record<string, unknown>): string {
  const nwKey = canonicalHairTransplantNorwoodKey(values);
  const nwLine = nwKey
    ? `Pattern: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.norwood_scale, nwKey)}.`
    : "";

  const durKey = canonicalHairTransplantDurationKey(values);
  const durLine = durKey
    ? `Duration: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.consultation_duration_band, durKey) || durKey}.`
    : "";

  const body = canonicalHairTransplantDiagnosisBody(values);

  const parts = [nwLine, durLine, body].map((s) => s.trim()).filter(Boolean);
  return parts.join("\n\n").trim();
}

/**
 * Rules-based completion summary for the Hair Transplant Consultation template (`hair-transplant-consultation`).
 * Dual-reads legacy 16-section instances and ConsultationOS v2 adaptive pathway values.
 */
export function buildHairTransplantCompletionSummary(input: ConsultationCompletionInput): ConsultationCompletionSummary {
  const v = input.values ?? {};
  const base = emptySummaryBase(input);

  if (input.templateSlug.trim() !== HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG) {
    return { ...base, clinicianNotesPreview: buildClinicianNotesPreview(v) };
  }

  const outcomeType = parseOutcome(v.consultation_outcome_type);

  const primaryFocus = readString(v.priority_focus);
  const primaryConcern = labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.consultation_priority, primaryFocus);

  const diagnosisImpression = buildDiagnosisImpressionText(v);

  const surgicalSuitability = parseSuitability(v.surgical_suitability);
  const medicalSuitability = parseSuitability(v.medical_suitability);

  const recommendedProcedure = canonicalHairTransplantRecommendedPlanText(v);

  const { min: estimatedGraftsMin, max: estimatedGraftsMax } = canonicalHairTransplantGraftBounds(v);

  const zones = Array.isArray(v.recommended_zones) ? (v.recommended_zones as unknown[]).map((x) => String(x).trim()).filter(Boolean) : [];

  const treatments = canonicalHairTransplantTreatmentValues(v);

  const riskFlags = canonicalHairTransplantRiskFlagValues(v);

  const pathologyExplicit = readBoolean(v.pathology_recommended_explicit);
  const pathologyFromRiskFlags =
    riskFlags.includes("medical_review_required") || riskFlags.includes("blood_tests_recommended");
  const pathologyFromOutcome = outcomeType === "needs_blood_tests";
  const pathologyFromFlags = pathologyFromRiskFlags || pathologyFromOutcome;
  const pathologyRecommended = pathologyExplicit || pathologyFromFlags;

  let pathologyReason = readString(v.pathology_reason).trim();
  if (pathologyRecommended && !pathologyReason) {
    if (pathologyFromRiskFlags) pathologyReason = "Discussed / flagged on consultation form.";
    else if (pathologyFromOutcome) pathologyReason = "Outcome set to needs blood tests.";
    else pathologyReason = "Clinician indicated pathology / screening.";
  }

  const quoteNotes = readString(v.quote_notes_completion).trim();

  const urgency = readString(v.follow_up_urgency);
  const followUpExplicit = readBoolean(v.follow_up_required_explicit);
  const followUpFromUrgency = urgency === "soon" || urgency === "urgent" || urgency === "asap";
  const followUpRequired = followUpExplicit || followUpFromUrgency;

  let followUpReason = readString(v.follow_up_completion_reason).trim();
  if (!followUpReason) followUpReason = readString(v.follow_up_tasks_notes).trim();
  if (followUpRequired && !followUpReason && followUpFromUrgency) {
    followUpReason = `Follow-up suggested (urgency: ${urgency}).`;
  }

  const areaMapHighlights = extractBodyAreaMapHighlights(v.concern_map);

  const clinicianNotesPreview = buildClinicianNotesPreview(v);

  return {
    ...base,
    outcomeType,
    primaryConcern,
    diagnosisImpression,
    surgicalSuitability,
    medicalSuitability,
    recommendedProcedure,
    estimatedGraftsMin,
    estimatedGraftsMax,
    recommendedZones: zones,
    recommendedTreatments: treatments,
    pathologyRecommended,
    pathologyReason,
    quoteNotes,
    followUpRequired,
    followUpReason,
    riskFlags,
    areaMapHighlights,
    clinicianNotesPreview,
  };
}
