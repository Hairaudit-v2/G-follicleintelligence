import type {
  ConsultationFormField,
  ConsultationFormOption,
  ConsultationFormSchema,
} from "../consultationFormTypes";

function fld(field: ConsultationFormField): ConsultationFormField {
  return field;
}

const REVIEW_TYPE_OPTIONS: ConsultationFormOption[] = [
  { value: "post_treatment_review", label: "Post-treatment review" },
  { value: "post_prp_review", label: "Post-PRP review" },
  { value: "post_exosome_review", label: "Post-exosome review" },
  { value: "medication_review", label: "Medication review" },
  { value: "post_surgery_review", label: "Post-surgery review" },
  { value: "long_term_progress_review", label: "Long-term progress review" },
  { value: "annual_review", label: "Annual review" },
];

const TIME_SINCE_LAST_REVIEW_OPTIONS: ConsultationFormOption[] = [
  { value: "1_month", label: "~1 month" },
  { value: "3_month", label: "~3 months" },
  { value: "6_month", label: "~6 months" },
  { value: "12_month", label: "~12 months" },
  { value: "24_month_plus", label: "24+ months" },
];

const TREATMENT_COMPLIANCE_OPTIONS: ConsultationFormOption[] = [
  { value: "fully_compliant", label: "Fully compliant" },
  { value: "partially_compliant", label: "Partially compliant" },
  { value: "poor_compliance", label: "Poor compliance" },
  { value: "discontinued", label: "Discontinued" },
];

const PERCEIVED_IMPROVEMENT_OPTIONS: ConsultationFormOption[] = [
  { value: "significant_improvement", label: "Significant improvement" },
  { value: "moderate_improvement", label: "Moderate improvement" },
  { value: "minimal_improvement", label: "Minimal improvement" },
  { value: "no_change", label: "No change" },
  { value: "worsening", label: "Worsening" },
];

const DENSITY_CHANGES_OPTIONS: ConsultationFormOption[] = [
  { value: "improved", label: "Improved" },
  { value: "stable", label: "Stable" },
  { value: "reduced", label: "Reduced" },
  { value: "worsening", label: "Worsening" },
];

const SHEDDING_CHANGES_OPTIONS: ConsultationFormOption[] = [
  { value: "improved", label: "Improved" },
  { value: "unchanged", label: "Unchanged" },
  { value: "worse", label: "Worse" },
  { value: "fluctuating", label: "Fluctuating" },
];

const CLINICAL_PROGRESSION_OPTIONS: ConsultationFormOption[] = [
  { value: "progressing_well", label: "Progressing well" },
  { value: "stable", label: "Stable" },
  { value: "treatment_failing", label: "Treatment failing" },
  { value: "surgery_candidate_now", label: "Surgery candidate now" },
  { value: "further_investigation_needed", label: "Further investigation needed" },
];

