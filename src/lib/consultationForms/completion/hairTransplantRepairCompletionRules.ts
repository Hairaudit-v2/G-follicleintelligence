import { HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
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
import { CONSULTATION_FORM_OPTION_SETS } from "../consultationFormOptionSets";

function parseOutcome(raw: unknown): ConsultationOutcomeType {
  const s = readString(raw).trim() as ConsultationOutcomeType;
  return (CONSULTATION_OUTCOME_TYPES as readonly string[]).includes(s) ? s : "undecided";
}

function optionLabel(options: { value: string; label: string }[], key: string): string {
  const row = options.find((o) => o.value === key);
  return row?.label ?? key;
}

const PRIOR_COUNT_OPTS = [
  { value: "1", label: "One prior procedure" },
  { value: "2", label: "Two prior procedures" },
  { value: "3_plus", label: "Three or more prior procedures" },
];

const YEAR_OPTS = [
  { value: "unknown", label: "Unknown / mixed years" },
  { value: "2025_2026", label: "2025–2026" },
  { value: "2023_2024", label: "2023–2024" },
  { value: "2021_2022", label: "2021–2022" },
  { value: "2019_2020", label: "2019–2020" },
  { value: "2017_2018", label: "2017–2018" },
  { value: "2015_2016", label: "2015–2016" },
  { value: "pre_2015", label: "2014 or earlier" },
];

const PRIMARY_CONCERN_OPTS = [
  { value: "poor_density", label: "Poor density / failed yield" },
  { value: "donor_scar", label: "Donor scar (wide / symptomatic)" },
  { value: "recipient_scarring", label: "Recipient scarring / cobblestoning" },
  { value: "hairline_design", label: "Hairline design / position / symmetry" },
  { value: "pluggy_unnatural", label: "Pluggy / unnatural graft appearance" },
  { value: "donor_depletion", label: "Donor depletion / limited reserve" },
  { value: "overharvesting", label: "Overharvesting / transection concern" },
  { value: "mixed", label: "Mixed / multifactorial" },
  { value: "other", label: "Other" },
];

const RISK_LEVEL_OPTS = [
  { value: "none", label: "None / not applicable" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "unknown", label: "Unknown / not assessed" },
];

const CORRECTIVE_OPTS = [
  { value: "fue_focal_repair", label: "Focal FUE / revision grafting" },
  { value: "strip_scar_revision", label: "Strip scar revision / trichophytic closure" },
  { value: "recipient_recontouring", label: "Recipient zone recontouring / excision planning" },
  { value: "smp_camouflage", label: "SMP / cosmetic camouflage" },
  { value: "medical_stabilisation", label: "Medical stabilisation before further surgery" },
  { value: "second_opinion", label: "Second opinion / defer intervention" },
  { value: "no_further_surgery", label: "Counselled — no further surgery advised in this setting" },
  { value: "other", label: "Other" },
];

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function emptyRepairBase(input: ConsultationCompletionInput): ConsultationCompletionSummary {
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

function buildPriorHistoryLine(values: Record<string, unknown>): string {
  const cnt = readString(values.previous_surgery_count).trim();
  const known = readString(values.prior_clinic_known).trim();
  const yr = readString(values.prior_surgery_year).trim();
  const clinic = readString(values.prior_clinic_name).trim();
  const parts = [
    cnt ? `Prior procedures: ${optionLabel(PRIOR_COUNT_OPTS, cnt)}` : "",
    yr ? `Era: ${optionLabel(YEAR_OPTS, yr)}` : "",
    known
      ? `Clinic known: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.yes_no_unsure, known) ?? known}`
      : "",
    clinic ? `Named prior provider/clinic: ${clinic}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

function buildDonorRecipientRiskLine(values: Record<string, unknown>): string {
  const dd = readString(values.donor_depletion_level).trim();
  const ds = readString(values.donor_scarring_level).trim();
  const rs = readString(values.recipient_scarring_level).trim();
  return [
    dd ? `Donor depletion: ${optionLabel(RISK_LEVEL_OPTS, dd)}` : "",
    ds ? `Donor scar burden: ${optionLabel(RISK_LEVEL_OPTS, ds)}` : "",
    rs ? `Recipient scarring: ${optionLabel(RISK_LEVEL_OPTS, rs)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildDiagnosisImpression(values: Record<string, unknown>): string {
  const counselling = readBoolean(values.medicolegal_counselling_documented);
  const lines: string[] = [];
  lines.push(
    counselling
      ? "Medico-legal / expectation counselling documented on form."
      : "Medico-legal / expectation counselling not marked as documented."
  );
  const hl = readString(values.hairline_design_issue).trim();
  if (hl) {
    lines.push(
      `Hairline design flag: ${labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.yes_no_unsure, hl) ?? hl}.`
    );
  }
  const flags: string[] = [];
  if (readBoolean(values.growth_failure_suspected)) flags.push("growth yield concern");
  if (readBoolean(values.pluggy_or_unnatural_grafts)) flags.push("pluggy / unnatural grafts");
  if (readBoolean(values.transection_or_overharvesting_concern))
    flags.push("transection / overharvesting concern");
  if (flags.length) lines.push(`Clinical flags: ${flags.join(", ")}.`);
  return lines.join("\n").trim();
}

function buildRiskFlagValues(values: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (readBoolean(values.growth_failure_suspected)) out.push("growth_failure_suspected");
  if (readBoolean(values.pluggy_or_unnatural_grafts)) out.push("pluggy_or_unnatural_grafts");
  if (readBoolean(values.transection_or_overharvesting_concern))
    out.push("transection_or_overharvesting_concern");
  const dd = readString(values.donor_depletion_level).trim();
  if (dd === "moderate" || dd === "severe") out.push("donor_depletion_elevated");
  const ds = readString(values.donor_scarring_level).trim();
  if (ds === "moderate" || ds === "severe") out.push("donor_scarring_elevated");
  const rs = readString(values.recipient_scarring_level).trim();
  if (rs === "moderate" || rs === "severe") out.push("recipient_scarring_elevated");
  return out;
}

function correctiveOptionLabels(keys: string[]): string[] {
  return keys.map((k) => optionLabel(CORRECTIVE_OPTS, k)).filter(Boolean);
}

/**
 * Rules-based completion summary for {@link HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG}.
 */
export function buildHairTransplantRepairCompletionSummary(
  input: ConsultationCompletionInput
): ConsultationCompletionSummary {
  const v = input.values ?? {};
  const base = emptyRepairBase(input);

  if (input.templateSlug.trim() !== HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG) {
    return { ...base, clinicianNotesPreview: buildClinicianNotesPreview(v) };
  }

  const outcomeType = parseOutcome(v.repair_completion_outcome);

  const primaryFocus = readString(v.priority_focus);
  const primaryConcern = labelForOptionValue(
    CONSULTATION_FORM_OPTION_SETS.consultation_priority,
    primaryFocus
  );

  const concernKey = readString(v.primary_repair_concern).trim();
  const mainRepairConcernLabel = optionLabel(PRIMARY_CONCERN_OPTS, concernKey) || concernKey;

  const priorSurgeryHistoryLine = buildPriorHistoryLine(v);
  const donorRecipientRiskLine = buildDonorRecipientRiskLine(v);
  const diagnosisImpression = buildDiagnosisImpression(v);

  const coKeys = readStringArray(v.corrective_options);
  const correctiveOptionsLabels = correctiveOptionLabels(coKeys);

  const hairauditRecommended = readBoolean(v.hairaudit_baseline_recommended);
  const surgeryosPlanningRecommended = readBoolean(v.surgeryos_planning_recommended);

  const ai = readString(v.ai_recommended_plan_summary).trim();
  const planNarrative = [correctiveOptionsLabels.join("; "), ai]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const recommendedProcedure = planNarrative || "Repair options discussed — see structured note.";

  const urgency = readString(v.follow_up_urgency);
  const followUpExplicit = readBoolean(v.follow_up_required_explicit);
  const followUpFromUrgency = urgency === "soon" || urgency === "urgent" || urgency === "asap";
  const followUpRequired = followUpExplicit || followUpFromUrgency;

  let followUpReason = "";
  if (followUpRequired && followUpFromUrgency && !followUpExplicit) {
    followUpReason = `Follow-up suggested (urgency: ${urgency}).`;
  }

  const pathologyRecommended = outcomeType === "needs_blood_tests";
  const pathologyReason = pathologyRecommended
    ? "Investigations / labs indicated before committing to a surgical plan."
    : "";

  const followUpUrgencyLabel =
    labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.urgency, urgency) || urgency;

  const riskFlags = buildRiskFlagValues(v);

  const clinicianNotesPreview = buildClinicianNotesPreview(v);

  return {
    ...base,
    outcomeType,
    primaryConcern,
    diagnosisImpression,
    recommendedProcedure,
    surgicalSuitability:
      outcomeType === "proceed_surgery" ? "suitable_with_caution" : "not_assessed",
    medicalSuitability: outcomeType === "medical_management" ? "suitable" : "not_assessed",
    pathologyRecommended,
    pathologyReason,
    followUpRequired,
    followUpReason,
    riskFlags,
    clinicianNotesPreview,
    repairConsultationCompletionSnapshot: {
      priorSurgeryHistoryLine,
      mainRepairConcernLabel,
      donorRecipientRiskLine,
      correctiveOptionsLabels,
      hairauditRecommended,
      surgeryosPlanningRecommended,
      followUpUrgencyLabel,
    },
  };
}
