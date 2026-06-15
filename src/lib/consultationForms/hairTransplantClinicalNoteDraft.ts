/**
 * Deterministic “AI-style” clinical note draft for Hair Transplant Consultation v2.
 * Assembles readable prose from structured fields only (no backend LLM).
 * Intentionally does not read `structured_clinical_note` or dictation fields to avoid feedback loops.
 */

import { CONSULTATION_FORM_OPTION_SETS } from "./consultationFormOptionSets";
import {
  canonicalHairTransplantNorwoodKey,
  canonicalHairTransplantRiskFlagValues,
  canonicalHairTransplantTreatmentValues,
} from "./normalize/hairTransplantConsultationNormalize";
import {
  HAIR_TRANSPLANT_V2_RECOMMENDED_TREATMENT_OPTIONS,
  HAIR_TRANSPLANT_V2_RECOMMENDED_ZONE_OPTIONS,
} from "./templates/hairTransplantConsultationTemplate";
import { labelForOptionValue, readString, readStringArray } from "./completion/consultationCompletionExtractors";

function line(...parts: string[]): string {
  const s = parts.map((p) => p.trim()).filter(Boolean).join(" ");
  return s.trim();
}

/**
 * Builds a chart-ready narrative from current form values (Hair Transplant template v2 fields).
 */
export function buildHairTransplantDeterministicClinicalNoteDraft(values: Record<string, unknown>): string {
  const priority = labelForOptionValue(
    CONSULTATION_FORM_OPTION_SETS.consultation_priority,
    readString(values.priority_focus)
  );
  const objective = labelForOptionValue(
    CONSULTATION_FORM_OPTION_SETS.consultation_primary_objective,
    readString(values.primary_objective)
  );
  const duration = labelForOptionValue(
    CONSULTATION_FORM_OPTION_SETS.consultation_duration_band,
    readString(values.duration_band)
  );
  const nwKey = canonicalHairTransplantNorwoodKey(values);
  const pattern = nwKey ? labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.norwood_scale, nwKey) || nwKey : "";
  const onset = labelForOptionValue(
    CONSULTATION_FORM_OPTION_SETS.hair_loss_onset_pattern,
    readString(values.onset_pattern)
  );
  const scalp = labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.scalp_condition, readString(values.scalp_condition));
  const calibre = labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.hair_calibre, readString(values.hair_calibre));

  const treatments = canonicalHairTransplantTreatmentValues(values)
    .map((t) => labelForOptionValue(HAIR_TRANSPLANT_V2_RECOMMENDED_TREATMENT_OPTIONS, t) || t.replace(/_/g, " "))
    .filter(Boolean);
  const zones = readStringArray(values.recommended_zones)
    .map((z) => labelForOptionValue(HAIR_TRANSPLANT_V2_RECOMMENDED_ZONE_OPTIONS, z) || z.replace(/_/g, " "))
    .filter(Boolean);

  const donor = labelForOptionValue(CONSULTATION_FORM_OPTION_SETS.donor_quality, readString(values.donor_quality));
  const recipient = labelForOptionValue(
    CONSULTATION_FORM_OPTION_SETS.recipient_area_quality,
    readString(values.recipient_quality)
  );

  const outcome = readString(values.consultation_outcome_type).replace(/_/g, " ");
  const surg = readString(values.surgical_suitability).replace(/_/g, " ");
  const med = readString(values.medical_suitability).replace(/_/g, " ");

  const risks = canonicalHairTransplantRiskFlagValues(values).map((r) => r.replace(/_/g, " "));

  const plan = readString(values.ai_recommended_plan_summary).trim();

  const paras: string[] = [];

  paras.push(
    line(
      "Consultation focus:",
      priority || "not specified",
      objective ? `Objective: ${objective}.` : "",
      duration ? `Duration band: ${duration}.` : ""
    )
  );

  paras.push(
    line(
      "Pattern / scalp:",
      pattern || "classification not recorded",
      onset ? `Onset: ${onset}.` : "",
      scalp ? `Scalp: ${scalp}.` : "",
      calibre ? `Calibre: ${calibre}.` : ""
    )
  );

  if (donor || recipient) {
    paras.push(line("Donor / recipient:", donor ? `Donor ${donor}.` : "", recipient ? `Recipient ${recipient}.` : ""));
  }

  if (treatments.length || zones.length) {
    paras.push(
      line(
        "Therapy / zones discussed:",
        treatments.length ? treatments.join(", ") : "",
        zones.length ? `Target zones: ${zones.join(", ")}.` : ""
      )
    );
  }

  paras.push(line("Disposition:", outcome ? `Outcome direction: ${outcome}.` : "", `Surgical suitability: ${surg || "not assessed"}.`, `Medical suitability: ${med || "not assessed"}.`));

  if (risks.length) {
    paras.push(`Flags / counselling topics: ${risks.join(", ")}.`);
  }

  if (plan) {
    paras.push(`Plan summary: ${plan}`);
  }

  return paras.filter(Boolean).join("\n\n").trim();
}
