import { SCALP_PATHOLOGY_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
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

const SYMPTOM_TYPE_LABELS: { value: string; label: string }[] = [
  { value: "inflammatory_dermatitis", label: "Inflammatory scalp dermatitis" },
  { value: "psoriasis_scalp", label: "Scalp psoriasis" },
  { value: "seborrheic", label: "Seborrhoeic / eczematous pattern" },
  { value: "alopecia_areata", label: "Patchy alopecia areata–type pattern" },
  { value: "scarring_suspicion", label: "Suspected scarring / cicatricial alopecia" },
  { value: "infectious_suspicion", label: "Suspected infectious folliculitis / tinea" },
  { value: "mixed_unexplained", label: "Mixed or unexplained presentation" },
];

const DURATION_LABELS: { value: string; label: string }[] = [
  { value: "lt3m", label: "< 3 months" },
  { value: "3_12m", label: "3–12 months" },
  { value: "1_3y", label: "1–3 years" },
  { value: "3y_plus", label: "3+ years" },
  { value: "lifelong", label: "Lifelong / since adolescence" },
];

const AUTOIMMUNE_FLAG_LABELS: { value: string; label: string }[] = [
  { value: "lupus_discoid_suspected", label: "Discoid / cutaneous lupus suspected" },
  { value: "thyroid_autoimmune", label: "Thyroid autoimmune history / symptoms" },
  { value: "other_connective_tissue", label: "Other connective-tissue disease context" },
  { value: "none_documented", label: "None documented today" },
];

const INFECTION_FLAG_LABELS: { value: string; label: string }[] = [
  { value: "purulent_discharge", label: "Purulent discharge / abscess concern" },
  { value: "tinea_exposure", label: "Tinea / close-contact or animal exposure" },
  { value: "immunosuppression", label: "Immunosuppression / diabetes / systemic risk" },
  { value: "post_procedure_wound", label: "Recent procedure or wound on scalp" },
  { value: "none_documented", label: "No additional infection risk flags" },
];

const TREATMENT_LABELS: { value: string; label: string }[] = [
  { value: "topical_corticosteroid", label: "Topical corticosteroid (class per protocol)" },
  { value: "topical_calcineurin", label: "Topical calcineurin inhibitor" },
  { value: "topical_antifungal", label: "Topical antifungal" },
  { value: "systemic_antifungal", label: "Systemic antifungal (dermatology-led)" },
  { value: "oral_antibiotic", label: "Oral antibiotic (if bacterial folliculitis suspected)" },
  { value: "intralesional_steroid", label: "Intralesional corticosteroid" },
  { value: "minoxidil_adjunct", label: "Minoxidil adjunct (non-primary diagnosis)" },
  { value: "phototherapy_referral", label: "Phototherapy — discuss / refer" },
  { value: "scalp_care_education", label: "Scalp care & trigger education" },
  { value: "shared_care_dermatology", label: "Shared care with dermatology" },
];

const URGENCY_LABELS: { value: string; label: string }[] = [
  { value: "routine", label: "Routine" },
  { value: "priority", label: "Priority" },
  { value: "urgent", label: "Urgent" },
];

function optLabel(opts: { value: string; label: string }[], key: string): string {
  return opts.find((o) => o.value === key)?.label ?? key;
}

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function parseOutcome(v: Record<string, unknown>): ConsultationOutcomeType {
  const urgent = readBoolean(v.urgent_dermatology_referral);
  const biopsy = readBoolean(v.biopsy_recommended);
  const blood = readBoolean(v.blood_analysis_recommended);
  const pathologyExplicit = readBoolean(v.pathology_recommended_explicit);
  if (urgent) return "review_later";
  if (biopsy || blood || pathologyExplicit) return "needs_blood_tests";
  const raw = readString(v.consultation_outcome_type).trim();
  const s = raw as ConsultationOutcomeType;
  if (raw && (CONSULTATION_OUTCOME_TYPES as readonly string[]).includes(s)) return s;
  return "medical_management";
}

function emptyBase(input: ConsultationCompletionInput): ConsultationCompletionSummary {
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
 * Rules-based completion summary for {@link SCALP_PATHOLOGY_CONSULTATION_TEMPLATE_SLUG}.
 */
export function buildScalpPathologyCompletionSummary(
  input: ConsultationCompletionInput
): ConsultationCompletionSummary {
  const v = input.values ?? {};
  const base = emptyBase(input);

  if (input.templateSlug.trim() !== SCALP_PATHOLOGY_CONSULTATION_TEMPLATE_SLUG) {
    return { ...base, clinicianNotesPreview: buildClinicianNotesPreview(v) };
  }

  const symptomKey = readString(v.scalp_symptom_type).trim();
  const symptomLabel = optLabel(SYMPTOM_TYPE_LABELS, symptomKey);
  const durationKey = readString(v.symptom_duration_band).trim();
  const durationLabel = optLabel(DURATION_LABELS, durationKey);

  const itch = readBoolean(v.itching_present);
  const pain = readBoolean(v.pain_or_tenderness_present);
  const scale = readBoolean(v.scaling_or_flaking_present);
  const patchy = readBoolean(v.patchy_loss_present);

  const erythema = readBoolean(v.erythema_present);
  const pustules = readBoolean(v.pustules_or_crusting_present);
  const scarSuspect = readBoolean(v.scarring_suspicion);

  const autoimmuneKeys = readStringArray(v.autoimmune_flags);
  const infectionKeys = readStringArray(v.infection_risk_flags);
  const autoimmuneLabels = autoimmuneKeys
    .map((k) => optLabel(AUTOIMMUNE_FLAG_LABELS, k))
    .filter(Boolean);
  const infectionLabels = infectionKeys
    .map((k) => optLabel(INFECTION_FLAG_LABELS, k))
    .filter(Boolean);

  const biopsy = readBoolean(v.biopsy_recommended);
  const blood = readBoolean(v.blood_analysis_recommended);
  const pathologyExplicit = readBoolean(v.pathology_recommended_explicit);
  const urgentDerm = readBoolean(v.urgent_dermatology_referral);
  const pathologyReasonText = readString(v.pathology_reason).trim();

  const treatKeys = readStringArray(v.recommended_treatments);
  const treatLabels = treatKeys.map((k) => optLabel(TREATMENT_LABELS, k)).filter(Boolean);

  const aiPlan = readString(v.ai_recommended_plan_summary).trim();

  const outcomeType = parseOutcome(v as Record<string, unknown>);

  const pathologyRecommended = pathologyExplicit || biopsy || blood || urgentDerm;
  let pathologyReason = pathologyReasonText;
  if (pathologyRecommended && !pathologyReason) {
    const parts: string[] = [];
    if (pathologyExplicit) parts.push("Clinician flagged histopathology / lab pathway.");
    if (biopsy) parts.push("Scalp biopsy recommended.");
    if (blood) parts.push("Blood / serology recommended.");
    if (urgentDerm) parts.push("Urgent dermatology referral.");
    pathologyReason = parts.join(" ");
  }

  const primaryConcern = [symptomLabel, durationLabel ? `Duration: ${durationLabel}` : ""]
    .filter(Boolean)
    .join(" · ");

  const diagnosisImpression = [
    `Symptoms: itch ${itch ? "yes" : "no"}, pain ${pain ? "yes" : "no"}, scaling ${scale ? "yes" : "no"}, patchy loss ${patchy ? "yes" : "no"}.`,
    `Exam: erythema ${erythema ? "yes" : "no"}, pustules/crusting ${pustules ? "yes" : "no"}, scarring suspicion ${scarSuspect ? "yes" : "no"}.`,
    autoimmuneLabels.length ? `Autoimmune flags: ${autoimmuneLabels.join(", ")}.` : "",
    infectionLabels.length ? `Infection risk: ${infectionLabels.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const recommendedProcedure =
    aiPlan ||
    [
      symptomLabel ? `Pattern: ${symptomLabel}.` : "",
      treatLabels.length ? `Plan elements: ${treatLabels.join(", ")}.` : "",
      urgentDerm ? "Urgent dermatology referral documented." : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Scalp disorder / pathology consultation documented — see structured note.";

  const urgencyKey = readString(v.follow_up_urgency).trim();
  const followUpUrgencyLabel = optLabel(URGENCY_LABELS, urgencyKey);

  const followUpExplicit = readBoolean(v.follow_up_required_explicit);
  const followUpFromUrgency = urgencyKey === "priority" || urgencyKey === "urgent";
  const followUpRequired = followUpExplicit || followUpFromUrgency || urgentDerm;

  let followUpReason = "";
  if (urgentDerm) followUpReason = "Urgent dermatology referral indicated.";
  else if (followUpRequired && followUpFromUrgency && !followUpExplicit) {
    followUpReason = `Follow-up suggested (urgency: ${followUpUrgencyLabel || urgencyKey}).`;
  }

  const riskParts: string[] = [];
  if (autoimmuneKeys.some((k) => k && k !== "none_documented"))
    riskParts.push("Autoimmune context flagged.");
  if (infectionKeys.some((k) => k && k !== "none_documented"))
    riskParts.push("Infection risk flagged.");
  if (scarSuspect) riskParts.push("Scarring alopecia suspected.");

  const investigationsLine = [
    biopsy ? "Biopsy recommended." : "",
    blood ? "Blood / serology recommended." : "",
    pathologyExplicit ? "Histopathology / lab pathway explicitly recommended." : "",
    urgentDerm ? "Urgent dermatology referral." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const symptomsLine = [
    symptomLabel,
    durationLabel ? `Duration ${durationLabel}` : "",
    `Itch ${itch ? "yes" : "no"}; scaling ${scale ? "yes" : "no"}; patchy loss ${patchy ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const findingsLine = [
    `Erythema ${erythema ? "yes" : "no"}`,
    `Pustules/crusting ${pustules ? "yes" : "no"}`,
    `Scarring suspicion ${scarSuspect ? "yes" : "no"}`,
  ].join(" · ");

  const scarringAutoimmuneRiskLine = [
    scarSuspect ? "Scarring alopecia suspected on exam." : "No scarring suspicion documented.",
    autoimmuneLabels.filter((l) => !/none documented/i.test(l)).join("; ") ||
      "No autoimmune flags beyond 'none'.",
  ].join(" ");

  const treatmentPlanLine = [
    treatLabels.length ? treatLabels.join(", ") : "No draft treatments selected.",
    aiPlan ? `AI draft: ${aiPlan}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const clinicianNotesPreview = buildClinicianNotesPreview(v);

  return {
    ...base,
    outcomeType,
    primaryConcern,
    diagnosisImpression,
    medicalSuitability: urgentDerm
      ? "needs_review"
      : scarSuspect
        ? "suitable_with_caution"
        : "suitable",
    recommendedProcedure,
    recommendedTreatments: treatLabels,
    pathologyRecommended,
    pathologyReason,
    followUpRequired,
    followUpReason,
    riskFlags: riskParts,
    bloodAnalysisRecommended: blood,
    clinicianNotesPreview,
    scalpPathologyCompletionSnapshot: {
      symptomsLine,
      findingsLine,
      scarringAutoimmuneRiskLine,
      investigationsLine: investigationsLine || "No investigations explicitly flagged.",
      treatmentPlanLine,
      followUpUrgencyLabel,
      urgencyContextLine: urgentDerm
        ? "Urgent dermatology referral set to yes."
        : "Urgent dermatology referral not indicated.",
    },
  };
}
