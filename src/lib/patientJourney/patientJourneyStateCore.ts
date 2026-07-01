/**
 * Patient Journey State Engine — pure lifecycle model.
 * Canonical states power Reception Board, PatientOS, ConsultationOS, SurgeryOS, and AnalyticsOS.
 */

export const PATIENT_JOURNEY_STATES = [
  "lead",
  "consult_booked",
  "consult_completed",
  "treatment_recommended",
  "quote_sent",
  "quote_accepted",
  "deposit_paid",
  "surgery_booked",
  "pre_op_incomplete",
  "pre_op_ready",
  "procedure_day",
  "procedure_completed",
  "post_op_follow_up_due",
  "three_month_review_due",
  "six_month_review_due",
  "twelve_month_audit_due",
  "completed",
  "lost",
  "inactive",
] as const;

export type PatientJourneyState = (typeof PATIENT_JOURNEY_STATES)[number];

export const PATIENT_JOURNEY_TRANSITION_REASONS = [
  "initial",
  "lead_created",
  "consultation_booked",
  "consultation_completed",
  "treatment_recommended",
  "quote_sent",
  "quote_accepted",
  "deposit_received",
  "surgery_booked",
  "pre_op_checklist_updated",
  "surgery_readiness_ready",
  "procedure_day_started",
  "procedure_completed",
  "follow_up_due",
  "review_due",
  "journey_completed",
  "marked_lost",
  "marked_inactive",
  "manual_override",
  "automation_sync",
] as const;

export type PatientJourneyTransitionReason = (typeof PATIENT_JOURNEY_TRANSITION_REASONS)[number];

export type PatientJourneyBlockerKind =
  | "missing_consent"
  | "unpaid_deposit"
  | "no_surgery_date"
  | "missing_images"
  | "incomplete_pre_op_checklist"
  | "missing_follow_up_booking"
  | "missing_medical_clearance";

export type PatientJourneyBlocker = {
  kind: PatientJourneyBlockerKind;
  label: string;
  severity: "info" | "warning" | "critical";
  href: string | null;
};

export type PatientJourneySignals = {
  hasLead: boolean;
  leadLost: boolean;
  consultBooked: boolean;
  consultCompleted: boolean;
  treatmentRecommended: boolean;
  quoteSent: boolean;
  quoteAccepted: boolean;
  depositPaid: boolean;
  surgeryBooked: boolean;
  surgeryDateYmd: string | null;
  preOpChecklistComplete: boolean;
  surgeryReadinessReady: boolean;
  procedureDayToday: boolean;
  procedureCompleted: boolean;
  postOpFollowUpDue: boolean;
  threeMonthReviewDue: boolean;
  sixMonthReviewDue: boolean;
  twelveMonthAuditDue: boolean;
  hasRecentActivity: boolean;
  imagingComplete: boolean;
  consentSigned: boolean;
  followUpBooked: boolean;
};

export type PatientJourneyPresentation = {
  state: PatientJourneyState;
  label: string;
  tone: "neutral" | "info" | "warning" | "success" | "critical";
  description: string;
};

export const PATIENT_JOURNEY_STATE_LABELS: Record<PatientJourneyState, string> = {
  lead: "Lead",
  consult_booked: "Consultation booked",
  consult_completed: "Consultation completed",
  treatment_recommended: "Treatment recommended",
  quote_sent: "Quote sent",
  quote_accepted: "Quote accepted",
  deposit_paid: "Deposit paid",
  surgery_booked: "Surgery booked",
  pre_op_incomplete: "Pre-op incomplete",
  pre_op_ready: "Pre-op ready",
  procedure_day: "Procedure day",
  procedure_completed: "Procedure completed",
  post_op_follow_up_due: "Post-op follow-up due",
  three_month_review_due: "3-month review due",
  six_month_review_due: "6-month review due",
  twelve_month_audit_due: "12-month audit due",
  completed: "Journey completed",
  lost: "Lost",
  inactive: "Inactive",
};

const STATE_RANK: Record<PatientJourneyState, number> = {
  lead: 10,
  consult_booked: 20,
  consult_completed: 30,
  treatment_recommended: 35,
  quote_sent: 40,
  quote_accepted: 50,
  deposit_paid: 55,
  surgery_booked: 60,
  pre_op_incomplete: 65,
  pre_op_ready: 70,
  procedure_day: 75,
  procedure_completed: 80,
  post_op_follow_up_due: 85,
  three_month_review_due: 90,
  six_month_review_due: 92,
  twelve_month_audit_due: 94,
  completed: 100,
  lost: 5,
  inactive: 3,
};

