import type { ConsultationFormField, ConsultationFormOption, ConsultationFormSchema } from "../consultationFormTypes";

function fld(field: ConsultationFormField): ConsultationFormField {
  return field;
}

const COMPLETION_SUITABILITY_OPTIONS: ConsultationFormOption[] = [
  { value: "suitable", label: "Suitable" },
  { value: "suitable_with_caution", label: "Suitable with caution" },
  { value: "not_suitable", label: "Not suitable" },
  { value: "needs_review", label: "Needs further review" },
  { value: "not_assessed", label: "Not assessed" },
];

const COMPLETION_OUTCOME_OPTIONS: ConsultationFormOption[] = [
  { value: "proceed_surgery", label: "Proceed — surgery planning" },
  { value: "proceed_prp", label: "Proceed — PRP / regenerative" },
  { value: "proceed_exosomes", label: "Proceed — exosomes / biologics" },
  { value: "medical_management", label: "Medical management focus" },
  { value: "needs_blood_tests", label: "Needs blood tests / screening first" },
  { value: "not_suitable", label: "Not suitable for procedure today" },
  { value: "review_later", label: "Review later / defer decision" },
  { value: "undecided", label: "Undecided / exploratory" },
];

/** Exported for deterministic clinical draft / labels outside the template module. */
export const HAIR_TRANSPLANT_V2_RECOMMENDED_ZONE_OPTIONS: ConsultationFormOption[] = [
  { value: "hairline", label: "Hairline" },
  { value: "temples", label: "Temples" },
  { value: "midscalp", label: "Mid-scalp / top" },
  { value: "crown", label: "Crown / vertex" },
  { value: "donor", label: "Donor optimisation" },
];

/** Exported for deterministic clinical draft / labels outside the template module. */
export const HAIR_TRANSPLANT_V2_RECOMMENDED_TREATMENT_OPTIONS: ConsultationFormOption[] = [
  { value: "finasteride", label: "Finasteride / dutasteride" },
  { value: "oral_minoxidil", label: "Oral minoxidil" },
  { value: "topical_minoxidil", label: "Topical minoxidil" },
  { value: "prp", label: "PRP" },
  { value: "exosomes", label: "Exosomes / biologics" },
  { value: "surgery_fu", label: "Surgery (FUE / FUT)" },
  { value: "mesotherapy", label: "Mesotherapy" },
];

const RECOMMENDED_ZONE_OPTIONS = HAIR_TRANSPLANT_V2_RECOMMENDED_ZONE_OPTIONS;
const RECOMMENDED_TREATMENT_OPTIONS = HAIR_TRANSPLANT_V2_RECOMMENDED_TREATMENT_OPTIONS;

/** Primary objectives that open the surgical assessment pathway (donor / recipient / map). */
export const HAIR_TRANSPLANT_V2_SURGICAL_PRIMARY_OBJECTIVES = ["ht_primary", "ht_plus_medical", "repair_revision"] as const;

/**
 * Immutable published JSON schema for Hair Transplant Consultation **version 1** (16 sections).
 * Do not change this object — new edits belong in {@link hairTransplantConsultationSchemaV2}.
 */
