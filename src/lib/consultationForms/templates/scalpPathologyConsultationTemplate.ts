import type {
  ConsultationFormField,
  ConsultationFormOption,
  ConsultationFormSchema,
} from "../consultationFormTypes";

function fld(field: ConsultationFormField): ConsultationFormField {
  return field;
}

const SCALP_SYMPTOM_TYPE_OPTIONS: ConsultationFormOption[] = [
  { value: "inflammatory_dermatitis", label: "Inflammatory scalp dermatitis" },
  { value: "psoriasis_scalp", label: "Scalp psoriasis" },
  { value: "seborrheic", label: "Seborrhoeic / eczematous pattern" },
  { value: "alopecia_areata", label: "Patchy alopecia areata–type pattern" },
  { value: "scarring_suspicion", label: "Suspected scarring / cicatricial alopecia" },
  { value: "infectious_suspicion", label: "Suspected infectious folliculitis / tinea" },
  { value: "mixed_unexplained", label: "Mixed or unexplained presentation" },
];

const AUTOIMMUNE_FLAGS_OPTIONS: ConsultationFormOption[] = [
  { value: "lupus_discoid_suspected", label: "Discoid / cutaneous lupus suspected" },
  { value: "thyroid_autoimmune", label: "Thyroid autoimmune history / symptoms" },
  { value: "other_connective_tissue", label: "Other connective-tissue disease context" },
  { value: "none_documented", label: "None documented today" },
];

const INFECTION_RISK_FLAGS_OPTIONS: ConsultationFormOption[] = [
  { value: "purulent_discharge", label: "Purulent discharge / abscess concern" },
  { value: "tinea_exposure", label: "Tinea / close-contact or animal exposure" },
  { value: "immunosuppression", label: "Immunosuppression / diabetes / systemic risk" },
  { value: "post_procedure_wound", label: "Recent procedure or wound on scalp" },
  { value: "none_documented", label: "No additional infection risk flags" },
];

const PATHOLOGY_TREATMENT_OPTIONS: ConsultationFormOption[] = [
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

const FOLLOW_UP_URGENCY_OPTIONS: ConsultationFormOption[] = [
  { value: "routine", label: "Routine" },
  { value: "priority", label: "Priority" },
  { value: "urgent", label: "Urgent" },
];

/**
 * ConsultationOS v2 pathway 6 — Scalp disorder / pathology (inflammatory, scarring, autoimmune, infectious;
 * HLI + pathology + Patient Twin alignment; no quote, graft, donor, or surgery planning fields).
 */
export const scalpPathologyConsultationSchemaV1: ConsultationFormSchema = {
  schemaRevision: 1,
  sections: [
    {
      id: "presenting_symptoms",
      title: "Presenting Symptoms",
      description: "Rapid symptom frame — target under five minutes across all sections.",
      fields: [
        fld({
          id: "scalp_symptom_type",
          label: "Primary scalp symptom pattern",
          type: "select",
          options: SCALP_SYMPTOM_TYPE_OPTIONS,
          required: true,
        }),
        fld({
          id: "symptom_duration_band",
          label: "Symptom duration (approximate)",
          type: "select",
          optionSet: "consultation_duration_band",
          required: true,
        }),
        fld({
          id: "itching_present",
          label: "Itching / pruritus present",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "pain_or_tenderness_present",
          label: "Pain or tenderness present",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "scaling_or_flaking_present",
          label: "Scaling or flaking present",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "patchy_loss_present",
          label: "Patchy hair loss present",
          type: "boolean",
          required: true,
        }),
      ],
    },
    {
      id: "scalp_findings",
      title: "Scalp Findings",
      fields: [
        fld({
          id: "erythema_present",
          label: "Erythema on examination",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "pustules_or_crusting_present",
          label: "Pustules or crusting",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "scarring_suspicion",
          label: "Clinical suspicion of scarring alopecia",
          type: "boolean",
          required: true,
        }),
      ],
    },
    {
      id: "medical_autoimmune_screening",
      title: "Medical / Autoimmune Screening",
      fields: [
        fld({
          id: "autoimmune_flags",
          label: "Autoimmune / systemic flags (select all that apply)",
          type: "multi_select",
          options: AUTOIMMUNE_FLAGS_OPTIONS,
          required: true,
        }),
        fld({
          id: "infection_risk_flags",
          label: "Infection risk flags (select all that apply)",
          type: "multi_select",
          options: INFECTION_RISK_FLAGS_OPTIONS,
          required: true,
        }),
      ],
    },
    {
      id: "investigation_treatment_plan",
      title: "Investigation & Treatment Plan",
      fields: [
        fld({
          id: "biopsy_recommended",
          label: "Scalp biopsy recommended",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "blood_analysis_recommended",
          label: "Blood analysis / serology recommended",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "pathology_recommended_explicit",
          label: "Histopathology / lab pathway explicitly recommended",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "pathology_reason",
          label: "Reason for pathology / lab pathway",
          type: "textarea",
          placeholder:
            "e.g. rule out cicatricial pattern, correlate with discoid lesions, baseline before systemic therapy…",
          showWhen: { fieldId: "pathology_recommended_explicit", operator: "equals", value: true },
          required: true,
        }),
        fld({
          id: "urgent_dermatology_referral",
          label: "Urgent dermatology referral indicated",
          type: "boolean",
          required: true,
        }),
        fld({
          id: "recommended_treatments",
          label: "Recommended treatments / actions (draft)",
          type: "multi_select",
          options: PATHOLOGY_TREATMENT_OPTIONS,
        }),
        fld({
          id: "ai_recommended_plan_summary",
          label: "AI recommended plan summary (draft — clinician editable)",
          type: "textarea",
          placeholder: "Short plan for HLI / pathology / Patient Twin handoff.",
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
          label: "Follow-up urgency",
          type: "select",
          options: FOLLOW_UP_URGENCY_OPTIONS,
          required: true,
        }),
      ],
    },
  ],
};

export const scalpPathologyConsultationSchema = scalpPathologyConsultationSchemaV1;
