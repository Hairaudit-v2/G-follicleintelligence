import type { ConsultationFormField, ConsultationFormOption, ConsultationFormSchema } from "../consultationFormTypes";

function fld(field: ConsultationFormField): ConsultationFormField {
  return field;
}

const REPAIR_PRIOR_SURGERY_COUNT: ConsultationFormOption[] = [
  { value: "1", label: "One prior procedure" },
  { value: "2", label: "Two prior procedures" },
  { value: "3_plus", label: "Three or more prior procedures" },
];

const REPAIR_PRIOR_SURGERY_YEAR: ConsultationFormOption[] = [
  { value: "unknown", label: "Unknown / mixed years" },
  { value: "2025_2026", label: "2025–2026" },
  { value: "2023_2024", label: "2023–2024" },
  { value: "2021_2022", label: "2021–2022" },
  { value: "2019_2020", label: "2019–2020" },
  { value: "2017_2018", label: "2017–2018" },
  { value: "2015_2016", label: "2015–2016" },
  { value: "pre_2015", label: "2014 or earlier" },
];

const REPAIR_PRIMARY_CONCERN: ConsultationFormOption[] = [
  { value: "poor_density", label: "Poor density / failed yield" },
  { value: "donor_scar", label: "Donor scar (wide / symptomatic)" },
  { value: "recipient_scarring", label: "Recipient scarring / cobblestoning" },
  { value: "hairline_design", label: "Hairline design / position / symmetry" },
  { value: "pluggy_unnatural", label: "Pluggy / unnatural graft appearance" },
  { value: "donor_depletion", label: "Donor depletion / limited reserve" },
  { value: "overharvesting", label: "Overharvesting / transection concern" },
  { value: "mixed", label: "Mixed / multifactorial" },
  { value: "other", label: "Other (document in note)" },
];

const REPAIR_RISK_LEVEL: ConsultationFormOption[] = [
  { value: "none", label: "None / not applicable" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "unknown", label: "Unknown / not assessed" },
];

const REPAIR_CORRECTIVE_OPTIONS: ConsultationFormOption[] = [
  { value: "fue_focal_repair", label: "Focal FUE / revision grafting" },
  { value: "strip_scar_revision", label: "Strip scar revision / trichophytic closure" },
  { value: "recipient_recontouring", label: "Recipient zone recontouring / excision planning" },
  { value: "smp_camouflage", label: "SMP / cosmetic camouflage" },
  { value: "medical_stabilisation", label: "Medical stabilisation before further surgery" },
  { value: "second_opinion", label: "Second opinion / defer intervention" },
  { value: "no_further_surgery", label: "Counselled — no further surgery advised in this setting" },
  { value: "other", label: "Other (see narrative)" },
];

/** Outcome values align with {@link CONSULTATION_OUTCOME_TYPES} for completion + handoff contracts. */
const REPAIR_COMPLETION_OUTCOME: ConsultationFormOption[] = [
  { value: "proceed_surgery", label: "Proceed — corrective / revision surgery pathway" },
  { value: "medical_management", label: "Medical management / stabilisation first" },
  { value: "needs_blood_tests", label: "Investigations / labs before committing" },
  { value: "review_later", label: "Defer / review later" },
  { value: "not_suitable", label: "Not suitable for further surgery here" },
  { value: "undecided", label: "Undecided / exploratory" },
];

/**
 * ConsultationOS v2 pathway 4 — Hair transplant repair / revision intake.
 * Standalone structure (not HT with hidden fields): prior surgery audit, donor/recipient risk, counselling emphasis.
 */
