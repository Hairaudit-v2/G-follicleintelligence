/**
 * Sprint 6 — Unified Operational Readiness Score (pure, no I/O).
 * Measures whether a simulated clinic day has the artefacts needed for go-live.
 */

export type OperationalReadinessCriterion =
  | "booking_complete"
  | "consent_complete"
  | "payment_complete"
  | "staff_assigned"
  | "room_assigned"
  | "procedure_completed"
  | "follow_up_created";

export type OperationalReadinessCriterionResult = {
  id: OperationalReadinessCriterion;
  label: string;
  pass: boolean;
  detail: string;
};

export type OperationalReadinessInput = {
  consultBookingId?: string | null;
  surgeryBookingId?: string | null;
  consentSigned?: boolean;
  depositRecorded?: boolean;
  paymentStatus?: string | null;
  staffAssigned?: boolean;
  roomAssigned?: boolean;
  procedureDayCompleted?: boolean;
  patientJourneyState?: string | null;
  followUpTaskId?: string | null;
  calendarBlockerCount?: number | null;
};

export const OPERATIONAL_READINESS_CRITERIA: {
  id: OperationalReadinessCriterion;
  label: string;
}[] = [
  { id: "booking_complete", label: "Booking complete" },
  { id: "consent_complete", label: "Consent complete" },
  { id: "payment_complete", label: "Payment complete" },
  { id: "staff_assigned", label: "Staff assigned" },
  { id: "room_assigned", label: "Room assigned" },
  { id: "procedure_completed", label: "Procedure completed" },
  { id: "follow_up_created", label: "Follow-up created" },
];

function isPaid(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "paid" || s === "satisfied" || s === "complete" || s === "completed";
}

export function scoreOperationalReadiness(
  input: OperationalReadinessInput
): {
  criteria: OperationalReadinessCriterionResult[];
  passed: number;
  total: number;
  percent: number;
  ready: boolean;
} {
  const bookingComplete = Boolean(input.consultBookingId?.trim() && input.surgeryBookingId?.trim());
  const consentComplete = input.consentSigned === true;
  const paymentComplete =
    input.depositRecorded === true || isPaid(input.paymentStatus);
  const staffAssigned = input.staffAssigned === true;
  const roomAssigned = input.roomAssigned === true;
  const procedureCompleted =
    input.procedureDayCompleted === true ||
    String(input.patientJourneyState ?? "").trim() === "procedure_completed";
  const followUpCreated = Boolean(input.followUpTaskId?.trim());

  const criteria: OperationalReadinessCriterionResult[] = [
    {
      id: "booking_complete",
      label: "Booking complete",
      pass: bookingComplete,
      detail: bookingComplete
        ? "Consultation and surgery bookings exist."
        : "Missing consultation and/or surgery booking.",
    },
    {
      id: "consent_complete",
      label: "Consent complete",
      pass: consentComplete,
      detail: consentComplete ? "Consent flag satisfied." : "Consent not recorded.",
    },
    {
      id: "payment_complete",
      label: "Payment complete",
      pass: paymentComplete,
      detail: paymentComplete ? "Deposit or payment recorded." : "No deposit/payment on file.",
    },
    {
      id: "staff_assigned",
      label: "Staff assigned",
      pass: staffAssigned,
      detail: staffAssigned ? "Surgery booking has assigned staff." : "Staff not assigned.",
    },
    {
      id: "room_assigned",
      label: "Room assigned",
      pass: roomAssigned,
      detail: roomAssigned ? "Surgery booking has room." : "Room not assigned.",
    },
    {
      id: "procedure_completed",
      label: "Procedure completed",
      pass: procedureCompleted,
      detail: procedureCompleted
        ? "Procedure day completed or journey at procedure_completed."
        : "Procedure not completed.",
    },
    {
      id: "follow_up_created",
      label: "Follow-up created",
      pass: followUpCreated,
      detail: followUpCreated ? "Post-op follow-up CRM task created." : "No follow-up task.",
    },
  ];

  const passed = criteria.filter((c) => c.pass).length;
  const total = criteria.length;
  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
  const calendarOk =
    input.calendarBlockerCount == null || input.calendarBlockerCount === 0;

  return {
    criteria,
    passed,
    total,
    percent,
    ready: passed === total && calendarOk,
  };
}

export function formatOperationalReadinessReport(score: ReturnType<typeof scoreOperationalReadiness>): string {
  const lines = [
    `Operational Readiness: ${score.passed}/${score.total} (${score.percent}%) — ${score.ready ? "READY" : "NOT READY"}`,
    "",
    "| Criterion | Status | Detail |",
    "|-----------|--------|--------|",
  ];
  for (const c of score.criteria) {
    lines.push(`| ${c.label} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`);
  }
  return lines.join("\n");
}