/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — journey-stage → requirement map (pure).
 * Derived from frozen journey milestone keys + source bindings. Fail closed on unknown stage.
 */

import type { PatientJourneyMilestoneKey } from "@/src/lib/patientJourneyControl/patientJourneyControlContracts";

import type { PilotJourneyStage, ReadinessSignalRequirement } from "./readinessTypes";
import type { PilotEnrolmentStatus } from "../pilotControlContracts";

export type ReadinessSignalKey =
  | "identity.patient_exists"
  | "identity.tenant_match"
  | "identity.enrolment_patient_match"
  | "identity.unique_patient"
  | "identity.app_linkage_unique"
  | "identity.no_cross_tenant_mapping"
  | "identity.no_duplicate_active_enrolment"
  | "clinical.consultation_complete"
  | "clinical.pathology_requirement"
  | "clinical.pathology_receipt"
  | "clinical.pathology_review"
  | "clinical.pathology_clearance"
  | "clinical.clinical_escalation"
  | "clinical.clinical_approval"
  | "financial.accepted_quote"
  | "financial.deposit_verified"
  | "financial.clearance"
  | "financial.unallocated_payment"
  | "financial.wrong_patient_payment"
  | "financial.reconciliation_exception"
  | "financial.payment_plan"
  | "financial.stripe_not_required"
  | "patient.invitation_state"
  | "patient.app_activation"
  | "patient.mandatory_consent"
  | "patient.optional_document"
  | "patient.required_image_role"
  | "patient.inactivity"
  | "operational.appointment_exists"
  | "operational.appointment_confirmed"
  | "operational.staff_assignment"
  | "operational.clinic_action_overdue"
  | "operational.consent_gate_for_procedure"
  | "technical.failed_push"
  | "technical.repeated_failure"
  | "technical.expected_success_event"
  | "technical.cross_patient_linkage";

export type MilestoneRequirementRule = {
  signalKey: ReadinessSignalKey;
  requirement: ReadinessSignalRequirement;
  blockingWhenUnsatisfied: boolean;
  notes: string;
};

