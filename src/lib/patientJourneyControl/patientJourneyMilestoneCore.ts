/**
 * FI-PATIENT-APP-P1 — derive patient-visible journey milestones from signals + flags.
 * Pure; never import server-only modules.
 */
import {
  PATIENT_JOURNEY_MILESTONE_KEYS,
  PATIENT_JOURNEY_MILESTONE_LABELS,
  type PatientJourneyMilestoneKey,
  type PatientJourneyMilestoneStatus,
  type PatientJourneyResponsibleRole,
} from "./patientJourneyControlContracts";

export type PatientJourneyMilestoneSignals = {
  consultCompleted?: boolean;
  treatmentRecommended?: boolean;
  quoteDelivered?: boolean;
  quoteAccepted?: boolean;
  depositPaid?: boolean;
  bloodRequestIssued?: boolean;
  pathologyResultsReceived?: boolean;
  clinicalReviewCompleted?: boolean;
  surgeryBooked?: boolean;
  preSurgeryDocumentsCompleted?: boolean;
  surgeryReadinessReady?: boolean;
  /** Open patient action for quote review (sets action_required on quote_sent). */
  quoteReviewOpen?: boolean;
  depositActionOpen?: boolean;
  bloodActionOpen?: boolean;
  documentActionOpen?: boolean;
  pathologyAwaitingClinic?: boolean;
};

export type PatientJourneyMilestone = {
  key: PatientJourneyMilestoneKey;
  status: PatientJourneyMilestoneStatus;
  responsibleRole: PatientJourneyResponsibleRole;
  dueAt: string | null;
  completedAt: string | null;
  patientLabel: string;
  linkedResourceType: string | null;
  linkedResourceId: string | null;
  primaryActionId: string | null;
};

export type DerivePatientJourneyMilestonesInput = {
  signals: PatientJourneyMilestoneSignals;
  resourceIds?: Partial<
    Record<PatientJourneyMilestoneKey, { type: string | null; id: string | null }>
  >;
  primaryActionIds?: Partial<Record<PatientJourneyMilestoneKey, string | null>>;
  dueAts?: Partial<Record<PatientJourneyMilestoneKey, string | null>>;
  completedAts?: Partial<Record<PatientJourneyMilestoneKey, string | null>>;
  nowIso?: string;
};

function completed(
  key: PatientJourneyMilestoneKey,
  input: DerivePatientJourneyMilestonesInput
): PatientJourneyMilestone {
  return {
    key,
    status: "completed",
    responsibleRole: roleFor(key),
    dueAt: input.dueAts?.[key] ?? null,
    completedAt: input.completedAts?.[key] ?? input.nowIso ?? null,
    patientLabel: PATIENT_JOURNEY_MILESTONE_LABELS[key],
    linkedResourceType: input.resourceIds?.[key]?.type ?? null,
    linkedResourceId: input.resourceIds?.[key]?.id ?? null,
    primaryActionId: input.primaryActionIds?.[key] ?? null,
  };
}

function statusFor(
  key: PatientJourneyMilestoneKey,
  s: PatientJourneyMilestoneSignals
): PatientJourneyMilestoneStatus {
  switch (key) {
    case "consultation_completed":
      return s.consultCompleted ? "completed" : "not_started";
    case "treatment_plan_prepared":
      if (s.treatmentRecommended) return "completed";
      if (s.consultCompleted) return "waiting_on_clinic";
      return "not_started";
    case "quote_sent":
      if (s.quoteAccepted || s.quoteDelivered) {
        if (s.quoteAccepted) return "completed";
        return s.quoteReviewOpen ? "action_required" : "waiting_on_patient";
      }
      if (s.treatmentRecommended) return "waiting_on_clinic";
      return "not_started";
    case "quote_accepted":
      if (s.quoteAccepted) return "completed";
      if (s.quoteDelivered) return s.quoteReviewOpen ? "action_required" : "waiting_on_patient";
      return "not_started";
    case "deposit_paid":
      if (s.depositPaid) return "completed";
      if (s.quoteAccepted) return s.depositActionOpen ? "action_required" : "waiting_on_patient";
      return "not_started";
    case "blood_request_issued":
      if (s.bloodRequestIssued) {
        if (s.pathologyResultsReceived || s.clinicalReviewCompleted) return "completed";
        return s.bloodActionOpen ? "action_required" : "waiting_on_patient";
      }
      if (s.quoteAccepted) return "waiting_on_clinic";
      return "not_started";
    case "results_received":
      if (s.pathologyResultsReceived) return "completed";
      if (s.bloodRequestIssued) return "waiting_on_patient";
      return "not_started";
    case "clinical_review_completed":
      if (s.clinicalReviewCompleted) return "completed";
      if (s.pathologyResultsReceived) {
        return s.pathologyAwaitingClinic ? "waiting_on_clinic" : "in_progress";
      }
      return "not_started";
    case "surgery_booked":
      if (s.surgeryBooked) return "completed";
      if (s.depositPaid || s.quoteAccepted) return "waiting_on_clinic";
      return "not_started";
    case "pre_surgery_documents_completed":
      if (s.preSurgeryDocumentsCompleted) return "completed";
      if (s.quoteAccepted) return s.documentActionOpen ? "action_required" : "waiting_on_patient";
      return "not_started";
    case "patient_cleared_for_surgery":
      if (s.surgeryReadinessReady) return "completed";
      if (s.surgeryBooked || s.clinicalReviewCompleted || s.preSurgeryDocumentsCompleted) {
        return "waiting_on_clinic";
      }
      return "not_started";
    default:
      return "not_started";
  }
}

function roleFor(key: PatientJourneyMilestoneKey): PatientJourneyResponsibleRole {
  switch (key) {
    case "consultation_completed":
    case "treatment_plan_prepared":
    case "clinical_review_completed":
    case "surgery_booked":
    case "patient_cleared_for_surgery":
      return "clinic";
    case "quote_sent":
    case "quote_accepted":
    case "deposit_paid":
    case "blood_request_issued":
    case "results_received":
    case "pre_surgery_documents_completed":
      return "patient";
    default:
      return "system";
  }
}

export function derivePatientJourneyMilestones(
  input: DerivePatientJourneyMilestonesInput
): PatientJourneyMilestone[] {
  const s = input.signals;
  return PATIENT_JOURNEY_MILESTONE_KEYS.map((key) => {
    const status = statusFor(key, s);
    if (status === "completed") return completed(key, input);
    return {
      key,
      status,
      responsibleRole: roleFor(key),
      dueAt: input.dueAts?.[key] ?? null,
      completedAt: null,
      patientLabel: PATIENT_JOURNEY_MILESTONE_LABELS[key],
      linkedResourceType: input.resourceIds?.[key]?.type ?? null,
      linkedResourceId: input.resourceIds?.[key]?.id ?? null,
      primaryActionId: input.primaryActionIds?.[key] ?? null,
    };
  });
}

const FORBIDDEN_MILESTONE_FRAGMENTS = [
  "internalNote",
  "derivedState",
  "manuallyOverridden",
  "blockers",
  "nextBestAction",
  "fi-admin",
  "abnormal",
  "aiInterpretation",
  "staffHref",
] as const;

/** True when a patient-facing milestone payload leaks staff-only fields. */
export function milestonePayloadExposesInternalFields(payload: unknown): boolean {
  const serialized = JSON.stringify(payload ?? null);
  if (!serialized) return false;
  return FORBIDDEN_MILESTONE_FRAGMENTS.some((f) => serialized.includes(f));
}