/**
 * FI-TRICHOSCOPY-1B — patient-safe consultation summary generation.
 * Excludes clinician-only / technical fields by default.
 */

import { PATIENT_SAFE_TRICHOSCOPY_FRAMING } from "./types";

export type PatientSafeTrichoscopySummaryInput = {
  performed: boolean;
  regionsReviewed?: string[];
  highLevelObservations?: string[];
  moreEvidenceRequired?: boolean;
  recommendedNextSteps?: string[];
  treatmentOrInvestigationActions?: string[];
  plannedFollowUpInterval?: string | null;
  whyPerformed?: string | null;
  /** Clinician-only fields — never included in output. */
  forbidden?: {
    confidenceValues?: unknown;
    internalRiskScores?: unknown;
    differentialRanking?: unknown;
    billing?: unknown;
    reconciliationStatus?: unknown;
    unsupportedDiseaseLabels?: unknown;
    clinicianOnlyEscalationNotes?: unknown;
  };
};

export type PatientSafeTrichoscopySummary = {
  framing: string;
  sections: Array<{ heading: string; body: string }>;
  omittedClinicianOnlyFields: string[];
};

const FORBIDDEN_KEYS = [
  "confidenceValues",
  "internalRiskScores",
  "differentialRanking",
  "billing",
  "reconciliationStatus",
  "unsupportedDiseaseLabels",
  "clinicianOnlyEscalationNotes",
] as const;

function sanitizeLine(text: string, maxLen = 280): string {
  return text
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Build patient-facing trichoscopy language for the consultation summary.
 * Never embeds raw confidence, ranking, billing, or clinician escalation notes.
 */
export function buildPatientSafeTrichoscopySummary(
  input: PatientSafeTrichoscopySummaryInput
): PatientSafeTrichoscopySummary {
  const omitted = FORBIDDEN_KEYS.filter((k) => input.forbidden?.[k] != null);

  if (!input.performed) {
    return {
      framing: PATIENT_SAFE_TRICHOSCOPY_FRAMING,
      sections: [],
      omittedClinicianOnlyFields: [...omitted],
    };
  }

  const sections: Array<{ heading: string; body: string }> = [];

  if (input.whyPerformed?.trim()) {
    sections.push({
      heading: "Why trichoscopy was performed",
      body: sanitizeLine(input.whyPerformed),
    });
  }

  if (input.regionsReviewed?.length) {
    sections.push({
      heading: "Regions reviewed",
      body: input.regionsReviewed.map((r) => sanitizeLine(r, 80)).join(", "),
    });
  }

  if (input.highLevelObservations?.length) {
    sections.push({
      heading: "Observations",
      body: input.highLevelObservations.map((o) => sanitizeLine(o)).join(" "),
    });
  }

  if (input.moreEvidenceRequired) {
    sections.push({
      heading: "Further assessment",
      body: "Additional images or clinical information may be needed before drawing firmer conclusions.",
    });
  }

  if (input.recommendedNextSteps?.length) {
    sections.push({
      heading: "Recommended next steps",
      body: input.recommendedNextSteps.map((s) => sanitizeLine(s)).join(" "),
    });
  }

  if (input.treatmentOrInvestigationActions?.length) {
    sections.push({
      heading: "Actions agreed",
      body: input.treatmentOrInvestigationActions.map((s) => sanitizeLine(s)).join(" "),
    });
  }

  if (input.plannedFollowUpInterval?.trim()) {
    sections.push({
      heading: "Follow-up",
      body: sanitizeLine(
        `A follow-up trichoscopy review is planned at approximately ${input.plannedFollowUpInterval}.`
      ),
    });
  }

  return {
    framing: PATIENT_SAFE_TRICHOSCOPY_FRAMING,
    sections,
    omittedClinicianOnlyFields: [...omitted],
  };
}

export function formatPatientSafeTrichoscopySummaryText(
  summary: PatientSafeTrichoscopySummary
): string {
  const parts = [summary.framing];
  for (const section of summary.sections) {
    parts.push(`${section.heading}: ${section.body}`);
  }
  return parts.join("\n\n");
}
