/**
 * Patient readiness — invitation, activation, consent, docs, images, inactivity (pure).
 */

import { requirementForSignal } from "../readinessMilestones";
import type { PilotEnrolmentStatus } from "../../pilotControlContracts";
import type { PilotJourneyStage } from "../readinessTypes";
import { buildSignal, blockerFromSignal, warningFromSignal } from "../signalHelpers";
import type {
  ConsentDocumentSourceBag,
  ImageSourceBag,
  JourneySourceBag,
} from "../readinessSourceBag";
import type { PilotBlocker, PilotReadinessWarning, ReadinessSignalResult } from "../readinessTypes";

export type PatientAdapterResult = {
  signals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
};

export function resolvePatientSignals(args: {
  enrolmentStatus: PilotEnrolmentStatus;
  appActivated: boolean;
  realPatientInvitesEnabled: boolean;
  consent: ConsentDocumentSourceBag;
  images: ImageSourceBag;
  journey: JourneySourceBag;
  stage: PilotJourneyStage;
  patientInactiveAttentionDays: number;
  evaluatedAt: string;
}): PatientAdapterResult {
  const {
    enrolmentStatus,
    appActivated,
    realPatientInvitesEnabled,
    consent,
    images,
    journey,
    stage,
    patientInactiveAttentionDays,
    evaluatedAt,
  } = args;
  const signals: ReadinessSignalResult[] = [];
  const blockers: PilotBlocker[] = [];
  const warnings: PilotReadinessWarning[] = [];

  // Invitation — approved but not invited is not patient non-compliance when invites disabled
  const inviteRule = requirementForSignal(stage, "patient.invitation_state");
  if (inviteRule) {
    const preInvite =
      enrolmentStatus === "approved" || enrolmentStatus === "candidate";
    const invited =
      enrolmentStatus === "invited" ||
      enrolmentStatus === "activated" ||
      enrolmentStatus === "active" ||
      enrolmentStatus === "paused" ||
      enrolmentStatus === "completed";

    let status: "satisfied" | "pending" | "not_applicable" | "missing" = "pending";
    let reason = "invitation_pending";
    let summary = "Pilot invitation pending";

    if (!realPatientInvitesEnabled && preInvite) {
      status = "not_applicable";
      reason = "invites_disabled_pre_invitation";
      summary = "Real invites disabled — approved patient is not non-compliant";
    } else if (preInvite) {
      status = "pending";
      reason = "approved_not_invited";
      summary = "Approved but not yet invited (pre-invitation)";
    } else if (invited) {
      status = "satisfied";
      reason = "invitation_recorded";
      summary = "Invitation state recorded on enrolment";
    }

    signals.push(
      buildSignal({
        key: "patient.invitation_state",
        label: "Pilot invitation state",
        sourceSystem: "pilot_enrolment",
        requirement: !realPatientInvitesEnabled && preInvite ? "not_applicable" : "conditional",
        status,
        reasonCode: reason,
        observedValueClass:
          status === "satisfied"
            ? "present"
            : status === "not_applicable"
              ? "not_applicable"
              : "pending",
        sourceTable: "fi_pilot_enrolments",
        sourceField: "enrolment_status",
        blocking: false,
        patientSafeSummary: summary,
        conditionReason: inviteRule.notes,
      })
    );
  }

  const actRule = requirementForSignal(stage, "patient.app_activation");
  if (actRule && actRule.requirement !== "not_applicable") {
    const requiresApp =
      stage === "consultation_preparation" || stage === "procedure_preparation";
    const invitedPending =
      enrolmentStatus === "invited" && !appActivated;
    const activation = buildSignal({
      key: "patient.app_activation",
      label: "Patient App activation",
      sourceSystem: "patient_app_gateway",
      requirement: requiresApp ? "conditional" : "optional",
      status: appActivated
        ? "satisfied"
        : invitedPending
          ? "pending"
          : enrolmentStatus === "approved"
            ? "not_applicable"
            : "pending",
      reasonCode: appActivated
        ? "app_activated"
        : invitedPending
          ? "invited_not_activated"
          : "activation_pending",
      observedValueClass: appActivated
        ? "present"
        : enrolmentStatus === "approved"
          ? "not_applicable"
          : "pending",
      sourceTable: "fi_patients",
      sourceField: "portal_auth_user_id",
      blocking: requiresApp && !appActivated && enrolmentStatus !== "approved",
      conditionReason: "Pathway requires Patient App after invitation",
      patientSafeSummary: appActivated
        ? "Patient App activated"
        : invitedPending
          ? "Invited but Patient App not activated"
          : "App activation not yet applicable or pending",
    });
    signals.push(activation);
  }

  const consentRule = requirementForSignal(stage, "patient.mandatory_consent");
  if (consentRule && consentRule.requirement === "mandatory") {
    const consentSignal = buildSignal({
      key: "patient.mandatory_consent",
      label: "Mandatory consent",
      sourceSystem: "consent",
      requirement: "mandatory",
      status: consent.consentWrongPatient
        ? "failed"
        : consent.mandatoryConsentUnknown
          ? "unknown"
          : consent.mandatoryConsentSatisfied === true
            ? "satisfied"
            : consent.mandatoryConsentSatisfied === false
              ? "missing"
              : "unknown",
      reasonCode: consent.consentWrongPatient
        ? "consent_wrong_patient"
        : consent.mandatoryConsentUnknown
          ? "consent_unknown"
          : consent.mandatoryConsentSatisfied
            ? "consent_satisfied"
            : "consent_missing",
      observedValueClass: consent.consentWrongPatient
        ? "failed"
        : consent.mandatoryConsentUnknown
          ? "unknown"
          : consent.mandatoryConsentSatisfied
            ? "approved"
            : "absent",
      sourceTable: "fi_patient_document_packets",
      sourceRecordId: consent.packetId ?? undefined,
      blocking: true,
      severity: consent.consentWrongPatient ? "critical" : "high",
      patientSafeSummary: consent.consentWrongPatient
        ? "Consent record patient mismatch"
        : consent.mandatoryConsentSatisfied
          ? "Mandatory consent complete"
          : "Mandatory consent missing",
    });
    signals.push(consentSignal);
  } else if (consentRule && consentRule.requirement === "not_applicable") {
    signals.push(
      buildSignal({
        key: "patient.mandatory_consent",
        label: "Mandatory consent",
        sourceSystem: "consent",
        requirement: "not_applicable",
        status: "not_applicable",
        reasonCode: "consent_not_required_at_stage",
        observedValueClass: "not_applicable",
        patientSafeSummary: "Procedure consent not required at current stage",
      })
    );
  }

  const optDoc = buildSignal({
    key: "patient.optional_document",
    label: "Optional document",
    sourceSystem: "documents",
    requirement: "optional",
    status: consent.optionalDocumentMissing ? "missing" : "satisfied",
    reasonCode: consent.optionalDocumentMissing
      ? "optional_document_missing"
      : "optional_document_ok",
    observedValueClass: consent.optionalDocumentMissing ? "absent" : "present",
    sourceTable: "fi_patient_document_sections",
    blocking: false,
    patientSafeSummary: consent.optionalDocumentMissing
      ? "Optional document missing (non-blocking)"
      : "Optional documents complete",
  });
  signals.push(optDoc);

  const imageRule = requirementForSignal(stage, "patient.required_image_role");
  if (imageRule && imageRule.requirement !== "not_applicable") {
    const missing = images.missingRoles;
    const applicable = images.requiredRoles.length > 0;
    const imageSignal = buildSignal({
      key: "patient.required_image_role",
      label: "Required image roles",
      sourceSystem: "imaging_os",
      requirement: applicable ? "conditional" : "not_applicable",
      status: !applicable
        ? "not_applicable"
        : missing.length === 0
          ? "satisfied"
          : "missing",
      reasonCode: !applicable
        ? "no_required_image_roles_at_stage"
        : missing.length === 0
          ? "required_images_present"
          : "required_image_role_missing",
      observedValueClass: !applicable
        ? "not_applicable"
        : missing.length === 0
          ? "present"
          : "absent",
      sourceTable: "fi_patient_images",
      blocking: applicable && missing.length > 0,
      conditionReason: `Stage ${stage} requires roles: ${images.requiredRoles.join(",") || "none"}`,
      patientSafeSummary:
        missing.length > 0
          ? "Required image role(s) missing for current milestone"
          : "Required image roles satisfied or not applicable",
    });
    signals.push(imageSignal);
  } else {
    signals.push(
      buildSignal({
        key: "patient.required_image_role",
        label: "Required image roles",
        sourceSystem: "imaging_os",
        requirement: "not_applicable",
        status: "not_applicable",
        reasonCode: "images_not_required_at_stage",
        observedValueClass: "not_applicable",
        patientSafeSummary: "Image roles not required at current stage",
      })
    );
  }

  const inactiveDays = journey.patientInactiveDays;
  const inactive =
    inactiveDays != null && inactiveDays >= patientInactiveAttentionDays;
  const inactivity = buildSignal({
    key: "patient.inactivity",
    label: "Patient inactivity",
    sourceSystem: "patient_journey_control",
    requirement: "optional",
    status: inactive ? "pending" : "satisfied",
    reasonCode: inactive ? "patient_inactive" : "patient_active",
    observedValueClass: inactive ? "pending" : "present",
    blocking: false,
    severity: inactive ? "attention" : undefined,
    patientSafeSummary: inactive
      ? "Patient inactivity exceeds programme threshold (attention, not clinical failure)"
      : "Patient activity within threshold",
  });
  signals.push(inactivity);
  if (inactive) {
    warnings.push(
      warningFromSignal({ signal: inactivity, code: "patient_inactive", severity: "attention" })
    );
  }

  for (const s of signals) {
    if (
      s.blocking &&
      s.requirement !== "optional" &&
      s.status !== "satisfied" &&
      s.status !== "not_applicable"
    ) {
      blockers.push(
        blockerFromSignal({
          signal: s,
          category: s.key.includes("consent")
            ? "consent"
            : s.key.includes("image")
              ? "images"
              : s.key.includes("activation")
                ? "patient_activation"
                : "documents",
          severity: s.severity === "critical" ? "critical" : "high",
          owner: s.key.includes("consent") ? "clinical" : "patient",
          recommendedNextAction: "Complete required patient action for current milestone",
          criticalIntegrity: s.severity === "critical",
          evaluatedAt,
        })
      );
    }
  }

  return { signals, blockers, warnings };
}
