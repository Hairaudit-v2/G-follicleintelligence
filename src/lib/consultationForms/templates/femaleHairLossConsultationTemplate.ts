import type { ConsultationFormField, ConsultationFormOption, ConsultationFormSchema } from "../consultationFormTypes";

function fld(field: ConsultationFormField): ConsultationFormField {
  return field;
}

/** Ludwig when pattern is consistent with female-pattern hair loss assessment. */
export const FEMALE_HAIR_LOSS_LUDWIG_TRIGGER_PATTERNS = [
  "diffuse",
  "part_widening",
  "frontal_hairline",
  "temporal_thinning",
  "mixed",
] as const;

/** Sinclair for diffuse thinning or mid-part widening (shedding / density grading). */
export const FEMALE_HAIR_LOSS_SINCLAIR_TRIGGER_PATTERNS = ["diffuse", "part_widening"] as const;

const FEMALE_PATHWAY_RECOMMENDED_TREATMENT_OPTIONS: ConsultationFormOption[] = [
  { value: "finasteride", label: "Finasteride / dutasteride (where appropriate)" },
  { value: "oral_minoxidil", label: "Oral minoxidil" },
  { value: "topical_minoxidil", label: "Topical minoxidil" },
  { value: "prp", label: "PRP" },
  { value: "exosomes", label: "Exosomes / biologics" },
  { value: "mesotherapy", label: "Mesotherapy" },
  { value: "laser_lllt", label: "Low-level laser / light therapy" },
  { value: "nutraceuticals", label: "Nutraceuticals / adjuncts (e.g. iron if indicated)" },
  { value: "scalp_therapy", label: "Dedicated scalp therapy / trichology" },
];

/**
 * ConsultationOS v2 pathway 3 — Female hair loss (adaptive, non-surgical).
 * Distinct from male HT and from generic HLI: female-specific language, pattern set, and hormonal screen.
 */
export const femaleHairLossConsultationSchemaV1: ConsultationFormSchema = {
  schemaRevision: 2,
  sections: [
    {
      id: "rapid_intake",
      title: "Rapid Intake",
      description: "Priorities and context — target under five minutes for a focused female hair-loss visit.",
      fields: [
        fld({
          id: "priority_focus",
          label: "Primary focus today",
          type: "select",
          optionSet: "female_priority_focus",
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
          optionSet: "female_primary_objective",
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
          id: "postpartum_status",
          label: "Postpartum context (if relevant)",
          type: "select",
          optionSet: "postpartum_status",
          required: true,
        }),
        fld({
          id: "previous_treatment_yes_no",
          label: "Previous treatment for hair loss (any modality)?",
          type: "select",
          optionSet: "yes_no",
          required: true,
        }),
      ],
    },
    {
      id: "female_pattern_scalp",
      title: "Female Pattern & Scalp Assessment",
      fields: [
        fld({
          id: "female_pattern_type",
          label: "Pattern type (female-context)",
          type: "select",
          optionSet: "female_hair_loss_pattern_type",
          required: true,
        }),
        fld({
          id: "ludwig_classification",
          label: "Ludwig classification (female-pattern density)",
          type: "visual_ludwig",
          optionSet: "ludwig_scale",
          showWhen: {
            fieldId: "female_pattern_type",
            operator: "in",
            value: [...FEMALE_HAIR_LOSS_LUDWIG_TRIGGER_PATTERNS],
          },
        }),
        fld({
          id: "sinclair_classification",
          label: "Sinclair classification (diffuse / part-related shedding grade)",
          type: "select",
          optionSet: "sinclair_scale",
          showWhen: {
            fieldId: "female_pattern_type",
            operator: "in",
            value: [...FEMALE_HAIR_LOSS_SINCLAIR_TRIGGER_PATTERNS],
          },
        }),
        fld({
          id: "selected_zones",
          label: "Scalp zones — clinical involvement (visual)",
          type: "visual_scalp_zones",
          optionSet: "consultation_scalp_zones",
          description: "Optional structured zone capture for female-pattern mapping.",
        }),
        fld({
          id: "traction_pattern_present",
          label: "Traction pattern suspected or present?",
          type: "boolean",
        }),
        fld({
          id: "scalp_condition",
          label: "Scalp condition",
          type: "select",
          optionSet: "scalp_condition",
          required: true,
        }),
        fld({
          id: "hair_calibre",
          label: "Hair calibre",
          type: "select",
          optionSet: "hair_calibre",
          required: true,
        }),
        fld({
          id: "miniaturisation_clinical",
          label: "Clinical impression of miniaturisation",
          type: "select",
          optionSet: "yes_no_unsure",
        }),
      ],
    },
    {
      id: "hormonal_medical_screening",
      title: "Hormonal / Medical Screening",
      fields: [
        fld({
          id: "hormonal_flags",
          label: "Hormonal & reproductive context (select all that apply)",
          type: "multi_select",
          optionSet: "female_hormonal_flags",
        }),
        fld({
          id: "medical_flags",
          label: "Medical / systemic flags (select all that apply)",
          type: "multi_select",
          optionSet: "medical_risk_flags",
        }),
        fld({
          id: "medication_tolerance",
          label: "Tolerance to prior / current hair-related medications",
          type: "select",
          optionSet: "medication_tolerance",
        }),
        fld({
          id: "ferritin_history_known",
          label: "Ferritin / iron history (known status)",
          type: "select",
          optionSet: "ferritin_history_known",
          required: true,
        }),
        fld({
          id: "thyroid_history_known",
          label: "Thyroid history (known status)",
          type: "select",
          optionSet: "thyroid_history_known",
          required: true,
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
          id: "blood_analysis_recommended",
          label: "Blood analysis / lab panel recommended",
          type: "boolean",
        }),
        fld({
          id: "recommended_treatments",
          label: "Recommended treatments (structured)",
          type: "multi_select",
          options: FEMALE_PATHWAY_RECOMMENDED_TREATMENT_OPTIONS,
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
          id: "ai_recommended_plan_summary",
          label: "AI-recommended plan summary (draft — clinician editable)",
          type: "textarea",
          placeholder: "Short narrative for chart, HLI, and Patient Twin handoff.",
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

export const femaleHairLossConsultationSchema = femaleHairLossConsultationSchemaV1;
