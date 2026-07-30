/**
 * Operational readiness — appointments, staff, clinic actions (pure).
 */

import { requirementForSignal } from "../readinessMilestones";
import type { PilotJourneyStage } from "../readinessTypes";
import { buildSignal, blockerFromSignal, warningFromSignal } from "../signalHelpers";
import type { AppointmentSourceBag, ConsentDocumentSourceBag, JourneySourceBag } from "../readinessSourceBag";
import type { PilotBlocker, PilotReadinessWarning, ReadinessSignalResult } from "../readinessTypes";

export type OperationalAdapterResult = {
  signals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
};

export function resolveOperationalSignals(args: {
  appointments: AppointmentSourceBag;
  journey: JourneySourceBag;
  consent: ConsentDocumentSourceBag;
  stage: PilotJourneyStage;
  evaluatedAt: string;
}): OperationalAdapterResult {
  const { appointments, journey, consent, stage, evaluatedAt } = args;
  const signals: ReadinessSignalResult[] = [];
  const blockers: PilotBlocker[] = [];
  const warnings: PilotReadinessWarning[] = [];

  const procedureLike = stage === "procedure_preparation";
  const preConsult =
    stage === "pre_invitation" || stage === "consultation_preparation";

  const surgeryBookings = appointments.bookings.filter((b) =>
    /surgery|procedure/i.test(b.bookingType)
  );
  const consultBookings = appointments.bookings.filter((b) =>
    /consult/i.test(b.bookingType)
  );
  const relevant = procedureLike
    ? surgeryBookings.length
      ? surgeryBookings
      : appointments.bookings
    : consultBookings.length
      ? consultBookings
      : appointments.bookings;

  const existsRule = requirementForSignal(stage, "operational.appointment_exists");
  if (existsRule) {
    const has = relevant.length > 0;
    const exists = buildSignal({
      key: "operational.appointment_exists",
      label: "Appointment exists",
      sourceSystem: "bookings",
      requirement: preConsult ? "not_applicable" : existsRule.requirement,
      status: preConsult
        ? has
          ? "satisfied"
          : "not_applicable"
        : has
          ? "satisfied"
          : "missing",
      reasonCode: preConsult
        ? has
          ? "appointment_present_optional"
          : "appointment_not_required_pre_consult"
        : has
          ? "appointment_present"
          : "appointment_missing",
      observedValueClass: preConsult
        ? has
          ? "present"
          : "not_applicable"
        : has
          ? "present"
          : "absent",
      sourceTable: "fi_bookings",
      sourceRecordId: relevant[0]?.id,
      blocking: !preConsult && !has && procedureLike,
      patientSafeSummary: preConsult
        ? "Missing appointment does not block pre-consultation candidate"
        : has
          ? "Appointment present"
          : "Required appointment missing",
    });
    signals.push(exists);
  }

  const confirmRule = requirementForSignal(stage, "operational.appointment_confirmed");
  if (confirmRule && confirmRule.requirement !== "not_applicable") {
    const confirmed = relevant.some(
      (b) => b.bookingStatus === "confirmed" || b.bookingStatus === "arrived"
    );
    const scheduled = relevant.some((b) => b.bookingStatus === "scheduled");
    const conf = buildSignal({
      key: "operational.appointment_confirmed",
      label: "Appointment confirmed",
      sourceSystem: "bookings",
      requirement: procedureLike ? "mandatory" : "conditional",
      status: confirmed
        ? "satisfied"
        : scheduled
          ? "pending"
          : relevant.length === 0
            ? procedureLike
              ? "missing"
              : "not_applicable"
            : "pending",
      reasonCode: confirmed
        ? "appointment_confirmed"
        : scheduled
          ? "appointment_unconfirmed"
          : "appointment_absent",
      observedValueClass: confirmed
        ? "approved"
        : scheduled
          ? "pending"
          : "absent",
      sourceTable: "fi_bookings",
      sourceField: "booking_status",
      sourceRecordId: relevant[0]?.id,
      blocking: procedureLike && !confirmed,
      patientSafeSummary:
        procedureLike && !confirmed
          ? "Unconfirmed procedure appointment blocks procedure readiness"
          : confirmed
            ? "Appointment confirmed"
            : "Appointment confirmation pending or not required",
    });
    signals.push(conf);
  }

  const staff = buildSignal({
    key: "operational.staff_assignment",
    label: "Required staff assignment",
    sourceSystem: "bookings",
    requirement: "conditional",
    status: !appointments.staffAssignmentKnown
      ? "unknown"
      : appointments.staffAssigned
        ? "satisfied"
        : "missing",
    reasonCode: !appointments.staffAssignmentKnown
      ? "staff_assignment_source_unavailable"
      : appointments.staffAssigned
        ? "staff_assigned"
        : "staff_unassigned",
    observedValueClass: !appointments.staffAssignmentKnown
      ? "unknown"
      : appointments.staffAssigned
        ? "present"
        : "absent",
    sourceTable: "fi_bookings",
    blocking: false,
    patientSafeSummary: !appointments.staffAssignmentKnown
      ? "Staff assignment remains unknown — no canonical scheduling record"
      : appointments.staffAssigned
        ? "Staff assigned"
        : "Staff not assigned",
  });
  signals.push(staff);

  const clinicOverdue = journey.overdueClinicActions > 0;
  const clinic = buildSignal({
    key: "operational.clinic_action_overdue",
    label: "Required clinic actions",
    sourceSystem: "patient_journey_control",
    requirement: "optional",
    status: clinicOverdue ? "pending" : "satisfied",
    reasonCode: clinicOverdue ? "clinic_action_overdue" : "clinic_actions_ok",
    observedValueClass: clinicOverdue ? "pending" : "present",
    sourceTable: "fi_patient_actions",
    blocking: false,
    severity: clinicOverdue ? "attention" : undefined,
    patientSafeSummary: clinicOverdue
      ? "Required clinic action overdue — escalation"
      : "No overdue clinic actions",
  });
  signals.push(clinic);
  if (clinicOverdue) {
    warnings.push(
      warningFromSignal({
        signal: clinic,
        code: "clinic_action_overdue",
        severity: "attention",
      })
    );
  }

  const consentGate = buildSignal({
    key: "operational.consent_gate_for_procedure",
    label: "Procedure consent gate",
    sourceSystem: "consent",
    requirement: procedureLike ? "mandatory" : "not_applicable",
    status: !procedureLike
      ? "not_applicable"
      : consent.mandatoryConsentUnknown
        ? "unknown"
        : consent.mandatoryConsentSatisfied
          ? "satisfied"
          : "missing",
    reasonCode: !procedureLike
      ? "consent_gate_not_applicable"
      : consent.mandatoryConsentSatisfied
        ? "consent_gate_ok"
        : "consent_incomplete_blocks_surgery_ready",
    observedValueClass: !procedureLike
      ? "not_applicable"
      : consent.mandatoryConsentSatisfied
        ? "approved"
        : consent.mandatoryConsentUnknown
          ? "unknown"
          : "absent",
    sourceTable: "fi_patient_document_packets",
    blocking: procedureLike && !consent.mandatoryConsentSatisfied,
    patientSafeSummary:
      procedureLike && !consent.mandatoryConsentSatisfied
        ? "Surgery readiness cannot become ready while consent is incomplete"
        : "Consent gate satisfied or not applicable",
  });
  signals.push(consentGate);

  for (const s of signals) {
    if (
      s.blocking &&
      s.status !== "satisfied" &&
      s.status !== "not_applicable" &&
      s.requirement !== "optional"
    ) {
      blockers.push(
        blockerFromSignal({
          signal: s,
          category: s.key.includes("consent")
            ? "consent"
            : s.key.includes("appointment")
              ? "appointment"
              : "clinic_action_overdue",
          severity: "high",
          owner: "reception",
          recommendedNextAction: "Complete operational requirement for current stage",
          evaluatedAt,
        })
      );
    }
  }

  return { signals, blockers, warnings };
}