/** Forward lifecycle transitions allowed without manual override. */
export const PATIENT_JOURNEY_ALLOWED_TRANSITIONS: Partial<
  Record<PatientJourneyState, readonly PatientJourneyState[]>
> = {
  lead: ["consult_booked", "lost", "inactive"],
  consult_booked: ["consult_completed", "lost", "inactive"],
  consult_completed: ["treatment_recommended", "quote_sent", "lost", "inactive"],
  treatment_recommended: ["quote_sent", "quote_accepted", "lost", "inactive"],
  quote_sent: ["quote_accepted", "deposit_paid", "lost", "inactive"],
  quote_accepted: ["deposit_paid", "surgery_booked", "lost", "inactive"],
  deposit_paid: ["surgery_booked", "pre_op_incomplete", "lost", "inactive"],
  surgery_booked: ["pre_op_incomplete", "pre_op_ready", "procedure_day", "lost", "inactive"],
  pre_op_incomplete: ["pre_op_ready", "procedure_day", "lost", "inactive"],
  pre_op_ready: ["procedure_day", "lost", "inactive"],
  procedure_day: ["procedure_completed", "lost", "inactive"],
  procedure_completed: [
    "post_op_follow_up_due",
    "three_month_review_due",
    "six_month_review_due",
    "twelve_month_audit_due",
    "completed",
    "inactive",
  ],
  post_op_follow_up_due: [
    "three_month_review_due",
    "six_month_review_due",
    "twelve_month_audit_due",
    "completed",
    "inactive",
  ],
  three_month_review_due: ["six_month_review_due", "twelve_month_audit_due", "completed", "inactive"],
  six_month_review_due: ["twelve_month_audit_due", "completed", "inactive"],
  twelve_month_audit_due: ["completed", "inactive"],
  completed: ["inactive"],
  lost: ["lead", "consult_booked", "inactive"],
  inactive: ["lead", "consult_booked"],
};

export function patientJourneyStateRank(state: PatientJourneyState): number {
  return STATE_RANK[state] ?? 0;
}

export function pickHigherJourneyState(
  a: PatientJourneyState,
  b: PatientJourneyState
): PatientJourneyState {
  if (a === "lost" || a === "inactive") return b;
  if (b === "lost" || b === "inactive") return a;
  return patientJourneyStateRank(a) >= patientJourneyStateRank(b) ? a : b;
}