const PRE_INVITATION: readonly MilestoneRequirementRule[] = [
  { signalKey: "identity.patient_exists", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.tenant_match", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.enrolment_patient_match", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.unique_patient", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.no_cross_tenant_mapping", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.no_duplicate_active_enrolment", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "patient.invitation_state", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "Invites disabled — not patient failure" },
  { signalKey: "patient.app_activation", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Pre-invitation" },
  { signalKey: "patient.mandatory_consent", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Pre-invitation" },
  { signalKey: "patient.required_image_role", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Pre-invitation" },
  { signalKey: "financial.deposit_verified", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Pre-invitation" },
  { signalKey: "clinical.pathology_clearance", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Pre-invitation" },
  { signalKey: "operational.appointment_exists", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Pre-consultation" },
  { signalKey: "financial.stripe_not_required", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Stripe never required for Money" },
];

const CONSULTATION_PREP: readonly MilestoneRequirementRule[] = [
  ...PRE_INVITATION.filter((r) => !r.signalKey.startsWith("patient.") && !r.signalKey.startsWith("operational.") && r.signalKey !== "financial.deposit_verified" && r.signalKey !== "clinical.pathology_clearance"),
  { signalKey: "patient.invitation_state", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "May be invited" },
  { signalKey: "patient.app_activation", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "When pathway requires app" },
  { signalKey: "patient.required_image_role", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "Consultation intake images only" },
  { signalKey: "patient.mandatory_consent", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Surgery consent not yet" },
  { signalKey: "clinical.consultation_complete", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "In progress toward consult" },
  { signalKey: "clinical.pathology_requirement", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "Only if workflow requires" },
  { signalKey: "operational.appointment_exists", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "Consult booking preferred" },
  { signalKey: "financial.deposit_verified", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Procedure deposit not yet" },
  { signalKey: "financial.stripe_not_required", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Stripe never required" },
  { signalKey: "patient.optional_document", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Must not block" },
  { signalKey: "patient.inactivity", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Attention only" },
  { signalKey: "technical.failed_push", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Attention" },
];

const PROCEDURE_PREP: readonly MilestoneRequirementRule[] = [
  { signalKey: "identity.patient_exists", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.tenant_match", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.enrolment_patient_match", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.unique_patient", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.no_cross_tenant_mapping", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.no_duplicate_active_enrolment", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "clinical.pathology_requirement", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "N/A when not required" },
  { signalKey: "clinical.pathology_receipt", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "When required" },
  { signalKey: "clinical.pathology_review", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "When received" },
  { signalKey: "clinical.pathology_clearance", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "When required" },
  { signalKey: "clinical.clinical_escalation", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Blocks when active" },
  { signalKey: "clinical.clinical_approval", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Unknown ≠ ready" },
  { signalKey: "financial.accepted_quote", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Accepted state required" },
  { signalKey: "financial.deposit_verified", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Manual Money ok" },
  { signalKey: "financial.clearance", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Canonical clearance" },
  { signalKey: "financial.unallocated_payment", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Must not clear" },
  { signalKey: "financial.wrong_patient_payment", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Critical" },
  { signalKey: "financial.reconciliation_exception", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Per frozen contract" },
  { signalKey: "financial.payment_plan", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "If plan permits" },
  { signalKey: "financial.stripe_not_required", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Never blocks Money" },
  { signalKey: "patient.mandatory_consent", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Procedure consent" },
  { signalKey: "patient.required_image_role", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "Pre-op roles" },
  { signalKey: "patient.app_activation", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "When pathway requires app" },
  { signalKey: "patient.optional_document", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Must not block" },
  { signalKey: "patient.inactivity", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Attention" },
  { signalKey: "operational.appointment_confirmed", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Procedure booking" },
  { signalKey: "operational.consent_gate_for_procedure", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Cannot be ready without consent" },
  { signalKey: "operational.staff_assignment", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "Unknown if no SoR" },
  { signalKey: "operational.clinic_action_overdue", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Escalation" },
  { signalKey: "technical.failed_push", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Attention" },
  { signalKey: "technical.repeated_failure", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Escalate" },
  { signalKey: "technical.cross_patient_linkage", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Critical" },
];

const POSTOP: readonly MilestoneRequirementRule[] = [
  { signalKey: "identity.patient_exists", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.tenant_match", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "identity.unique_patient", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Always" },
  { signalKey: "patient.required_image_role", requirement: "conditional", blockingWhenUnsatisfied: true, notes: "Follow-up images" },
  { signalKey: "financial.deposit_verified", requirement: "not_applicable", blockingWhenUnsatisfied: false, notes: "Post-op" },
  { signalKey: "operational.appointment_confirmed", requirement: "conditional", blockingWhenUnsatisfied: false, notes: "Follow-up booking" },
  { signalKey: "clinical.clinical_escalation", requirement: "mandatory", blockingWhenUnsatisfied: true, notes: "Blocks when active" },
  { signalKey: "financial.stripe_not_required", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Never blocks" },
  { signalKey: "technical.failed_push", requirement: "optional", blockingWhenUnsatisfied: false, notes: "Attention" },
];

export const PILOT_STAGE_REQUIREMENT_MAP: Record<
  Exclude<PilotJourneyStage, "unknown" | "completed">,
  readonly MilestoneRequirementRule[]
> = {
  pre_invitation: PRE_INVITATION,
  consultation_preparation: CONSULTATION_PREP,
  procedure_preparation: PROCEDURE_PREP,
  postoperative_follow_up: POSTOP,
};

/** Map enrolment + milestone progress → Control Centre journey stage. */
export function resolvePilotJourneyStage(args: {
  enrolmentStatus: PilotEnrolmentStatus;
  milestones: readonly { milestoneKey: string; status: string }[];
}): PilotJourneyStage {
  if (args.enrolmentStatus === "completed") return "completed";
  if (args.enrolmentStatus === "candidate" || args.enrolmentStatus === "approved") {
    return "pre_invitation";
  }

  const byKey = new Map(args.milestones.map((m) => [m.milestoneKey, m.status]));
  const done = (key: PatientJourneyMilestoneKey) => byKey.get(key) === "completed";

  if (done("patient_cleared_for_surgery") || done("surgery_booked")) {
    // After surgery booked / cleared — still procedure prep until completed enrolment.
    // Post-op is reserved when consultation path is fully past and no surgery milestone active;
    // without a dedicated postop milestone in P1 keys, treat cleared+completed enrolment only.
    if (!done("consultation_completed") && !done("quote_accepted")) {
      return "consultation_preparation";
    }
    return "procedure_preparation";
  }

  if (
    done("quote_accepted") ||
    done("deposit_paid") ||
    done("blood_request_issued") ||
    done("clinical_review_completed") ||
    done("pre_surgery_documents_completed")
  ) {
    return "procedure_preparation";
  }

  if (
    args.enrolmentStatus === "invited" ||
    args.enrolmentStatus === "activated" ||
    args.enrolmentStatus === "active" ||
    args.enrolmentStatus === "paused"
  ) {
    if (done("consultation_completed") || done("treatment_plan_prepared") || done("quote_sent")) {
      return "consultation_preparation";
    }
    // Invited/activated without journey progress: consultation prep (app/forms may apply).
    if (args.enrolmentStatus === "invited") return "consultation_preparation";
    return "consultation_preparation";
  }

  return "unknown";
}

export function requirementForSignal(
  stage: PilotJourneyStage,
  signalKey: ReadinessSignalKey
): MilestoneRequirementRule | null {
  if (stage === "completed") {
    return {
      signalKey,
      requirement: "not_applicable",
      blockingWhenUnsatisfied: false,
      notes: "Journey completed",
    };
  }
  if (stage === "unknown") {
    // Fail closed: unknown stage treats identity as mandatory; other signals unknown/mandatory where listed in procedure set.
    if (signalKey.startsWith("identity.")) {
      return {
        signalKey,
        requirement: "mandatory",
        blockingWhenUnsatisfied: true,
        notes: "Unknown stage — identity still mandatory",
      };
    }
    return {
      signalKey,
      requirement: "mandatory",
      blockingWhenUnsatisfied: true,
      notes: "Unknown stage — fail closed on applicable signals",
    };
  }
  const rules = PILOT_STAGE_REQUIREMENT_MAP[stage];
  return rules.find((r) => r.signalKey === signalKey) ?? null;
}
