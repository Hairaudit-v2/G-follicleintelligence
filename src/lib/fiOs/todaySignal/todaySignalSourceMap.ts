/**
 * FI-UX-REBUILD D6 — Phase 1 signal source audit (code-as-documentation).
 * Maps operational events to existing tables/actions and Today derivability.
 */

export type TodaySignalSourceEntry = {
  event: string;
  source: string;
  timestampFields: readonly string[];
  canDeriveTodaySignal: boolean;
  needsNewEventWrite: boolean;
  magicMomentKey?: string;
};

/** SIGNAL SOURCE MAP — raw events → Today feed derivability. */
export const TODAY_SIGNAL_SOURCE_MAP: readonly TodaySignalSourceEntry[] = [
  {
    event: "Patient QR / I'm here tap",
    source: "fi_bookings.metadata.fi_arrival_intent_at + POST /api/public/booking-arrival",
    timestampFields: ["fi_arrival_intent_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
    magicMomentKey: "patient_arrival_intent",
  },
  {
    event: "Reception check-in (mark_arrived)",
    source: "lib/actions/reception-board-flow-action.ts → fi_bookings.booking_status",
    timestampFields: ["updated_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
    magicMomentKey: "patient_checked_in",
  },
  {
    event: "Appointment status / phase change",
    source: "fi_bookings (status + metadata.fi_reception_flow_phase)",
    timestampFields: ["updated_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
  },
  {
    event: "Reception board flow transition",
    source: "receptionBoardFlowAction → fi_bookings",
    timestampFields: ["updated_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
  },
  {
    event: "Payment received / overdue",
    source: "fi_payment_records, fi_payment_requests, financial pipeline loaders",
    timestampFields: ["updated_at", "due_date"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
    magicMomentKey: "payment_blocker_cleared",
  },
  {
    event: "Surgery readiness blocker",
    source: "fi_bookings.case_id + surgery readiness board / clearance",
    timestampFields: ["start_at", "updated_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
    magicMomentKey: "surgery_readiness_changed",
  },
  {
    event: "Pathology result uploaded / review pending",
    source: "fi_pathology_results (reviewed_at, status)",
    timestampFields: ["created_at", "result_date", "reviewed_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
    magicMomentKey: "pathology_result_arrived",
  },
  {
    event: "Lead stale / follow-up due",
    source: "fi_crm_leads + fi_crm_lead_stage_history → staleLeads in dashboard loader",
    timestampFields: ["enteredStageAt", "created_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
    magicMomentKey: "lead_stale",
  },
  {
    event: "Consultation started / awaiting completion",
    source: "fi_consultations.status",
    timestampFields: ["updated_at", "consultation_date"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
  },
  {
    event: "Staff credential / compliance expiry",
    source: "fi_staff_compliance_alerts",
    timestampFields: ["created_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
  },
  {
    event: "Staff onboarding task complete",
    source: "fi_staff_compliance_alerts.resolved, workforce compliance runs",
    timestampFields: ["updated_at", "resolved_at"],
    canDeriveTodaySignal: true,
    needsNewEventWrite: false,
  },
];
