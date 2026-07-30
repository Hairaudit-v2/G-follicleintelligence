/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — injectable source bag for pure evaluation.
 * Server loaders populate this; unit tests supply fixtures. Never writes.
 */

import type { PilotEnrolmentStatus } from "../pilotControlContracts";
import type { FinancialClearanceState } from "@/src/lib/financialOs/financialClearanceCore";

export type IdentitySourceBag = {
  patientFound: boolean;
  patientTenantId: string | null;
  patientId: string | null;
  personId: string | null;
  ambiguousPatient: boolean;
  appAuthUserId: string | null;
  /** Count of patients sharing the same portal_auth_user_id within tenant. */
  appLinkagePatientCount: number;
  /** True when a resolution maps to a different tenant. */
  crossTenantMapping: boolean;
  /** Active enrolments for same programme+patient (should be 1). */
  activeEnrolmentCountForProgrammePatient: number;
  crmLeadPatientIdConflict: boolean;
  /** Source binding returned a different patient id than enrolment. */
  sourcePatientIdMismatch: boolean;
  profileErrorCode?: string | null;
};

export type JourneySourceBag = {
  milestones: readonly { milestoneKey: string; status: string; updatedAt?: string }[];
  openPatientActions: number;
  waitingOnClinicActions: number;
  overduePatientActions: number;
  overdueClinicActions: number;
  patientInactiveDays: number | null;
};

export type PathologySourceBag = {
  /** null = no pathology pathway / not required */
  required: boolean | null;
  requestId: string | null;
  requestWorkflowStatus: string | null;
  resultId: string | null;
  clearanceStatus: string | null;
  reviewed: boolean;
  superseded: boolean;
  clinicalEscalationActive: boolean;
  /** Latest clinical approval state: approved | pending | unknown | absent */
  clinicalApprovalState: "approved" | "pending" | "unknown" | "absent" | "superseded";
  consultationComplete: boolean;
};

export type FinancialSourceBag = {
  quoteId: string | null;
  quoteStatus: string | null;
  quotePatientId: string | null;
  clearanceState: FinancialClearanceState | null;
  clearanceSourceRecordId: string | null;
  depositVerified: boolean;
  depositRequired: boolean;
  unallocatedPaymentPresent: boolean;
  paymentPatientIdMismatch: boolean;
  reconciliationException: boolean;
  paymentPlanActive: boolean;
  paymentPlanSatisfiesClearance: boolean;
  stripeEnabled: boolean;
  stripeBranchOnlyCapability: boolean;
  dualPaymentSourceUnresolved: boolean;
};

export type ConsentDocumentSourceBag = {
  mandatoryConsentSatisfied: boolean | null;
  mandatoryConsentUnknown: boolean;
  consentWrongPatient: boolean;
  optionalDocumentMissing: boolean;
  packetId: string | null;
};

export type ImageSourceBag = {
  requiredRoles: readonly string[];
  satisfiedRoles: readonly string[];
  missingRoles: readonly string[];
};

export type AppointmentSourceBag = {
  bookings: readonly {
    id: string;
    patientId: string;
    bookingType: string;
    bookingStatus: string;
    startAt: string | null;
  }[];
  staffAssignmentKnown: boolean;
  staffAssigned: boolean;
};

export type NotificationTechnicalSourceBag = {
  failedPushCount: number;
  repeatedFailureCount: number;
  expectedSuccessEventPresent: boolean | null;
  crossPatientTechnicalLinkage: boolean;
  lastSuccessfulJourneyEventAt: string | null;
};

export type PilotReadinessSourceBag = {
  tenantId: string;
  programmeId: string;
  enrolmentId: string;
  patientId: string;
  enrolmentStatus: PilotEnrolmentStatus;
  evaluatedAt: string;
  identity: IdentitySourceBag;
  journey: JourneySourceBag;
  pathology: PathologySourceBag;
  financial: FinancialSourceBag;
  consentDocuments: ConsentDocumentSourceBag;
  images: ImageSourceBag;
  appointments: AppointmentSourceBag;
  technical: NotificationTechnicalSourceBag;
  /** Escalation thresholds (inactive days etc.) */
  patientInactiveAttentionDays: number;
  technicalFailureEscalateThreshold: number;
};
