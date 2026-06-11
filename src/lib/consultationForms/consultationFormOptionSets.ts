import type { ConsultationFormOption, ConsultationFormOptionSetId } from "./consultationFormTypes";

export const CONSULTATION_FORM_OPTION_SETS: Record<ConsultationFormOptionSetId, ConsultationFormOption[]> = {
  norwood_scale: [
    { value: "nw1", label: "Norwood I" },
    { value: "nw2", label: "Norwood II" },
    { value: "nw2a", label: "Norwood IIa" },
    { value: "nw3", label: "Norwood III" },
    { value: "nw3v", label: "Norwood III vertex" },
    { value: "nw4", label: "Norwood IV" },
    { value: "nw5", label: "Norwood V" },
    { value: "nw5a", label: "Norwood Va" },
    { value: "nw6", label: "Norwood VI" },
    { value: "nw7", label: "Norwood VII" },
    { value: "unsure", label: "Unsure / not classifiable" },
  ],
  ludwig_scale: [
    { value: "l1", label: "Ludwig I (mild)" },
    { value: "l2", label: "Ludwig II (moderate)" },
    { value: "l3", label: "Ludwig III (severe)" },
    { value: "unsure", label: "Unsure" },
  ],
  sinclair_scale: [
    { value: "s1", label: "Sinclair 1" },
    { value: "s2", label: "Sinclair 2" },
    { value: "s3", label: "Sinclair 3" },
    { value: "s4", label: "Sinclair 4" },
    { value: "s5", label: "Sinclair 5" },
    { value: "unsure", label: "Unsure" },
  ],
  donor_quality: [
    { value: "excellent", label: "Excellent" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
    { value: "poor", label: "Poor" },
    { value: "not_assessed", label: "Not assessed" },
  ],
  hair_calibre: [
    { value: "fine", label: "Fine" },
    { value: "medium", label: "Medium" },
    { value: "coarse", label: "Coarse" },
    { value: "mixed", label: "Mixed" },
  ],
  scalp_condition: [
    { value: "normal", label: "Normal / healthy" },
    { value: "seborrheic", label: "Seborrheic / oily" },
    { value: "dry", label: "Dry / flaky" },
    { value: "inflamed", label: "Inflamed / erythematous" },
    { value: "scarring_concern", label: "Possible scarring alopecia" },
    { value: "other", label: "Other" },
  ],
  shedding_severity: [
    { value: "none", label: "None reported" },
    { value: "mild", label: "Mild" },
    { value: "moderate", label: "Moderate" },
    { value: "severe", label: "Severe" },
    { value: "acute_telogen", label: "Acute telogen effluvium pattern" },
  ],
  medication_tolerance: [
    { value: "good", label: "Good — no significant issues" },
    { value: "moderate", label: "Moderate — some adverse effects" },
    { value: "poor", label: "Poor — intolerant / contraindicated" },
    { value: "na", label: "Not applicable / not tried" },
  ],
  treatment_interest: [
    { value: "ht_fue", label: "Hair transplant (FUE)" },
    { value: "ht_fut", label: "Hair transplant (FUT/strip)" },
    { value: "prp", label: "PRP" },
    { value: "exosomes", label: "Exosomes / biologics" },
    { value: "medical", label: "Medical therapy (e.g. anti-androgens, minoxidil)" },
    { value: "mesotherapy", label: "Mesotherapy" },
    { value: "camouflage", label: "Camouflage fibres / cosmetic" },
    { value: "unsure", label: "Unsure — exploring options" },
  ],
  budget_range: [
    { value: "under_5k", label: "Under $5,000" },
    { value: "5k_10k", label: "$5,000 – $10,000" },
    { value: "10k_20k", label: "$10,000 – $20,000" },
    { value: "20k_plus", label: "$20,000+" },
    { value: "discuss", label: "Prefer to discuss in person" },
  ],
  urgency: [
    { value: "routine", label: "Routine (weeks)" },
    { value: "soon", label: "Soon (this month)" },
    { value: "urgent", label: "Urgent (this fortnight)" },
    { value: "asap", label: "ASAP" },
  ],
  medical_risk_flags: [
    { value: "bleeding", label: "Bleeding disorder / anticoagulation" },
    { value: "diabetes", label: "Diabetes (poor control)" },
    { value: "cardiac", label: "Significant cardiac history" },
    { value: "keloid", label: "Keloid / hypertrophic scarring tendency" },
    { value: "smoking", label: "Active smoking" },
    { value: "immunosuppression", label: "Immunosuppression" },
    { value: "psych", label: "Body dysmorphia / psychiatric concern" },
    { value: "medical_review_required", label: "Medical review / clearance required" },
    { value: "blood_tests_recommended", label: "Blood tests / pathology screening recommended" },
    { value: "progressive_loss", label: "Rapid or progressive hair loss" },
    { value: "none_reported", label: "None reported" },
  ],
  surgical_outcome_type: [
    { value: "density_natural", label: "Natural density / conservative" },
    { value: "density_high", label: "Higher density where safe" },
    { value: "hairline_conservative", label: "Conservative hairline" },
    { value: "hairline_aggressive", label: "Lower / more aggressive hairline" },
    { value: "temple_point", label: "Temple point restoration priority" },
    { value: "crown", label: "Crown coverage priority" },
  ],
  hair_loss_onset_pattern: [
    { value: "gradual", label: "Gradual thinning" },
    { value: "sudden", label: "Sudden onset" },
    { value: "patchy", label: "Patchy / focal" },
    { value: "recurrent", label: "Recurrent episodes" },
    { value: "lifelong", label: "Lifelong / since young adult" },
  ],
  family_history_pattern: [
    { value: "maternal", label: "Maternal side" },
    { value: "paternal", label: "Paternal side" },
    { value: "both", label: "Both sides" },
    { value: "none_known", label: "No known family history" },
    { value: "unknown", label: "Unknown" },
  ],
  previous_treatment_types: [
    { value: "minoxidil", label: "Minoxidil" },
    { value: "finasteride", label: "Finasteride / dutasteride" },
    { value: "prp", label: "PRP" },
    { value: "laser", label: "Low-level laser" },
    { value: "ht_prior", label: "Prior hair transplant" },
    { value: "meso", label: "Mesotherapy" },
    { value: "supplements", label: "Supplements only" },
    { value: "none", label: "None" },
  ],
  consultation_priority: [
    { value: "hairline", label: "Hairline framing" },
    { value: "density", label: "Mid-scalp density" },
    { value: "crown", label: "Crown / vertex" },
    { value: "donor", label: "Donor assessment / repair" },
    { value: "scar", label: "Scar camouflage" },
    { value: "general", label: "General medical hair loss work-up" },
  ],
  yes_no_unsure: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unsure", label: "Unsure" },
  ],
};

export function optionsForField(field: {
  options?: ConsultationFormOption[];
  optionSet?: ConsultationFormOptionSetId;
}): ConsultationFormOption[] {
  if (field.options?.length) return field.options;
  if (field.optionSet) return CONSULTATION_FORM_OPTION_SETS[field.optionSet] ?? [];
  return [];
}