const UPDATED_RECOMMENDED_TREATMENTS: ConsultationFormOption[] = [
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

const FOLLOW_UP_URGENCY_REVIEW_OPTIONS: ConsultationFormOption[] = [
  { value: "routine", label: "Routine" },
  { value: "priority", label: "Priority" },
  { value: "urgent", label: "Urgent" },
];

const NEXT_PATHWAY_RECOMMENDED_OPTIONS: ConsultationFormOption[] = [
  { value: "continue_current_protocol", label: "Continue current protocol" },
  { value: "move_to_hli", label: "Move to HLI / medical pathway" },
  { value: "move_to_hair_transplant_consult", label: "Move to hair transplant consult" },
  { value: "move_to_repair_consult", label: "Move to repair consult" },
  { value: "request_blood_analysis", label: "Request blood analysis" },
  { value: "surgery_planning", label: "Surgery planning (SurgeryOS)" },
];

/**
 * ConsultationOS v2 pathway 5 — Follow-up / Review (longitudinal intelligence; no quote, graft, donor, or surgical planning fields).
 */
export const followUpReviewConsultationSchemaV1: ConsultationFormSchema = {
  schemaRevision: 1,
  sections: [
    {
      id: "review_context",
      title: "Review Context",
      description: "Why today, interval since last touchpoint, and adherence — under ~3 minutes.",
      fields: [
        fld({
          id: "review_type",
          label: "Review type",
          type: "select",
          options: REVIEW_TYPE_OPTIONS,
          required: true,
        }),
        fld({
          id: "time_since_last_review",
          label: "Time since last structured review",
          type: "select",
          options: TIME_SINCE_LAST_REVIEW_OPTIONS,
          required: true,
        }),
        fld({
          id: "current_primary_concern",
          label: "Current primary concern (brief)",
          type: "textarea",
          placeholder: "What changed since last visit?",
          required: true,
        }),
        fld({
          id: "treatment_compliance",
          label: "Treatment compliance",
          type: "select",
          options: TREATMENT_COMPLIANCE_OPTIONS,
          required: true,
        }),
      ],
    },
    {
      id: "progress_assessment",
      title: "Progress Assessment",
      fields: [
        fld({
          id: "perceived_improvement",
          label: "Perceived improvement (patient + clinician)",
          type: "select",
          options: PERCEIVED_IMPROVEMENT_OPTIONS,
          required: true,
        }),
        fld({
          id: "shedding_changes",
          label: "Shedding vs last review",
          type: "select",
          options: SHEDDING_CHANGES_OPTIONS,
          required: true,
        }),
        fld({
          id: "density_changes",
          label: "Density / volume vs last review",
          type: "select",
          options: DENSITY_CHANGES_OPTIONS,
          required: true,
        }),
        fld({
          id: "patient_satisfaction",
          label: "Patient satisfaction (1–10)",
          type: "number",
          min: 1,
          max: 10,
          step: 1,
          required: true,
        }),
        fld({
          id: "side_effects_present",
          label: "Side effects / tolerability issues present",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "side_effects_notes",
          label: "Side effects / tolerability notes",
          type: "textarea",
          showWhen: { fieldId: "side_effects_present", operator: "equals", value: true },
          required: true,
        }),
      ],
    },
    {
      id: "outcome_intelligence",
      title: "Outcome Intelligence",
      description:
        "Feeds Patient Twin, HairAudit progression hooks, HLI response tracking, and AnalyticsOS (placeholders in completion summary until wired).",
      fields: [
        fld({
          id: "clinical_progression_assessment",
          label: "Clinical progression assessment",
          type: "select",
          options: CLINICAL_PROGRESSION_OPTIONS,
          required: true,
        }),
        fld({
          id: "hairaudit_progression_capture",
          label: "HairAudit progression capture recommended",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "updated_photos_captured",
          label: "Updated clinical photos captured this visit",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "treatment_modification_required",
          label: "Treatment modification required",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "updated_recommended_treatments",
          label: "Updated recommended treatments (if any change)",
          type: "multi_select",
          options: UPDATED_RECOMMENDED_TREATMENTS,
        }),
        fld({
          id: "ai_progress_summary",
          label: "AI progress summary (draft — clinician editable)",
          type: "textarea",
          placeholder: "Short longitudinal narrative for Twin / HairAudit / HLI handoff.",
        }),
      ],
    },
    {
      id: "clinical_summary_next_action",
      title: "Clinical Summary / Next Action",
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
          label: "Follow-up urgency",
          type: "select",
          options: FOLLOW_UP_URGENCY_REVIEW_OPTIONS,
          required: true,
        }),
        fld({
          id: "next_pathway_recommended",
          label: "Next pathway recommended",
          type: "select",
          options: NEXT_PATHWAY_RECOMMENDED_OPTIONS,
          required: true,
        }),
      ],
    },
  ],
};

export const followUpReviewConsultationSchema = followUpReviewConsultationSchemaV1;
