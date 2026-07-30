/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — identity preflight (pure, fail-closed).
 * No identity ambiguity may be accepted for the initial cohort.
 * Synthetic fixtures are excluded from live eligibility.
 */

import {
  PILOT_ACTIVATION_VERSION,
  type GateCheck,
  type PilotIdentityPreflightResult,
} from "./activationTypes";

export type IdentityPreflightInput = {
  tenantId: string;
  programmeId: string;
  patientId: string;
  evaluatedAt?: string;
  patientFound: boolean;
  patientTenantId: string | null;
  ambiguousPatient: boolean;
  appAuthUserId: string | null;
  appLinkagePatientCount: number;
  crmLeadPatientIdConflict: boolean;
  quotePatientId: string | null;
  consentPatientId: string | null;
  documentPatientId: string | null;
  imagePatientIds: readonly string[];
  journeyPatientId: string | null;
  activeEnrolmentCountForProgrammePatient: number;
  /** Smoke / synthetic fixtures must fail closed for live cohort eligibility. */
  isSyntheticOrSmokeFixture: boolean;
  crossTenantMapping?: boolean;
  sourcePatientIdMismatch?: boolean;
};

function check(
  status: GateCheck["status"],
  reasonCode: string,
  blocking: boolean,
  patientSafeSummary: string
): GateCheck {
  return { status, reasonCode, blocking, patientSafeSummary };
}

export function evaluatePilotPatientIdentityPreflight(
  input: IdentityPreflightInput
): PilotIdentityPreflightResult {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const criticalBlockers: string[] = [];

  if (input.isSyntheticOrSmokeFixture) {
    criticalBlockers.push("synthetic_fixture_excluded");
  }

  const canonicalPatient = input.patientFound
    ? check("pass", "patient_found", true, "Canonical patient record resolved")
    : check("fail", "patient_not_found", true, "Canonical patient record not found");
  if (canonicalPatient.status === "fail") criticalBlockers.push("canonical_patient");

  const tenantOk =
    input.patientFound &&
    input.patientTenantId === input.tenantId &&
    !input.crossTenantMapping;
  const tenantOwnership = !input.patientFound
    ? check("unknown", "patient_missing", true, "Tenant ownership unknown — fail closed")
    : tenantOk
      ? check("pass", "tenant_match", true, "Patient belongs to programme tenant")
      : check("fail", "tenant_mismatch", true, "Patient tenant mismatch — fail closed");
  if (tenantOwnership.status !== "pass") criticalBlockers.push("tenant_ownership");

  const appOk =
    input.appAuthUserId == null || input.appLinkagePatientCount <= 1;
  const appIdentity = !appOk
    ? check("fail", "app_identity_conflict", true, "App identity resolves to multiple patients")
    : check("pass", "app_identity_ok", true, "App identity unique or absent");
  if (appIdentity.status === "fail") criticalBlockers.push("app_identity");

  const crmIdentity = input.crmLeadPatientIdConflict
    ? check("fail", "crm_identity_conflict", true, "CRM mapping conflicts with patient")
    : check("pass", "crm_identity_ok", true, "CRM mapping does not conflict");
  if (crmIdentity.status === "fail") criticalBlockers.push("crm_identity");

  const financeOk =
    input.quotePatientId == null || input.quotePatientId === input.patientId;
  const financeIdentity = financeOk
    ? check("pass", "finance_identity_ok", true, "Finance records align to patient")
    : check("fail", "finance_cross_patient", true, "Finance record linked to another patient");
  if (financeIdentity.status === "fail") criticalBlockers.push("finance_identity");

  const consentOk =
    input.consentPatientId == null || input.consentPatientId === input.patientId;
  const consentIdentity = consentOk
    ? check("pass", "consent_identity_ok", true, "Consent belongs to patient or absent")
    : check("fail", "consent_cross_patient", true, "Consent linked to another patient");
  if (consentIdentity.status === "fail") criticalBlockers.push("consent_identity");

  const documentOk =
    input.documentPatientId == null || input.documentPatientId === input.patientId;
  const documentIdentity = documentOk
    ? check("pass", "document_identity_ok", true, "Documents belong to patient or absent")
    : check("fail", "document_cross_patient", true, "Document linked to another patient");
  if (documentIdentity.status === "fail") criticalBlockers.push("document_identity");

  const imageMismatch = input.imagePatientIds.some((id) => id !== input.patientId);
  const imageIdentity = imageMismatch
    ? check("fail", "image_cross_patient", true, "Image linked to another patient")
    : check("pass", "image_identity_ok", true, "Images belong to patient or absent");
  if (imageIdentity.status === "fail") criticalBlockers.push("image_identity");

  const journeyOk =
    input.journeyPatientId == null || input.journeyPatientId === input.patientId;
  const journeyIdentity = journeyOk
    ? check("pass", "journey_identity_ok", true, "Journey records resolve to patient")
    : check("fail", "journey_cross_patient", true, "Journey linked to another patient");
  if (journeyIdentity.status === "fail") criticalBlockers.push("journey_identity");

  const dupOk = input.activeEnrolmentCountForProgrammePatient <= 1;
  const duplicateEnrolment = dupOk
    ? check("pass", "no_duplicate_enrolment", true, "No duplicate programme enrolment")
    : check("fail", "duplicate_enrolment", true, "Duplicate enrolment for programme");
  if (duplicateEnrolment.status === "fail") criticalBlockers.push("duplicate_enrolment");

  if (input.ambiguousPatient) {
    criticalBlockers.push("ambiguous_identity");
  }
  if (input.sourcePatientIdMismatch) {
    criticalBlockers.push("source_patient_id_mismatch");
  }

  // Ambiguous identity always fails closed even if other checks pass.
  if (input.ambiguousPatient) {
    // Force eligibility false via critical blockers (already pushed).
  }

  const eligible =
    criticalBlockers.length === 0 &&
    canonicalPatient.status === "pass" &&
    tenantOwnership.status === "pass" &&
    !input.ambiguousPatient;

  return {
    eligible,
    checks: {
      canonicalPatient,
      tenantOwnership,
      appIdentity,
      crmIdentity,
      financeIdentity,
      consentIdentity,
      documentIdentity,
      imageIdentity,
      journeyIdentity,
      duplicateEnrolment,
    },
    criticalBlockers: [...new Set(criticalBlockers)],
    evaluatedAt,
    version: PILOT_ACTIVATION_VERSION,
  };
}
