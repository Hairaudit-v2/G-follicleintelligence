/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — source provenance map for readiness dimensions.
 * Documents which SoR records feed each Control Centre dimension (reuse, not rebuild).
 */

import type { PilotSourceModule } from "./pilotControlContracts";

export type PilotReadinessSourceBinding = {
  dimension: string;
  sourceModule: PilotSourceModule;
  canonicalTables: readonly string[];
  reuseModulePath: string;
  notes: string;
};

/** Frozen audit of reused source systems for Control Centre aggregation. */
export const PILOT_READINESS_SOURCE_BINDINGS: readonly PilotReadinessSourceBinding[] = [
  {
    dimension: "pilot_membership",
    sourceModule: "pilot_enrolment",
    canonicalTables: ["fi_pilot_programmes", "fi_pilot_enrolments"],
    reuseModulePath: "src/lib/pilotControl/",
    notes: "Only explicit enrolment rows define the cohort. Never infer from activity.",
  },
  {
    dimension: "identity",
    sourceModule: "foundation_identity",
    canonicalTables: ["fi_patients", "fi_persons", "v_fi_patient_resolution"],
    reuseModulePath: "src/lib/fi/foundation/resolvePatient.ts",
    notes: "Fail closed on ambiguous resolution; no first-row identity pick.",
  },
  {
    dimension: "journey_milestone",
    sourceModule: "patient_journey_control",
    canonicalTables: ["fi_patient_journey_milestones", "fi_patient_actions"],
    reuseModulePath: "src/lib/patientJourneyControl/",
    notes: "Reuse P1 Journey Control SoR; do not invent parallel milestones.",
  },
  {
    dimension: "patient_app_activation",
    sourceModule: "patient_app_gateway",
    canonicalTables: ["fi_patients.portal_auth_user_id"],
    reuseModulePath: "src/lib/patientPortal/patientGatewayGate.server.ts",
    notes: "Activation = linked portal auth; invites remain out of scope for 1A.",
  },
  {
    dimension: "communication",
    sourceModule: "reception_inbox",
    canonicalTables: [
      "fi_patient_gateway_message_threads",
      "fi_patient_gateway_messages",
    ],
    reuseModulePath: "src/lib/receptionOs/ + patient gateway messaging",
    notes: "Unread ageing drives Reception attention queue.",
  },
  {
    dimension: "financial_readiness",
    sourceModule: "financial_os",
    canonicalTables: ["fi_financial_clearance_snapshots", "fi_crm_quotes"],
    reuseModulePath: "src/lib/financialOs/financialClearanceCore.ts",
    notes: "Advisory clearance remains SoR; Control Centre observes only.",
  },
  {
    dimension: "documents_consent",
    sourceModule: "documents",
    canonicalTables: [
      "fi_patient_document_packets",
      "fi_patient_document_sections",
      "fi_patient_documents",
    ],
    reuseModulePath: "src/lib/patients/patientConsentGate.server.ts",
    notes: "Mandatory vs optional sections must be distinguished in 1A.2.",
  },
  {
    dimension: "pathology",
    sourceModule: "pathology",
    canonicalTables: ["fi_pathology_requests", "fi_pathology_results"],
    reuseModulePath: "src/lib/pathology/",
    notes: "Unknown clearance must not map to ready.",
  },
  {
    dimension: "images",
    sourceModule: "imaging_os",
    canonicalTables: ["fi_patient_images", "v_fi_media_unified"],
    reuseModulePath: "src/lib/imaging-os/",
    notes: "Image readiness from ImagingOS / gateway uploads.",
  },
  {
    dimension: "appointments",
    sourceModule: "bookings",
    canonicalTables: ["fi_bookings"],
    reuseModulePath: "src/lib/bookings/ + patientGatewayAppointments",
    notes: "fi_bookings is canonical; no fi_appointments table.",
  },
  {
    dimension: "notifications",
    sourceModule: "notifications",
    canonicalTables: ["fi_patient_notifications", "fi_patient_notification_devices"],
    reuseModulePath: "src/lib/patientPortal/patientNotificationDispatch.server.ts",
    notes: "Failed delivery → technical attention, not silent pass.",
  },
  {
    dimension: "clinic_journey_readiness_projection",
    sourceModule: "patient_journey_control",
    canonicalTables: ["fi_patient_actions", "fi_patient_journey_milestones"],
    reuseModulePath: "src/lib/patientJourneyControl/clinicJourneyReadiness.server.ts",
    notes: "Existing clinic readiness board is a reuse input, not the pilot cohort.",
  },
];