export function isPatientJourneyTransitionAllowed(
  from: PatientJourneyState,
  to: PatientJourneyState,
  manual = false
): boolean {
  if (from === to) return true;
  if (manual) return PATIENT_JOURNEY_STATES.includes(to);
  const allowed = PATIENT_JOURNEY_ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/** Derive canonical state from aggregated clinic signals (no DB). */
export function derivePatientJourneyStateFromSignals(
  signals: PatientJourneySignals
): PatientJourneyState {
  if (signals.leadLost) return "lost";
  if (!signals.hasRecentActivity && !signals.consultBooked && !signals.surgeryBooked) {
    if (!signals.hasLead && !signals.consultCompleted && !signals.procedureCompleted) {
      return "inactive";
    }
  }

  const candidates: PatientJourneyState[] = [];

  if (signals.twelveMonthAuditDue) candidates.push("twelve_month_audit_due");
  if (signals.sixMonthReviewDue) candidates.push("six_month_review_due");
  if (signals.threeMonthReviewDue) candidates.push("three_month_review_due");
  if (signals.postOpFollowUpDue) candidates.push("post_op_follow_up_due");
  if (signals.procedureCompleted) candidates.push("procedure_completed");
  if (signals.procedureDayToday) candidates.push("procedure_day");
  if (signals.surgeryReadinessReady) candidates.push("pre_op_ready");
  if (signals.surgeryBooked && !signals.surgeryReadinessReady) candidates.push("pre_op_incomplete");
  if (signals.surgeryBooked) candidates.push("surgery_booked");
  if (signals.depositPaid) candidates.push("deposit_paid");
  if (signals.quoteAccepted) candidates.push("quote_accepted");
  if (signals.quoteSent) candidates.push("quote_sent");
  if (signals.treatmentRecommended) candidates.push("treatment_recommended");
  if (signals.consultCompleted) candidates.push("consult_completed");
  if (signals.consultBooked) candidates.push("consult_booked");
  if (signals.hasLead) candidates.push("lead");

  if (candidates.length === 0) return "lead";

  return candidates.reduce((best, cur) => pickHigherJourneyState(best, cur));
}

export function detectPatientJourneyBlockers(input: {
  state: PatientJourneyState;
  signals: PatientJourneySignals;
  hrefs?: Partial<Record<PatientJourneyBlockerKind, string | null>>;
}): PatientJourneyBlocker[] {
  const { state, signals } = input;
  const hrefs = input.hrefs ?? {};
  const blockers: PatientJourneyBlocker[] = [];

  if (
    (state === "quote_accepted" || state === "surgery_booked" || state === "pre_op_incomplete") &&
    !signals.consentSigned
  ) {
    blockers.push({
      kind: "missing_consent",
      label: "Consent not signed",
      severity: "critical",
      href: hrefs.missing_consent ?? null,
    });
  }

  if (
    (state === "quote_accepted" || state === "surgery_booked" || state === "pre_op_incomplete") &&
    !signals.depositPaid
  ) {
    blockers.push({
      kind: "unpaid_deposit",
      label: "Deposit unpaid",
      severity: "critical",
      href: hrefs.unpaid_deposit ?? null,
    });
  }

  if (state === "surgery_booked" && !signals.surgeryDateYmd) {
    blockers.push({
      kind: "no_surgery_date",
      label: "No surgery date scheduled",
      severity: "warning",
      href: hrefs.no_surgery_date ?? null,
    });
  }

  if (
    (state === "pre_op_incomplete" || state === "pre_op_ready") &&
    !signals.imagingComplete
  ) {
    blockers.push({
      kind: "missing_images",
      label: "Clinical photos incomplete",
      severity: "warning",
      href: hrefs.missing_images ?? null,
    });
  }

  if (state === "pre_op_incomplete" && !signals.preOpChecklistComplete) {
    blockers.push({
      kind: "incomplete_pre_op_checklist",
      label: "Pre-op checklist incomplete",
      severity: "warning",
      href: hrefs.incomplete_pre_op_checklist ?? null,
    });
  }

  if (
    (state === "post_op_follow_up_due" ||
      state === "three_month_review_due" ||
      state === "six_month_review_due") &&
    !signals.followUpBooked
  ) {
    blockers.push({
      kind: "missing_follow_up_booking",
      label: "Follow-up not booked",
      severity: "warning",
      href: hrefs.missing_follow_up_booking ?? null,
    });
  }

  return blockers;
}

export function derivePatientJourneyNextBestAction(input: {
  state: PatientJourneyState;
  blockers: readonly PatientJourneyBlocker[];
  basePath: string;
}): { label: string; href: string; description: string } {
  const critical = input.blockers.find((b) => b.severity === "critical");
  if (critical?.href) {
    return {
      label: `Resolve: ${critical.label}`,
      href: critical.href,
      description: "Highest-priority blocker before advancing the journey.",
    };
  }

  switch (input.state) {
    case "lead":
      return {
        label: "Book consultation",
        href: `${input.basePath}/calendar`,
        description: "Schedule the first consultation.",
      };
    case "consult_booked":
      return {
        label: "Prepare for consultation",
        href: `${input.basePath}/consultations`,
        description: "Confirm intake forms and imaging before the visit.",
      };
    case "consult_completed":
    case "treatment_recommended":
      return {
        label: "Send quote",
        href: `${input.basePath}/consultations`,
        description: "Issue treatment quote after consultation.",
      };
    case "quote_sent":
      return {
        label: "Follow up on quote",
        href: `${input.basePath}/crm`,
        description: "Confirm patient acceptance and next steps.",
      };
    case "quote_accepted":
      return {
        label: "Collect deposit",
        href: `${input.basePath}/financial/dashboard`,
        description: "Record deposit before surgery scheduling.",
      };
    case "deposit_paid":
      return {
        label: "Book surgery",
        href: `${input.basePath}/surgery-booking`,
        description: "Schedule procedure in SurgeryOS.",
      };
    case "surgery_booked":
    case "pre_op_incomplete":
      return {
        label: "Complete pre-op checklist",
        href: `${input.basePath}/surgery-readiness`,
        description: "Clear consent, imaging, and readiness items.",
      };
    case "pre_op_ready":
      return {
        label: "Open procedure day",
        href: `${input.basePath}/procedure-day`,
        description: "Monitor surgery day operations.",
      };
    case "procedure_day":
      return {
        label: "Complete procedure",
        href: `${input.basePath}/procedure-day`,
        description: "Mark procedure complete and plan follow-up.",
      };
    case "procedure_completed":
    case "post_op_follow_up_due":
      return {
        label: "Book follow-up",
        href: `${input.basePath}/calendar`,
        description: "Schedule post-operative review.",
      };
    case "three_month_review_due":
    case "six_month_review_due":
    case "twelve_month_audit_due":
      return {
        label: "Schedule review",
        href: `${input.basePath}/calendar`,
        description: "Book milestone review appointment.",
      };
    case "completed":
      return {
        label: "View patient timeline",
        href: `${input.basePath}/timeline`,
        description: "Journey complete — review history.",
      };
    case "lost":
      return {
        label: "Re-engage lead",
        href: `${input.basePath}/crm`,
        description: "Attempt reactivation or archive.",
      };
    case "inactive":
      return {
        label: "Book consultation",
        href: `${input.basePath}/calendar`,
        description: "Reactivate dormant patient.",
      };
  }
}

export function presentPatientJourneyState(state: PatientJourneyState): PatientJourneyPresentation {
  const label = PATIENT_JOURNEY_STATE_LABELS[state];
  const tone: PatientJourneyPresentation["tone"] =
    state === "lost"
      ? "critical"
      : state === "inactive"
        ? "neutral"
        : state === "procedure_completed" || state === "completed" || state === "pre_op_ready"
          ? "success"
          : state === "pre_op_incomplete" || state === "post_op_follow_up_due"
            ? "warning"
            : "info";

  const description =
    state === "completed"
      ? "Patient has completed the full clinic lifecycle."
      : state === "lost"
        ? "Lead marked lost — re-engagement may be required."
        : state === "inactive"
          ? "No recent clinic activity on record."
          : `Patient is at stage: ${label}.`;

  return { state, label, tone, description };
}

/** Map canonical state to legacy PatientCommandHero labels for gradual UI migration. */
export function legacyJourneyLabelFromCanonical(state: PatientJourneyState): string {
  switch (state) {
    case "lead":
      return "Consultation pending";
    case "consult_booked":
      return "Appointment booked";
    case "consult_completed":
      return "Consultation completed";
    case "treatment_recommended":
    case "quote_sent":
      return "Treatment planning";
    case "quote_accepted":
    case "deposit_paid":
    case "pre_op_incomplete":
      return "Surgery readiness pending";
    case "surgery_booked":
    case "pre_op_ready":
      return "Procedure scheduled";
    case "procedure_day":
      return "Active treatment";
    case "procedure_completed":
    case "post_op_follow_up_due":
      return "Post-procedure";
    case "three_month_review_due":
    case "six_month_review_due":
    case "twelve_month_audit_due":
      return "Monitoring / follow-up";
    case "completed":
      return "Monitoring / follow-up";
    case "lost":
      return "Dormant";
    case "inactive":
      return "Dormant";
  }
}

export function targetStateForAutomationEvent(event: string): PatientJourneyState | null {
  switch (event.trim()) {
    case "consultation_booked":
      return "consult_booked";
    case "consultation_completed":
      return "consult_completed";
    case "treatment_recommended":
      return "treatment_recommended";
    case "quote_sent":
      return "quote_sent";
    case "quote_accepted":
      return "quote_accepted";
    case "payment_received":
      return "deposit_paid";
    case "surgery_booked":
      return "surgery_booked";
    case "surgery_readiness_ready":
      return "pre_op_ready";
    case "procedure_day":
      return "procedure_day";
    case "procedure_completed":
      return "procedure_completed";
    default:
      return null;
  }
}

export function addMonthsToYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function reviewDueFromProcedureDate(
  procedureYmd: string,
  todayYmd: string
): Pick<
  PatientJourneySignals,
  "postOpFollowUpDue" | "threeMonthReviewDue" | "sixMonthReviewDue" | "twelveMonthAuditDue"
> {
  const three = addMonthsToYmd(procedureYmd, 3);
  const six = addMonthsToYmd(procedureYmd, 6);
  const twelve = addMonthsToYmd(procedureYmd, 12);
  const twoWeeks = addMonthsToYmd(procedureYmd, 0);
  const postOpDue = todayYmd >= addMonthsToYmd(procedureYmd, 0) && todayYmd < three;
  void twoWeeks;
  return {
    postOpFollowUpDue: postOpDue && todayYmd >= procedureYmd,
    threeMonthReviewDue: todayYmd >= three && todayYmd < six,
    sixMonthReviewDue: todayYmd >= six && todayYmd < twelve,
    twelveMonthAuditDue: todayYmd >= twelve,
  };
}