export const hairTransplantRepairConsultationSchemaV1: ConsultationFormSchema = {
  schemaRevision: 1,
  sections: [
    {
      id: "rapid_intake",
      title: "Rapid Intake",
      description: "Triage and documentation emphasis — target under five minutes.",
      fields: [
        fld({
          id: "priority_focus",
          label: "Primary focus today",
          type: "select",
          optionSet: "consultation_priority",
          required: true,
        }),
        fld({
          id: "duration_band",
          label: "Time since primary concern began",
          type: "select",
          optionSet: "consultation_duration_band",
          required: true,
        }),
        fld({
          id: "medicolegal_counselling_documented",
          label: "Limitations, expectations, and prior outcome context discussed (medico-legal / counselling emphasis)",
          type: "boolean",
          required: true,
        }),
      ],
    },
    {
      id: "previous_surgery_history",
      title: "Previous Surgery History",
      description: "Prior transplant context — who, when, and how many procedures.",
      fields: [
        fld({
          id: "previous_surgery_count",
          label: "Number of prior hair transplant procedures",
          type: "select",
          options: REPAIR_PRIOR_SURGERY_COUNT,
          required: true,
        }),
        fld({
          id: "prior_clinic_known",
          label: "Prior clinic / surgeon identity known to patient",
          type: "select",
          optionSet: "yes_no_unsure",
          required: true,
        }),
        fld({
          id: "prior_clinic_name",
          label: "Prior clinic or surgeon (if known)",
          type: "text",
          placeholder: "Optional — name only; no defamatory language in chart",
          showWhen: { fieldId: "prior_clinic_known", operator: "equals", value: "yes" },
        }),
        fld({
          id: "prior_surgery_year",
          label: "Approximate era of most recent relevant surgery",
          type: "select",
          options: REPAIR_PRIOR_SURGERY_YEAR,
          required: true,
        }),
      ],
    },
    {
      id: "repair_assessment",
      title: "Repair Assessment",
      description: "Prior surgery quality, scarring, design, growth, and donor safety.",
      fields: [
        fld({
          id: "primary_repair_concern",
          label: "Primary repair concern",
          type: "select",
          options: REPAIR_PRIMARY_CONCERN,
          required: true,
        }),
        fld({
          id: "donor_depletion_level",
          label: "Donor depletion / reserve concern",
          type: "select",
          options: REPAIR_RISK_LEVEL,
          required: true,
        }),
        fld({
          id: "donor_scarring_level",
          label: "Donor scarring (clinical)",
          type: "select",
          options: REPAIR_RISK_LEVEL,
          required: true,
        }),
        fld({
          id: "recipient_scarring_level",
          label: "Recipient scarring / skin changes",
          type: "select",
          options: REPAIR_RISK_LEVEL,
          required: true,
        }),
        fld({
          id: "hairline_design_issue",
          label: "Hairline design issue suspected",
          type: "select",
          optionSet: "yes_no_unsure",
          required: true,
        }),
        fld({
          id: "growth_failure_suspected",
          label: "Growth failure / poor yield suspected",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "pluggy_or_unnatural_grafts",
          label: "Pluggy or unnatural graft appearance",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "transection_or_overharvesting_concern",
          label: "Transection or overharvesting concern (donor trauma)",
          type: "boolean",
          required: true,
        }),
      ],
    },
    {
      id: "corrective_recommendation",
      title: "Corrective Recommendation",
      description: "Structured options and HairAudit / SurgeryOS routing — no graft quote builder.",
      fields: [
        fld({
          id: "corrective_options",
          label: "Corrective options discussed (select all that apply)",
          type: "multi_select",
          options: REPAIR_CORRECTIVE_OPTIONS,
          required: true,
        }),
        fld({
          id: "hairaudit_baseline_recommended",
          label: "HairAudit baseline documentation recommended",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "surgeryos_planning_recommended",
          label: "SurgeryOS corrective planning recommended",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "corrective_surgical_planning_selected",
          label: "Detailed corrective surgical planning documented in this visit",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "corrective_planning_notes",
          label: "Corrective planning notes (clinical — not a quote)",
          type: "textarea",
          placeholder: "Only when documenting detailed planning (zones, principles, staging). No pricing.",
          showWhen: { fieldId: "corrective_surgical_planning_selected", operator: "equals", value: true },
          required: true,
        }),
        fld({
          id: "ai_recommended_plan_summary",
          label: "AI-recommended plan summary (draft — clinician editable)",
          type: "textarea",
          placeholder: "Short narrative for chart, HairAudit, and SurgeryOS handoff.",
        }),
      ],
    },
    {
      id: "clinical_summary_handoff",
      title: "Clinical Summary / Handoff",
      fields: [
        fld({
          id: "repair_completion_outcome",
          label: "Consultation outcome (completion)",
          type: "select",
          options: REPAIR_COMPLETION_OUTCOME,
          required: true,
        }),
        fld({
          id: "structured_clinical_note",
          label: "Structured clinical note (canonical)",
          type: "clinical_note",
          required: true,
        }),
        fld({
          id: "follow_up_required_explicit",
          label: "Follow-up required (explicit)",
          type: "boolean",
        }),
        fld({
          id: "follow_up_urgency",
          label: "Follow-up timeline urgency",
          type: "select",
          optionSet: "urgency",
          required: true,
        }),
      ],
    },
  ],
};

export const hairTransplantRepairConsultationSchema = hairTransplantRepairConsultationSchemaV1;
