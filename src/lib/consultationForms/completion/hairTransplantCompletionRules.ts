import { CONSULTATION_FORM_OPTION_SETS } from "../consultationFormOptionSets";
import { HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import type {
  ConsultationCompletionAreaMapHighlight,
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
  mergeUniqueStrings,
  parseGraftRangeText,
  readBoolean,
  readNumber,
  readString,
  readStringArray,
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

/**
 * Rules-based completion summary for the Hair Transplant Consultation template (`hair-transplant-consultation`).
 * Tolerant of missing fields; deterministic only.
 */
export function buildHairTransplantCompletionSummary(input: ConsultationCompletionInput): ConsultationCompletionSummary {
  const v = input.values ?? {};
  const base = emptySummaryBase(input);

  if (input.templateSlug.trim() !== HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG) {
    return { ...base, clinicianNotesPreview: buildClinicianNotesPreview(v) };
  }

  const explicitOutcome = parseOutcome(v.consultation_outcome_type);
  const outcomeType: ConsultationOutcomeType = explicitOutcome !== "undecided" ? explicitOutcome : "undecided";

  const primaryFocus = readString(v.priority_focus);
  const primaryConcern = labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.consultation_priority, primaryFocus);

  const diagnosisImpression = readString(v.diagnosis_free_text);

  const surgicalSuitability = parseSuitability(v.surgical_suitability);
  const medicalSuitability = parseSuitability(v.medical_suitability);

  const recommendedProcedure = readString(v.recommended_plan_summary).trim();

  let estimatedGraftsMin = readNumber(v.completion_estimated_grafts_min);
  let estimatedGraftsMax = readNumber(v.completion_estimated_grafts_max);
  if (estimatedGraftsMin == null && estimatedGraftsMax == null) {
    const parsed = parseGraftRangeText(readString(v.graft_range_estimate));
    if (parsed) {
      estimatedGraftsMin = parsed.min;
      estimatedGraftsMax = parsed.max;
    }
  }

  const zones = readStringArray(v.recommended_zones);
  let treatments = readStringArray(v.recommended_treatments);
  if (treatments.length === 0) {
    treatments = readStringArray(v.treatment_interest);
  }

  const medicalFlags = readStringArray(v.medical_flags);
  const riskConfirmed = readStringArray(v.risk_flags_confirmed);
  const riskFlags = mergeUniqueStrings(medicalFlags, riskConfirmed);

  const pathologyExplicit = readBoolean(v.pathology_recommended_explicit);
  const pathologyFromFlags =
    riskFlags.includes("medical_review_required") ||
    riskFlags.includes("blood_tests_recommended") ||
    medicalFlags.includes("medical_review_required") ||
    medicalFlags.includes("blood_tests_recommended");
  const pathologyRecommended =
    pathologyExplicit || pathologyFromFlags || outcomeType === "needs_blood_tests";

  let pathologyReason = readString(v.pathology_reason).trim();
  if (pathologyRecommended && !pathologyReason) {
    if (pathologyFromFlags) pathologyReason = "Discussed / flagged on consultation form.";
    else if (outcomeType === "needs_blood_tests") pathologyReason = "Outcome set to needs blood tests.";
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

  const areaMapHighlights: ConsultationCompletionAreaMapHighlight[] = extractBodyAreaMapHighlights(v.concern_map);

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
