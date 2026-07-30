/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — clinical / consent preflight (pure).
 * Software may show canonical clinical states.
 * Software must not independently determine clinical suitability — human required.
 */

import {
  PILOT_ACTIVATION_VERSION,
  type GateCheck,
  type PilotClinicalConsentPreflightResult,
} from "./activationTypes";

export type ClinicalConsentPreflightInput = {
  tenantId: string;
  programmeId: string;
  patientId: string;
  evaluatedAt?: string;
  pathwayObserved: boolean;
  consultationComplete: boolean;
  clinicalReviewState: "approved" | "pending" | "unknown" | "absent" | "superseded";
  pathologyRequiredKnown: boolean;
  consentWorkflowAvailable: boolean;
  consentPatientId: string | null;
  consentCurrent: boolean;
  consentSupersededOrRevoked: boolean;
  clinicalEscalationPathDefined: boolean;
  clinicalEscalationActive: boolean;
  highComplexityException: boolean;
  /** Named human clinical approval — never inferred. */
  humanClinicalApproval: boolean;
};

function check(
  status: GateCheck["status"],
  reasonCode: string,
  blocking: boolean,
  patientSafeSummary: string
): GateCheck {
  return { status, reasonCode, blocking, patientSafeSummary };
}

export function evaluatePilotPatientClinicalConsentPreflight(
  input: ClinicalConsentPreflightInput
): PilotClinicalConsentPreflightResult {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const criticalBlockers: string[] = [];
  const warnings: string[] = [];

  const pathwayAppropriatenessObserved = input.pathwayObserved
    ? check(
        "human_required",
        "pathway_observed_human_required",
        true,
        "Pathway state observed — clinical suitability remains human"
      )
    : check("fail", "pathway_not_observed", true, "Pathway appropriateness not observed");
  if (pathwayAppropriatenessObserved.status === "fail") {
    criticalBlockers.push("pathway_not_observed");
  }

  const consultationState = input.consultationComplete
    ? check("pass", "consultation_complete", true, "Required consultation state present")
    : check("fail", "consultation_incomplete", true, "Required consultation state missing");
  if (consultationState.status === "fail") criticalBlockers.push("consultation");

  const clinicalReviewState =
    input.clinicalReviewState === "approved"
      ? check("pass", "clinical_review_approved", true, "Clinical review state approved")
      : input.clinicalReviewState === "pending"
        ? check("fail", "clinical_review_pending", true, "Clinical review pending")
        : check("fail", `clinical_review_${input.clinicalReviewState}`, true, "Clinical review not ready");
  if (clinicalReviewState.status === "fail") criticalBlockers.push("clinical_review");

  const pathologyKnown = input.pathologyRequiredKnown
    ? check("pass", "pathology_known", true, "Pathology requirements known")
    : check("fail", "pathology_unknown", true, "Pathology requirements unknown — fail closed");
  if (pathologyKnown.status === "fail") criticalBlockers.push("pathology_unknown");

  const consentWorkflowAvailable = input.consentWorkflowAvailable
    ? check("pass", "consent_workflow_available", true, "Consent workflow available")
    : check("fail", "consent_workflow_unavailable", true, "Consent workflow unavailable");
  if (consentWorkflowAvailable.status === "fail") criticalBlockers.push("consent_workflow");

  const consentOwnership =
    input.consentPatientId == null
      ? check("fail", "consent_missing", true, "Required consent missing")
      : input.consentPatientId === input.patientId
        ? check("pass", "consent_ownership_ok", true, "Consent belongs to patient")
        : check("fail", "consent_wrong_patient", true, "Consent linked to another patient — critical");
  if (consentOwnership.status === "fail") criticalBlockers.push("consent_ownership");

  const consentCurrent =
    input.consentSupersededOrRevoked
      ? check("fail", "consent_superseded_or_revoked", true, "Consent superseded or revoked")
      : input.consentCurrent
        ? check("pass", "consent_current", true, "Consent is current")
        : check("fail", "consent_not_current", true, "Consent is not current");
  if (consentCurrent.status === "fail") criticalBlockers.push("consent_current");

  const clinicalEscalationPath = input.clinicalEscalationPathDefined
    ? check("pass", "escalation_path_defined", true, "Clinical escalation path defined")
    : check("fail", "escalation_path_missing", true, "Clinical escalation path not defined");
  if (clinicalEscalationPath.status === "fail") criticalBlockers.push("escalation_path");

  if (input.clinicalEscalationActive) {
    criticalBlockers.push("unresolved_clinical_escalation");
  }

  const highComplexityException = input.highComplexityException
    ? check(
        "fail",
        "high_complexity_exception",
        true,
        "High-complexity exception — unsuitable for first cohort"
      )
    : check("pass", "no_high_complexity", true, "No known high-complexity exception");
  if (highComplexityException.status === "fail") {
    criticalBlockers.push("high_complexity");
  }

  if (!input.humanClinicalApproval) {
    criticalBlockers.push("human_clinical_approval_required");
    warnings.push("clinical_suitability_requires_named_human_approval");
  }

  const eligible =
    criticalBlockers.length === 0 && input.humanClinicalApproval;

  return {
    eligible,
    clinicalSuitabilityHumanRequired: true,
    checks: {
      pathwayAppropriatenessObserved,
      consultationState,
      clinicalReviewState,
      pathologyKnown,
      consentWorkflowAvailable,
      consentOwnership,
      consentCurrent,
      clinicalEscalationPath,
      highComplexityException,
    },
    criticalBlockers: [...new Set(criticalBlockers)],
    warnings,
    evaluatedAt,
    version: PILOT_ACTIVATION_VERSION,
  };
}
