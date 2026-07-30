/**
 * Deterministic fixture bags for 1A.2 readiness tests (synthetic only).
 */

import {
  PILOT_SYNTHETIC_PROGRAMME_ID,
  PILOT_SYNTHETIC_TENANT_ID,
} from "../pilotSyntheticCohort";
import type { PilotEnrolmentStatus } from "../pilotControlContracts";
import type { PilotReadinessSourceBag } from "./readinessSourceBag";

const NOW = "2026-07-30T12:00:00.000Z";

export function baseReadySourceBag(
  overrides: Partial<PilotReadinessSourceBag> = {}
): PilotReadinessSourceBag {
  const patientId = "d0000000-0000-4000-8000-000000000001";
  const base: PilotReadinessSourceBag = {
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    programmeId: PILOT_SYNTHETIC_PROGRAMME_ID,
    enrolmentId: "c0000000-0000-4000-8000-000000000001",
    patientId,
    enrolmentStatus: "active",
    evaluatedAt: NOW,
    patientInactiveAttentionDays: 3,
    technicalFailureEscalateThreshold: 3,
    identity: {
      patientFound: true,
      patientTenantId: PILOT_SYNTHETIC_TENANT_ID,
      patientId,
      personId: "p0000000-0000-4000-8000-000000000001",
      ambiguousPatient: false,
      appAuthUserId: "auth-user-1",
      appLinkagePatientCount: 1,
      crossTenantMapping: false,
      activeEnrolmentCountForProgrammePatient: 1,
      crmLeadPatientIdConflict: false,
      sourcePatientIdMismatch: false,
    },
    journey: {
      milestones: [
        { milestoneKey: "consultation_completed", status: "completed" },
        { milestoneKey: "quote_accepted", status: "completed" },
        { milestoneKey: "deposit_paid", status: "completed" },
        { milestoneKey: "clinical_review_completed", status: "completed" },
        { milestoneKey: "pre_surgery_documents_completed", status: "completed" },
        { milestoneKey: "surgery_booked", status: "completed" },
      ],
      openPatientActions: 0,
      waitingOnClinicActions: 0,
      overduePatientActions: 0,
      overdueClinicActions: 0,
      patientInactiveDays: 0,
    },
    pathology: {
      required: false,
      requestId: null,
      requestWorkflowStatus: null,
      resultId: null,
      clearanceStatus: null,
      reviewed: false,
      superseded: false,
      clinicalEscalationActive: false,
      clinicalApprovalState: "approved",
      consultationComplete: true,
    },
    financial: {
      quoteId: "q0000000-0000-4000-8000-000000000001",
      quoteStatus: "accepted",
      quotePatientId: patientId,
      clearanceState: "financially_cleared",
      clearanceSourceRecordId: "clr-1",
      depositVerified: true,
      depositRequired: true,
      unallocatedPaymentPresent: false,
      paymentPatientIdMismatch: false,
      reconciliationException: false,
      paymentPlanActive: false,
      paymentPlanSatisfiesClearance: false,
      stripeEnabled: false,
      stripeBranchOnlyCapability: false,
      dualPaymentSourceUnresolved: false,
    },
    consentDocuments: {
      mandatoryConsentSatisfied: true,
      mandatoryConsentUnknown: false,
      consentWrongPatient: false,
      optionalDocumentMissing: false,
      packetId: "pkt-1",
    },
    images: {
      requiredRoles: ["preop_front"],
      satisfiedRoles: ["preop_front"],
      missingRoles: [],
    },
    appointments: {
      bookings: [
        {
          id: "bk-1",
          patientId,
          bookingType: "surgery",
          bookingStatus: "confirmed",
          startAt: "2026-08-15T00:00:00.000Z",
        },
      ],
      staffAssignmentKnown: false,
      staffAssigned: false,
    },
    technical: {
      failedPushCount: 0,
      repeatedFailureCount: 0,
      expectedSuccessEventPresent: true,
      crossPatientTechnicalLinkage: false,
      lastSuccessfulJourneyEventAt: NOW,
    },
  };

  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...(overrides.identity ?? {}) },
    journey: { ...base.journey, ...(overrides.journey ?? {}) },
    pathology: { ...base.pathology, ...(overrides.pathology ?? {}) },
    financial: { ...base.financial, ...(overrides.financial ?? {}) },
    consentDocuments: {
      ...base.consentDocuments,
      ...(overrides.consentDocuments ?? {}),
    },
    images: { ...base.images, ...(overrides.images ?? {}) },
    appointments: {
      ...base.appointments,
      ...(overrides.appointments ?? {}),
      bookings: overrides.appointments?.bookings ?? base.appointments.bookings,
    },
    technical: { ...base.technical, ...(overrides.technical ?? {}) },
  };
}

export function consultationStageBag(
  overrides: Partial<PilotReadinessSourceBag> = {}
): PilotReadinessSourceBag {
  return baseReadySourceBag({
    enrolmentStatus: "activated" as PilotEnrolmentStatus,
    journey: {
      milestones: [{ milestoneKey: "consultation_completed", status: "in_progress" }],
      openPatientActions: 1,
      waitingOnClinicActions: 0,
      overduePatientActions: 0,
      overdueClinicActions: 0,
      patientInactiveDays: 0,
    },
    pathology: {
      required: false,
      requestId: null,
      requestWorkflowStatus: null,
      resultId: null,
      clearanceStatus: null,
      reviewed: false,
      superseded: false,
      clinicalEscalationActive: false,
      clinicalApprovalState: "absent",
      consultationComplete: false,
    },
    financial: {
      quoteId: null,
      quoteStatus: null,
      quotePatientId: null,
      clearanceState: null,
      clearanceSourceRecordId: null,
      depositVerified: false,
      depositRequired: false,
      unallocatedPaymentPresent: false,
      paymentPatientIdMismatch: false,
      reconciliationException: false,
      paymentPlanActive: false,
      paymentPlanSatisfiesClearance: false,
      stripeEnabled: false,
      stripeBranchOnlyCapability: false,
      dualPaymentSourceUnresolved: false,
    },
    consentDocuments: {
      mandatoryConsentSatisfied: false,
      mandatoryConsentUnknown: false,
      consentWrongPatient: false,
      optionalDocumentMissing: true,
      packetId: null,
    },
    images: {
      requiredRoles: ["intake_face"],
      satisfiedRoles: ["intake_face"],
      missingRoles: [],
    },
    appointments: {
      bookings: [],
      staffAssignmentKnown: false,
      staffAssigned: false,
    },
    ...overrides,
  });
}
