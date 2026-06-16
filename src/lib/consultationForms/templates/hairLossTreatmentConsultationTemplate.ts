import type { ConsultationFormField, ConsultationFormOption, ConsultationFormSchema } from "../consultationFormTypes";

function fld(field: ConsultationFormField): ConsultationFormField {
  return field;
}

const HLI_RECOMMENDED_TREATMENT_OPTIONS: ConsultationFormOption[] = [
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

/** Completion outcomes for non-surgical pathway (no transplant planning). */
const HLI_COMPLETION_OUTCOME_OPTIONS: ConsultationFormOption[] = [
  { value: "proceed_prp", label: "Proceed — PRP / regenerative" },
  { value: "proceed_exosomes", label: "Proceed — exosomes / biologics" },
  { value: "medical_management", label: "Medical management focus" },
  { value: "needs_blood_tests", label: "Needs blood tests / screening first" },
  { value: "not_suitable", label: "Not suitable for in-clinic plan today" },
  { value: "review_later", label: "Review later / defer decision" },
  { value: "undecided", label: "Undecided / exploratory" },
];

const MALE_PATTERN_NORWOOD_TRIGGERS = ["hairline", "crown"] as const;

const LUDWIG_TRIGGERS = ["female_pattern"] as const;

const SINCLAIR_TRIGGERS = ["diffuse", "female_pattern"] as const;

/**
 * ConsultationOS v2 pathway 2 — Hair Loss Treatment / Hair Longevity (non-surgical).
 * Separate from Hair Transplant v2: no donor, grafts, quotes, or surgical suitability.
 */
export const hairLossTreatmentConsultationSchemaV1: ConsultationFormSchema = {
  schemaRevision: 2,
  sections: [
    {
      id: "rapid_intake",
      title: "Rapid Intake",
      description: "Triage priorities and context — designed for sub-five-minute completion.",
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
          label: "Approximate duration of concern",
          type: "select",
          optionSet: "consultation_duration_band",
          required: true,
        }),
        fld({
          id: "primary_objective",
          label: "Primary objective",
          type: "select",
          optionSet: "hli_primary_objective",
          required: true,
        }),
        fld({
          id: "shedding_reported",
          label: "Patient-reported shedding",
          type: "select",
          optionSet: "shedding_severity",
          required: true,
        }),
        fld({
          id: "previous_treatment_yes_no",
          label: "Previous non-surgical treatment for hair loss?",
          type: "select",
          optionSet: "yes_no",
          required: true,
        }),
        fld({
          id: "current_medications_summary",
          label: "Current medications & supplements (summary)",
          type: "textarea",
          placeholder: "e.g. finasteride 1mg, minoxidil foam, oral contraceptive…",
        }),
      ],
    },
    {
      id: "hair_loss_pattern",
      title: "Hair Loss Pattern",
      fields: [
        fld({
          id: "pattern_type",
          label: "Pattern type",
          type: "select",
          optionSet: "hair_loss_pattern_type",
          required: true,
        }),
        fld({
          id: "norwood_classification",
          label: "Norwood classification (male-pattern zones)",
          type: "visual_norwood",
          optionSet: "norwood_scale",
          showWhen: { fieldId: "pattern_type", operator: "in", value: [...MALE_PATTERN_NORWOOD_TRIGGERS] },
        }),
        fld({
          id: "ludwig_classification",
          label: "Ludwig classification",
          type: "visual_ludwig",
          optionSet: "ludwig_scale",
          showWhen: { fieldId: "pattern_type", operator: "in", value: [...LUDWIG_TRIGGERS] },
        }),
        fld({
          id: "sinclair_classification",
          label: "Sinclair classification (diffuse / female shedding)",
          type: "select",
          optionSet: "sinclair_scale",
          showWhen: { fieldId: "pattern_type", operator: "in", value: [...SINCLAIR_TRIGGERS] },
        }),
        fld({
          id: "selected_zones",
          label: "Scalp zones — clinical involvement (visual)",
          type: "visual_scalp_zones",
          optionSet: "consultation_scalp_zones",
          description: "Optional structured zone capture alongside pattern typing.",
        }),
        fld({
          id: "miniaturisation_clinical",
          label: "Clinical impression of miniaturisation",
          type: "select",
          optionSet: "yes_no_unsure",
        }),
        fld({
          id: "hair_calibre",
          label: "Hair calibre",
          type: "select",
          optionSet: "hair_calibre",
          required: true,
        }),
        fld({
          id: "scalp_condition",
          label: "Scalp condition",
          type: "select",
          optionSet: "scalp_condition",
          required: true,
        }),
      ],
    },
    {
      id: "medical_lifestyle_screening",
      title: "Medical / Lifestyle Screening",
      fields: [
        fld({
          id: "medical_flags",
          label: "Medical / lifestyle flags (select all that apply)",
          type: "multi_select",
          optionSet: "medical_risk_flags",
        }),
        fld({
          id: "hormonal_flags",
          label: "Hormonal context (select all that apply)",
          type: "multi_select",
          optionSet: "hli_hormonal_flags",
        }),
        fld({
          id: "stress_sleep_flags",
          label: "Stress & sleep (select all that apply)",
          type: "multi_select",
          optionSet: "hli_stress_sleep_flags",
        }),
        fld({
          id: "nutrition_flags",
          label: "Nutrition & systemic factors (select all that apply)",
          type: "multi_select",
          optionSet: "hli_nutrition_flags",
        }),
        fld({
          id: "medication_tolerance",
          label: "Tolerance to prior / current hair medications",
          type: "select",
          optionSet: "medication_tolerance",
        }),
        fld({
          id: "pathology_recommended_explicit",
          label: "Recommend pathology / blood screening",
          type: "boolean",
        }),
        fld({
          id: "pathology_reason",
          label: "Pathology / screening reason",
          type: "textarea",
          showWhen: { fieldId: "pathology_recommended_explicit", operator: "equals", value: true },
          required: true,
        }),
      ],
    },
    {
      id: "treatment_recommendation",
      title: "Treatment Recommendation",
      fields: [
        fld({
          id: "recommended_treatments",
          label: "Recommended treatments (structured)",
          type: "multi_select",
          options: HLI_RECOMMENDED_TREATMENT_OPTIONS,
          required: true,
        }),
        fld({
          id: "blood_analysis_recommended",
          label: "Blood analysis / lab panel recommended",
          type: "boolean",
        }),
        fld({
          id: "treatment_priority",
          label: "Treatment sequencing priority",
          type: "select",
          optionSet: "hli_treatment_priority",
          required: true,
        }),
        fld({
          id: "treatment_timeline",
          label: "Treatment timeline",
          type: "select",
          optionSet: "hli_treatment_timeline",
          required: true,
        }),
        fld({
          id: "hli_pathway_recommended",
          label: "HLI / Patient Twin pathway recommended",
          type: "select",
          optionSet: "hli_pathway_recommended",
          required: true,
        }),
        fld({
          id: "consultation_outcome_type",
          label: "Consultation outcome (completion)",
          type: "select",
          options: HLI_COMPLETION_OUTCOME_OPTIONS,
          required: true,
        }),
        fld({
          id: "ai_recommended_plan_summary",
          label: "AI-recommended plan summary (draft — clinician editable)",
          type: "textarea",
          placeholder: "Short narrative for chart + Patient Twin handoff.",
        }),
      ],
    },
    {
      id: "clinical_summary_handoff",
      title: "Clinical Summary / Handoff",
      fields: [
        fld({
          id: "structured_clinical_note",
          label: "Structured clinical note (canonical)",
          type: "clinical_note",
          required: true,
        }),
        fld({
          id: "clinician_voice_note",
          label: "Clinician dictation (voice / text)",
          type: "voice_note",
          description: "Optional adjunct; use “Save to clinical notes” when persisting to DoctorOS.",
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

export const hairLossTreatmentConsultationSchema = hairLossTreatmentConsultationSchemaV1;