export const hairTransplantConsultationSchemaV1: ConsultationFormSchema = {
  schemaRevision: 2,
  sections: [
    {
      id: "presenting_concern",
      title: "1. Presenting Concern",
      fields: [
        fld({
          id: "priority_focus",
          label: "Primary focus today",
          type: "select",
          optionSet: "consultation_priority",
          required: true,
        }),
        fld({
          id: "duration_months",
          label: "Approximate duration of concern",
          type: "select",
          options: [
            { value: "lt3m", label: "< 3 months" },
            { value: "3_12m", label: "3–12 months" },
            { value: "1_3y", label: "1–3 years" },
            { value: "3y_plus", label: "3+ years" },
            { value: "lifelong", label: "Lifelong / since adolescence" },
          ],
          required: true,
        }),
        fld({
          id: "patient_goals_free_text",
          label: "Patient goals (free text)",
          type: "textarea",
          placeholder: "What outcome matters most to the patient?",
        }),
      ],
    },
    {
      id: "hair_loss_history",
      title: "2. Hair Loss History",
      fields: [
        fld({
          id: "onset_pattern",
          label: "Onset / progression pattern",
          type: "select",
          optionSet: "hair_loss_onset_pattern",
          required: true,
        }),
        fld({
          id: "norwood_classification",
          label: "Norwood scale (male-pattern / vertex context)",
          type: "select",
          optionSet: "norwood_scale",
        }),
        fld({
          id: "ludwig_classification",
          label: "Ludwig scale (female-pattern context)",
          type: "select",
          optionSet: "ludwig_scale",
        }),
        fld({
          id: "sinclair_classification",
          label: "Sinclair scale (female shedding context)",
          type: "select",
          optionSet: "sinclair_scale",
        }),
        fld({
          id: "shedding_reported",
          label: "Patient-reported shedding",
          type: "select",
          optionSet: "shedding_severity",
        }),
      ],
    },
    {
      id: "medical_medication",
      title: "3. Medical / Medication History",
      fields: [
        fld({
          id: "medical_flags",
          label: "Medical / lifestyle flags (select all that apply)",
          type: "multi_select",
          optionSet: "medical_risk_flags",
        }),
        fld({
          id: "medication_tolerance",
          label: "Tolerance to prior / current hair medications",
          type: "select",
          optionSet: "medication_tolerance",
        }),
        fld({
          id: "medical_notes",
          label: "Relevant medical notes",
          type: "textarea",
          placeholder: "Allergies, surgeries, dermatology history…",
        }),
      ],
    },
    {
      id: "family_history",
      title: "4. Family History",
      fields: [
        fld({
          id: "family_pattern",
          label: "Family pattern of hair loss",
          type: "select",
          optionSet: "family_history_pattern",
          required: true,
        }),
        fld({
          id: "family_notes",
          label: "Additional family context",
          type: "textarea",
        }),
      ],
    },
    {
      id: "previous_treatments",
      title: "5. Previous Treatments",
      fields: [
        fld({
          id: "prior_treatments",
          label: "Treatments tried (select all that apply)",
          type: "multi_select",
          optionSet: "previous_treatment_types",
        }),
        fld({
          id: "prior_ht_year",
          label: "Year of prior hair transplant",
          type: "text",
          placeholder: "e.g. 2019",
          showWhen: { fieldId: "prior_treatments", operator: "containsAny", value: ["ht_prior"] },
        }),
        fld({
          id: "prior_treatment_response",
          label: "Response / satisfaction with prior treatments",
          type: "textarea",
        }),
      ],
    },
    {
      id: "scalp_hair_assessment",
      title: "6. Scalp / Hair Assessment",
      fields: [
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
      id: "donor_assessment",
      title: "7. Donor Assessment",
      fields: [
        fld({
          id: "donor_quality",
          label: "Donor quality",
          type: "select",
          optionSet: "donor_quality",
          required: true,
        }),
        fld({
          id: "donor_density_estimate",
          label: "Estimated grafts/cm² (optional)",
          type: "number",
          min: 0,
          max: 200,
          step: 1,
        }),
        fld({
          id: "donor_notes",
          label: "Donor zone notes",
          type: "textarea",
        }),
      ],
    },
    {
      id: "area_of_concern_map",
      title: "8. Area of Concern Map",
      fields: [
        fld({
          id: "concern_map",
          label: "Body / scalp area map",
          type: "body_area_map",
          description:
            "Mark the patient's key areas of concern and planned treatment zones. Tap a wireframe to drop markers, then edit label, severity, and tags.",
          bodyAreaMapViews: ["frontal_hairline", "top_scalp", "crown", "donor_back"],
        }),
      ],
    },
    {
      id: "photos_media",
      title: "9. Photos / Media",
      fields: [
        fld({
          id: "clinical_photos",
          label: "Clinical photos",
          type: "image_upload",
          description: "Upload flow will integrate with fi_patient_images in a later stage.",
        }),
      ],
    },
    {
      id: "diagnosis_impression",
      title: "10. Diagnosis Impression",
      fields: [
        fld({
          id: "diagnosis_picker",
          label: "Structured diagnosis",
          type: "diagnosis_picker",
        }),
        fld({
          id: "diagnosis_norwood_confirm",
          label: "Working Norwood / pattern class",
          type: "select",
          optionSet: "norwood_scale",
        }),
        fld({
          id: "diagnosis_free_text",
          label: "Clinical impression (free text)",
          type: "textarea",
          required: true,
        }),
        fld({
          id: "diagnosis_clinical_note",
          label: "Diagnosis / pattern — structured clinician note",
          type: "clinical_note",
          description: "Structured impressions stored on this form instance.",
        }),
      ],
    },
    {
      id: "treatment_suitability",
      title: "11. Treatment Suitability",
      fields: [
        fld({
          id: "treatment_interest",
          label: "Procedures / modalities of interest",
          type: "multi_select",
          optionSet: "treatment_interest",
          required: true,
        }),
        fld({
          id: "surgical_outcome_type",
          label: "Desired surgical outcome emphasis",
          type: "select",
          optionSet: "surgical_outcome_type",
        }),
      ],
    },
    {
      id: "recommended_plan",
      title: "12. Recommended Plan",
      fields: [
        fld({
          id: "treatment_recommendation_block",
          label: "Treatment recommendation",
          type: "treatment_recommendation",
        }),
        fld({
          id: "recommended_plan_summary",
          label: "Plan summary (free text)",
          type: "textarea",
          required: true,
        }),
        fld({
          id: "consultation_outcome_type",
          label: "Consultation outcome (completion)",
          type: "select",
          options: COMPLETION_OUTCOME_OPTIONS,
          description: "Used for rules-based completion summary (Stage 4). Defaults to undecided if not set.",
        }),
        fld({
          id: "surgical_suitability",
          label: "Surgical suitability",
          type: "select",
          options: COMPLETION_SUITABILITY_OPTIONS,
        }),
        fld({
          id: "medical_suitability",
          label: "Medical suitability",
          type: "select",
          options: COMPLETION_SUITABILITY_OPTIONS,
        }),
        fld({
          id: "recommended_zones",
          label: "Recommended treatment zones",
          type: "multi_select",
          options: RECOMMENDED_ZONE_OPTIONS,
        }),
        fld({
          id: "recommended_treatments",
          label: "Recommended treatments (structured)",
          type: "multi_select",
          options: RECOMMENDED_TREATMENT_OPTIONS,
        }),
      ],
    },
    {
      id: "quote_procedure_planning",
      title: "13. Quote / Procedure Planning",
      fields: [
        fld({
          id: "quote_builder",
          label: "Quote builder",
          type: "quote_builder",
        }),
        fld({
          id: "budget_range",
          label: "Budget range discussed",
          type: "select",
          optionSet: "budget_range",
        }),
        fld({
          id: "graft_range_estimate",
          label: "Estimated graft range (optional)",
          type: "text",
          placeholder: "e.g. 2000–2800",
        }),
        fld({
          id: "completion_estimated_grafts_min",
          label: "Estimated grafts (min) — completion",
          type: "number",
          min: 0,
          max: 12000,
          step: 50,
        }),
        fld({
          id: "completion_estimated_grafts_max",
          label: "Estimated grafts (max) — completion",
          type: "number",
          min: 0,
          max: 12000,
          step: 50,
        }),
        fld({
          id: "quote_notes_completion",
          label: "Quote / package notes (completion)",
          type: "textarea",
          placeholder: "Notes to carry into quoting or treatment planning…",
        }),
      ],
    },
    {
      id: "risks_contraindications",
      title: "14. Risks / Contraindications",
      fields: [
        fld({
          id: "risk_flags_confirmed",
          label: "Risks / flags discussed (select all that apply)",
          type: "multi_select",
          optionSet: "medical_risk_flags",
        }),
        fld({
          id: "pathology_recommended_explicit",
          label: "Recommend pathology / blood screening",
          type: "boolean",
          description: "Explicit clinician toggle for completion summary (in addition to risk flags).",
        }),
        fld({
          id: "pathology_reason",
          label: "Pathology / screening reason (optional)",
          type: "textarea",
        }),
        fld({
          id: "contraindications_notes",
          label: "Contraindications / counselling notes",
          type: "textarea",
          required: true,
        }),
      ],
    },
    {
      id: "follow_up_tasks",
      title: "15. Follow-Up Tasks",
      fields: [
        fld({
          id: "follow_up_urgency",
          label: "Timeline urgency",
          type: "select",
          optionSet: "urgency",
          required: true,
        }),
        fld({
          id: "follow_up_required_explicit",
          label: "Follow-up required (explicit)",
          type: "boolean",
        }),
        fld({
          id: "follow_up_completion_reason",
          label: "Follow-up reason (completion)",
          type: "textarea",
        }),
        fld({
          id: "follow_up_tasks_notes",
          label: "Tasks / investigations to arrange",
          type: "textarea",
        }),
      ],
    },
    {
      id: "clinician_notes",
      title: "16. Clinician Notes",
      fields: [
        fld({
          id: "structured_clinical_note",
          label: "Structured clinical note",
          type: "clinical_note",
        }),
        fld({
          id: "clinician_voice_note",
          label: "Clinician dictation (voice / text)",
          type: "voice_note",
          description:
            "Capture in-room dictation or typing. Use “Save to clinical notes” to attach this transcript to DoctorOS clinical notes.",
        }),
        fld({
          id: "final_clinician_comments",
          label: "Final clinician comments",
          type: "textarea",
        }),
      ],
    },
  ],
};

/**
 * ConsultationOS v2 — Hair Transplant adaptive pathway (≤6 sections, clinic-fast).
 * Quote builder, duplicate Norwood / risk checklists, and follow-up task lists live outside this form.
 */
export const hairTransplantConsultationSchemaV2: ConsultationFormSchema = {
  schemaRevision: 3,
  sections: [
    {
      id: "rapid_intake",
      title: "Rapid Intake",
      description: "Triage what matters today — under five minutes from here to handoff when familiar.",
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
          optionSet: "consultation_primary_objective",
          required: true,
          description: "Drives whether surgical planning fields appear.",
        }),
        fld({
          id: "previous_treatment_yes_no",
          label: "Previous non-surgical treatment for hair loss?",
          type: "select",
          optionSet: "yes_no",
          required: true,
        }),
        fld({
          id: "previous_surgery_yes_no",
          label: "Previous hair transplant surgery?",
          type: "select",
          optionSet: "yes_no",
          required: true,
        }),
      ],
    },
    {
      id: "clinical_pattern",
      title: "Clinical Pattern",
      fields: [
        fld({
          id: "onset_pattern",
          label: "Onset / progression pattern",
          type: "select",
          optionSet: "hair_loss_onset_pattern",
          required: true,
        }),
        fld({
          id: "norwood_classification",
          label: "Norwood / pattern classification",
          type: "select",
          optionSet: "norwood_scale",
          required: true,
          description: "Single canonical Norwood capture for this consultation (replaces duplicate confirm fields).",
        }),
        fld({
          id: "shedding_reported",
          label: "Patient-reported shedding",
          type: "select",
          optionSet: "shedding_severity",
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
      id: "medical_screening",
      title: "Medical Screening",
      fields: [
        fld({
          id: "medical_flags",
          label: "Medical / lifestyle flags (select all that apply)",
          type: "multi_select",
          optionSet: "medical_risk_flags",
          description: "Single checklist — do not duplicate into a second “risk confirmed” list.",
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
        fld({
          id: "medical_exception_note",
          label: "Medical exception / nuance (optional)",
          type: "textarea",
          placeholder: "Short caveat only — detailed tasks move to LeadFlow.",
        }),
        fld({
          id: "risks_discussed_confirmed",
          label: "Key risks and limitations discussed with the patient",
          type: "boolean",
          description: "Medicolegal acknowledgement without re-capturing the full flag list.",
        }),
      ],
    },
    {
      id: "surgical_assessment",
      title: "Surgical Assessment",
      description: "Shown when the primary objective includes transplant or repair planning.",
      showWhen: {
        fieldId: "primary_objective",
        operator: "in",
        value: [...HAIR_TRANSPLANT_V2_SURGICAL_PRIMARY_OBJECTIVES],
      },
      fields: [
        fld({
          id: "donor_quality",
          label: "Donor quality",
          type: "select",
          optionSet: "donor_quality",
          required: true,
        }),
        fld({
          id: "donor_density_estimate",
          label: "Estimated grafts/cm² (optional)",
          type: "number",
          min: 0,
          max: 200,
          step: 1,
        }),
        fld({
          id: "recipient_quality",
          label: "Recipient / midscalp skin quality",
          type: "select",
          optionSet: "recipient_area_quality",
          required: true,
        }),
        fld({
          id: "concern_map",
          label: "Concern / zone map",
          type: "body_area_map",
          description: "Mark priority zones; recommended zones can be edited independently in the next step.",
          bodyAreaMapViews: ["frontal_hairline", "top_scalp", "crown", "donor_back"],
        }),
        fld({
          id: "prior_ht_year",
          label: "Year of prior hair transplant",
          type: "text",
          placeholder: "e.g. 2019",
          showWhen: { fieldId: "previous_surgery_yes_no", operator: "equals", value: "yes" },
        }),
      ],
    },
    {
      id: "recommendation",
      title: "Recommendation",
      fields: [
        fld({
          id: "recommended_treatments",
          label: "Recommended treatments (structured)",
          type: "multi_select",
          options: RECOMMENDED_TREATMENT_OPTIONS,
          required: true,
        }),
        fld({
          id: "recommended_zones",
          label: "Recommended treatment zones",
          type: "multi_select",
          options: RECOMMENDED_ZONE_OPTIONS,
          description: "Pre-filled in future builds from the concern map; always editable here.",
        }),
        fld({
          id: "consultation_outcome_type",
          label: "Consultation outcome (completion)",
          type: "select",
          options: COMPLETION_OUTCOME_OPTIONS,
          required: true,
        }),
        fld({
          id: "medical_suitability",
          label: "Medical suitability",
          type: "select",
          options: COMPLETION_SUITABILITY_OPTIONS,
          required: true,
        }),
        fld({
          id: "surgical_suitability",
          label: "Surgical suitability",
          type: "select",
          options: COMPLETION_SUITABILITY_OPTIONS,
          required: true,
        }),
        fld({
          id: "ai_recommended_plan_summary",
          label: "Plan summary (AI draft — clinician editable)",
          type: "textarea",
          placeholder: "Short narrative plan for the chart. AI-generated content will land here later.",
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
          description: "Single primary note for this encounter. Replaces scattered diagnosis / final comment fields.",
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

/** Alias: current Hair Transplant Consultation schema used for new published template versions. */
export const hairTransplantConsultationSchema = hairTransplantConsultationSchemaV2;
